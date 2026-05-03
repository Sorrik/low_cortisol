// backend/src/insights/consistency.service.ts
//
// Кросс-валидация субъективных метрик с объективными. Отвечает на вопрос
// «можно ли вообще доверять этой самооценке?» и помечает confidence для
// рекомендации, опирающейся на эту метрику.
//
// Зачем это:
//   - Пользователь может поставить sleep_quality=8, проспав 4 часа.
//   - Может отметить stress=2 при mood=3 и нулевой активности (underreporting).
//   - Резкий скачок mood без объективных триггеров — подозрителен.
// Не цензурируем самооценки, но передаём уровень доверия в trigger_signal,
// чтобы фронт мог визуально отметить «возможно, расхождение в данных» и
// чтобы LLM-промпт понимал: на этой метрике нельзя строить жёсткие выводы.

import { Injectable, Logger } from '@nestjs/common'

export type ConsistencyConfidence = 'low' | 'medium' | 'high'

export interface ConsistencyFlag {
  metric:     'sleep' | 'mood' | 'stress'
  confidence: ConsistencyConfidence
  reason:     string                    // короткое описание расхождения
  rule_id:    string                    // для трассировки в логах
}

export interface ConsistencySnapshot {
  /** Карта метрика → флаг (если расхождения нет — метрики в карте может не быть). */
  flags: Partial<Record<'sleep' | 'mood' | 'stress', ConsistencyFlag>>
}

interface DayLike {
  date:        string
  sleepHours?: number | null
  sleepQuality?: number | null
  mood?:       number | null
  stress?:     number | null
  activityMinutes?: number | null
  interruptions?:   number | null
}

@Injectable()
export class ConsistencyService {
  private readonly logger = new Logger(ConsistencyService.name)

  /**
   * Считает флаги по последним нескольким дням. Возвращает confidence по
   * каждой субъективной метрике, для которой замечены расхождения.
   * Если расхождений нет — флаг не выдаётся, рекомендации идут с конфиденсом
   * по умолчанию (определяется выше — например, samples baseline'а).
   */
  evaluate(days: DayLike[]): ConsistencySnapshot {
    const flags: ConsistencySnapshot['flags'] = {}

    if (!days?.length) return { flags }

    // Берём последние 3 дня — этого достаточно, чтобы поймать «вчера» и
    // «позавчера» паттерны без шума длинной истории.
    const recent = [...days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-3)

    const last = recent[recent.length - 1]
    if (!last) return { flags }

    // ── Sleep: subjective quality vs objective duration/interruptions ─────
    if (
      last.sleepQuality != null && last.sleepQuality >= 8 &&
      last.sleepHours   != null && last.sleepHours   < 5
    ) {
      flags.sleep = {
        metric:     'sleep',
        confidence: 'low',
        reason:     `quality=${last.sleepQuality}/10, но длительность только ${last.sleepHours.toFixed(1)}ч`,
        rule_id:    'consistency_sleep_q_vs_duration',
      }
    } else if (
      last.sleepQuality != null && last.sleepQuality <= 3 &&
      last.sleepHours   != null && last.sleepHours   >= 8 &&
      (last.interruptions ?? 0) === 0
    ) {
      flags.sleep = {
        metric:     'sleep',
        confidence: 'low',
        reason:     `quality=${last.sleepQuality}/10 при ${last.sleepHours.toFixed(1)}ч и без пробуждений`,
        rule_id:    'consistency_sleep_q_low_but_long',
      }
    }

    // ── Stress vs mood / активность: возможный underreporting ────────────
    if (
      last.stress != null && last.stress <= 2 &&
      last.mood   != null && last.mood   <= 4 &&
      last.activityMinutes != null && last.activityMinutes === 0
    ) {
      flags.stress = {
        metric:     'stress',
        confidence: 'low',
        reason:     `stress=${last.stress}/10 при mood=${last.mood}/10 и нулевой активности`,
        rule_id:    'consistency_stress_underreport',
      }
    }

    // ── Mood: резкий скачок без объективных триггеров ─────────────────────
    if (recent.length >= 2) {
      const prev = recent[recent.length - 2]
      if (
        prev?.mood != null && last.mood != null &&
        Math.abs(last.mood - prev.mood) >= 4
      ) {
        // Считаем, есть ли «объективное объяснение» прыжка
        const sleepChanged =
          prev.sleepHours != null && last.sleepHours != null &&
          Math.abs(last.sleepHours - prev.sleepHours) >= 2
        const stressChanged =
          prev.stress != null && last.stress != null &&
          Math.abs(last.stress - prev.stress) >= 3

        if (!sleepChanged && !stressChanged) {
          flags.mood = {
            metric:     'mood',
            confidence: 'medium',
            reason:     `mood изменился с ${prev.mood} на ${last.mood} без видимых изменений сна/стресса`,
            rule_id:    'consistency_mood_jump_unexplained',
          }
        }
      }
    }

    if (Object.keys(flags).length > 0) {
      this.logger.log(
        `[consistency] flags: ${
          Object.values(flags).map(f => `${f!.rule_id}(${f!.confidence})`).join(', ')
        }`,
      )
    }

    return { flags }
  }
}
