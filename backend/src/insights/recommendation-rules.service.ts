// backend/src/insights/recommendation-rules.service.ts
//
// Слой 1 — детерминированные правила без AI.
// Покрывает ~80% рекомендаций мгновенно (<5мс).
//
// Использование:
//   const engine = new RecommendationRulesService()
//   const results = engine.evaluate(metrics)
//   // results отсортированы по priority desc, готовы к передаче в LLM-слой

import { Injectable } from '@nestjs/common'

// ─── Типы ────────────────────────────────────────────────────────────────────

export type Category = 'nutrition' | 'sleep' | 'activity' | 'stress' | 'mood'
export type Severity  = 'critical' | 'warning' | 'info'

/** Усреднённые метрики за N дней (из InsightsService) */
export interface UserMetrics {
  // Питание (среднее за 7 дней)
  avgCalories:     number       // ккал/день
  avgProteinGrams: number       // г/день
  avgCarbsGrams:   number       // г/день
  avgFatGrams:     number       // г/день
  nutritionDays:   number       // сколько дней залогировано

  // Сон
  avgSleepHours:   number       // часов/ночь
  sleepQuality:    number       // 1–10 среднее

  // Активность
  avgActivityMins: number       // минут умеренной активности/день
  activeDays:      number       // дней с активностью из последних 7

  // Стресс и настроение
  avgStressLevel:  number       // 1–10
  avgMoodScore:    number       // 1–10
  latestMood:      number       // последняя оценка
  latestStress:    number       // последняя оценка

  // Дополнительно
  totalDataDays:   number       // всего дней с данными в системе
  bodyWeightKg?:   number       // если задан профиль
  goalCalories?:   number       // цель по калориям из профиля
}

/** Результат одного сработавшего правила */
export interface RuleResult {
  ruleId:      string
  category:    Category
  severity:    Severity
  title:       string           // заголовок для UI
  shortReason: string           // 1 предложение: почему сработало (факты)
  suggestion:  string           // конкретное действие
  priority:    number           // 0–100, чем выше — тем важнее показать
  metricValue: number           // реальное значение, которое нарушило порог
  threshold:   number           // порог сравнения
  deltaFromNorm: number         // насколько далеко от нормы (может быть отрицательным)
  tags:        string[]         // для фильтрации / группировки на фронте
}

// ─── Константы норм ──────────────────────────────────────────────────────────

const NORMS = {
  // Питание
  MIN_CALORIES:      1500,      // ниже — дефицит
  TARGET_CALORIES:   2000,      // ориентир без профиля
  MAX_CALORIES:      3000,      // выше — профицит
  MIN_PROTEIN:         50,      // г/день минимум
  TARGET_PROTEIN:      80,      // г/день оптимум
  MAX_CARBS_RATIO:   0.65,      // углеводы > 65% ккал — много
  MIN_LOG_DAYS:          4,     // из 7 — минимум для анализа

  // Сон
  MIN_SLEEP:           6.0,     // ч — критически мало
  TARGET_SLEEP_LOW:    7.0,     // ч — нижняя граница нормы
  TARGET_SLEEP_HIGH:   9.0,     // ч — верхняя граница нормы
  MAX_SLEEP:           10.0,    // ч — слишком много
  MIN_SLEEP_QUALITY:    5,      // /10

  // Активность (ВОЗ: 150 мин/нед умеренной = 21 мин/день)
  MIN_ACTIVITY_MINS:   21,      // мин/день
  TARGET_ACTIVITY:     30,      // мин/день
  MIN_ACTIVE_DAYS:      3,      // из 7

  // Стресс / настроение
  HIGH_STRESS:          7,      // /10 — высокий
  CRITICAL_STRESS:      9,      // /10 — критический
  LOW_MOOD:             4,      // /10 — тревожный
  CRITICAL_MOOD:        3,      // /10 — критически низкое
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────

const pct = (val: number, norm: number) =>
  Math.round(((val - norm) / norm) * 100)

// ─── Движок правил ───────────────────────────────────────────────────────────

@Injectable()
export class RecommendationRulesService {

  /**
   * Запустить все правила против метрик пользователя.
   * Возвращает только сработавшие, отсортированные по priority desc.
   */
  evaluate(m: UserMetrics): RuleResult[] {
    const results: RuleResult[] = []

    const add = (r: RuleResult | null) => { if (r) results.push(r) }

    // ── Питание ───────────────────────────────────────────────────
    add(this.checkCalorieDeficit(m))
    add(this.checkCalorieSurplus(m))
    add(this.checkProteinDeficit(m))
    add(this.checkCarbsOverload(m))
    add(this.checkNutritionLogging(m))

    // ── Сон ───────────────────────────────────────────────────────
    add(this.checkCriticalSleepDeficit(m))
    add(this.checkModerateSleepDeficit(m))
    add(this.checkOversleeping(m))
    add(this.checkLowSleepQuality(m))

    // ── Активность ────────────────────────────────────────────────
    add(this.checkSedentaryLifestyle(m))
    add(this.checkInsufficientActivity(m))
    add(this.checkIrregularActivity(m))

    // ── Стресс ────────────────────────────────────────────────────
    add(this.checkCriticalStress(m))
    add(this.checkHighStress(m))
    add(this.checkStressAndSleepCombo(m))

    // ── Настроение ────────────────────────────────────────────────
    add(this.checkCriticalMood(m))
    add(this.checkLowMood(m))
    add(this.checkMoodStressCombo(m))

    // ── Комбинированные ───────────────────────────────────────────
    add(this.checkSleepNutritionCombo(m))
    add(this.checkRecoveryPattern(m))
    add(this.checkPositiveFeedback(m))

    return results
      .sort((a, b) => b.priority - a.priority)
  }

  // ═══════════════════════════════════════════════════════════════
  // ПИТАНИЕ
  // ═══════════════════════════════════════════════════════════════

  private checkCalorieDeficit(m: UserMetrics): RuleResult | null {
    const target = m.goalCalories ?? NORMS.TARGET_CALORIES
    if (m.nutritionDays < NORMS.MIN_LOG_DAYS) return null
    if (m.avgCalories >= NORMS.MIN_CALORIES)  return null

    const gap     = target - m.avgCalories
    const pctGap  = Math.round((gap / target) * 100)
    const severity: Severity = m.avgCalories < 1200 ? 'critical' : 'warning'

    return {
      ruleId:        'nutrition.calorie_deficit',
      category:      'nutrition',
      severity,
      title:         'Увеличить калорийность питания',
      shortReason:   `Среднее за 7 дней — ${Math.round(m.avgCalories)} ккал (на ${pctGap}% ниже цели ${target} ккал).`,
      suggestion:    `Добавь 1–2 питательных перекуса: орехи, яйца, творог. Дефицит ${gap} ккал/день истощает энергию и ухудшает настроение.`,
      priority:      severity === 'critical' ? 95 : 80,
      metricValue:   m.avgCalories,
      threshold:     NORMS.MIN_CALORIES,
      deltaFromNorm: m.avgCalories - target,
      tags:          ['nutrition', 'energy', 'mood-impact'],
    }
  }

  private checkCalorieSurplus(m: UserMetrics): RuleResult | null {
    if (m.nutritionDays < NORMS.MIN_LOG_DAYS) return null
    if (m.avgCalories <= NORMS.MAX_CALORIES)  return null

    const surplus = Math.round(m.avgCalories - NORMS.MAX_CALORIES)

    return {
      ruleId:        'nutrition.calorie_surplus',
      category:      'nutrition',
      severity:      'warning',
      title:         'Снизить профицит калорий',
      shortReason:   `Среднее — ${Math.round(m.avgCalories)} ккал/день (профицит ~${surplus} ккал).`,
      suggestion:    'Замени ультрапроцессированные продукты на цельные: меньше хлеба, больше овощей и белка.',
      priority:      55,
      metricValue:   m.avgCalories,
      threshold:     NORMS.MAX_CALORIES,
      deltaFromNorm: m.avgCalories - NORMS.MAX_CALORIES,
      tags:          ['nutrition', 'weight'],
    }
  }

  private checkProteinDeficit(m: UserMetrics): RuleResult | null {
    if (m.nutritionDays < NORMS.MIN_LOG_DAYS)       return null
    if (m.avgProteinGrams >= NORMS.MIN_PROTEIN)      return null

    const gap = NORMS.TARGET_PROTEIN - m.avgProteinGrams

    return {
      ruleId:        'nutrition.protein_deficit',
      category:      'nutrition',
      severity:      'warning',
      title:         'Недостаток белка в рационе',
      shortReason:   `Среднее — ${Math.round(m.avgProteinGrams)}г белка/день (норма ≥${NORMS.MIN_PROTEIN}г).`,
      suggestion:    `Добавь +${Math.round(gap)}г белка: куриное филе 200г = 46г, творог 9% 200г = 34г, яйцо = 12г.`,
      priority:      70,
      metricValue:   m.avgProteinGrams,
      threshold:     NORMS.MIN_PROTEIN,
      deltaFromNorm: m.avgProteinGrams - NORMS.TARGET_PROTEIN,
      tags:          ['nutrition', 'recovery', 'muscle'],
    }
  }

  private checkCarbsOverload(m: UserMetrics): RuleResult | null {
    if (m.nutritionDays < NORMS.MIN_LOG_DAYS) return null
    if (m.avgCalories < 100)                   return null

    const carbsKcal  = m.avgCarbsGrams * 4
    const carbsRatio = carbsKcal / m.avgCalories

    if (carbsRatio <= NORMS.MAX_CARBS_RATIO) return null

    return {
      ruleId:        'nutrition.carbs_overload',
      category:      'nutrition',
      severity:      'info',
      title:         'Перекос в сторону углеводов',
      shortReason:   `${Math.round(carbsRatio * 100)}% калорий из углеводов (норма ≤65%).`,
      suggestion:    'Замени часть круп и хлеба на белок и здоровые жиры — это стабилизирует уровень энергии.',
      priority:      40,
      metricValue:   Math.round(carbsRatio * 100),
      threshold:     65,
      deltaFromNorm: Math.round((carbsRatio - NORMS.MAX_CARBS_RATIO) * 100),
      tags:          ['nutrition', 'energy-stability'],
    }
  }

  private checkNutritionLogging(m: UserMetrics): RuleResult | null {
    if (m.totalDataDays < 3)           return null  // новый пользователь
    if (m.nutritionDays >= NORMS.MIN_LOG_DAYS) return null

    return {
      ruleId:        'nutrition.low_logging',
      category:      'nutrition',
      severity:      'info',
      title:         'Логируй питание регулярнее',
      shortReason:   `За последние 7 дней еда записана только ${m.nutritionDays} дн. — точный анализ невозможен.`,
      suggestion:    'Записывай хотя бы 4–5 дней в неделю — это достаточно для персональной модели.',
      priority:      35,
      metricValue:   m.nutritionDays,
      threshold:     NORMS.MIN_LOG_DAYS,
      deltaFromNorm: m.nutritionDays - NORMS.MIN_LOG_DAYS,
      tags:          ['data-quality', 'nutrition'],
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // СОН
  // ═══════════════════════════════════════════════════════════════

  private checkCriticalSleepDeficit(m: UserMetrics): RuleResult | null {
    if (m.avgSleepHours >= NORMS.MIN_SLEEP) return null

    const deficit = NORMS.TARGET_SLEEP_LOW - m.avgSleepHours

    return {
      ruleId:        'sleep.critical_deficit',
      category:      'sleep',
      severity:      'critical',
      title:         'Критически мало сна',
      shortReason:   `Средний сон — ${m.avgSleepHours.toFixed(1)}ч (норма 7–9ч). Недосып −${deficit.toFixed(1)}ч каждую ночь.`,
      suggestion:    'Приоритет №1: ложись на 1 час раньше начиная сегодня. Отключи экраны за 30 мин до сна.',
      priority:      98,
      metricValue:   m.avgSleepHours,
      threshold:     NORMS.MIN_SLEEP,
      deltaFromNorm: m.avgSleepHours - NORMS.TARGET_SLEEP_LOW,
      tags:          ['sleep', 'critical', 'mood-impact', 'stress-impact'],
    }
  }

  private checkModerateSleepDeficit(m: UserMetrics): RuleResult | null {
    if (m.avgSleepHours < NORMS.MIN_SLEEP)              return null
    if (m.avgSleepHours >= NORMS.TARGET_SLEEP_LOW)      return null

    const deficit = NORMS.TARGET_SLEEP_LOW - m.avgSleepHours

    return {
      ruleId:        'sleep.moderate_deficit',
      category:      'sleep',
      severity:      'warning',
      title:         'Оптимизировать режим сна',
      shortReason:   `Средний сон — ${m.avgSleepHours.toFixed(1)}ч. Не хватает ~${deficit.toFixed(1)}ч до нижней границы нормы.`,
      suggestion:    'Ложись и вставай в одно время ±30 мин. Даже в выходные — это важнее продолжительности.',
      priority:      75,
      metricValue:   m.avgSleepHours,
      threshold:     NORMS.TARGET_SLEEP_LOW,
      deltaFromNorm: m.avgSleepHours - NORMS.TARGET_SLEEP_LOW,
      tags:          ['sleep', 'consistency', 'mood-impact'],
    }
  }

  private checkOversleeping(m: UserMetrics): RuleResult | null {
    if (m.avgSleepHours <= NORMS.MAX_SLEEP) return null

    return {
      ruleId:        'sleep.oversleeping',
      category:      'sleep',
      severity:      'info',
      title:         'Слишком много сна',
      shortReason:   `Средний сон — ${m.avgSleepHours.toFixed(1)}ч (выше нормы 9ч). Это может указывать на усталость или депрессию.`,
      suggestion:    'Попробуй вставать в фиксированное время, даже если лёг поздно. Дневной сон — не более 20 мин.',
      priority:      45,
      metricValue:   m.avgSleepHours,
      threshold:     NORMS.MAX_SLEEP,
      deltaFromNorm: m.avgSleepHours - NORMS.TARGET_SLEEP_HIGH,
      tags:          ['sleep', 'mood'],
    }
  }

  private checkLowSleepQuality(m: UserMetrics): RuleResult | null {
    if (m.sleepQuality >= NORMS.MIN_SLEEP_QUALITY) return null
    // Если часы нормальные, но качество плохое
    if (m.avgSleepHours < NORMS.TARGET_SLEEP_LOW)  return null  // уже покрыто выше

    return {
      ruleId:        'sleep.low_quality',
      category:      'sleep',
      severity:      'warning',
      title:         'Низкое качество сна',
      shortReason:   `Часов достаточно (${m.avgSleepHours.toFixed(1)}ч), но качество сна ${m.sleepQuality.toFixed(1)}/10.`,
      suggestion:    'Температура 18–19°C в спальне + полная темнота дают +1.5 балла качества по исследованиям.',
      priority:      65,
      metricValue:   m.sleepQuality,
      threshold:     NORMS.MIN_SLEEP_QUALITY,
      deltaFromNorm: m.sleepQuality - 7,  // целевое качество = 7
      tags:          ['sleep', 'quality', 'recovery'],
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // АКТИВНОСТЬ
  // ═══════════════════════════════════════════════════════════════

  private checkSedentaryLifestyle(m: UserMetrics): RuleResult | null {
    if (m.avgActivityMins >= NORMS.MIN_ACTIVITY_MINS) return null

    return {
      ruleId:        'activity.sedentary',
      category:      'activity',
      severity:      m.avgActivityMins < 10 ? 'critical' : 'warning',
      title:         'Увеличить ежедневную активность',
      shortReason:   `Среднее — ${Math.round(m.avgActivityMins)} мин/день (норма ВОЗ: 21 мин/день / 150 мин/нед).`,
      suggestion:    'Начни с 15-минутной прогулки после ужина — это самый доказанный способ улучшить настроение без тренажёра.',
      priority:      m.avgActivityMins < 10 ? 85 : 70,
      metricValue:   m.avgActivityMins,
      threshold:     NORMS.MIN_ACTIVITY_MINS,
      deltaFromNorm: m.avgActivityMins - NORMS.TARGET_ACTIVITY,
      tags:          ['activity', 'mood-impact', 'who-guidelines'],
    }
  }

  private checkInsufficientActivity(m: UserMetrics): RuleResult | null {
    if (m.avgActivityMins < NORMS.MIN_ACTIVITY_MINS)        return null
    if (m.avgActivityMins >= NORMS.TARGET_ACTIVITY)          return null

    return {
      ruleId:        'activity.insufficient',
      category:      'activity',
      severity:      'info',
      title:         'Чуть-чуть до нормы активности',
      shortReason:   `${Math.round(m.avgActivityMins)} мин/день — ты близко к норме 30 мин/день.`,
      suggestion:    `Добавь ${Math.round(NORMS.TARGET_ACTIVITY - m.avgActivityMins)} мин в день: пешком до магазина или зарядка утром.`,
      priority:      40,
      metricValue:   m.avgActivityMins,
      threshold:     NORMS.TARGET_ACTIVITY,
      deltaFromNorm: m.avgActivityMins - NORMS.TARGET_ACTIVITY,
      tags:          ['activity', 'positive'],
    }
  }

  private checkIrregularActivity(m: UserMetrics): RuleResult | null {
    // Общий объём нормальный, но распределён неравномерно
    if (m.activeDays >= NORMS.MIN_ACTIVE_DAYS) return null
    if (m.avgActivityMins < NORMS.MIN_ACTIVITY_MINS) return null  // покрыто выше

    return {
      ruleId:        'activity.irregular',
      category:      'activity',
      severity:      'info',
      title:         'Равномернее распределить активность',
      shortReason:   `Активных дней — ${m.activeDays} из 7. Редкие долгие тренировки менее эффективны.`,
      suggestion:    'Лучше 20 мин каждый день, чем 2 ч раз в неделю — для настроения это критично.',
      priority:      35,
      metricValue:   m.activeDays,
      threshold:     NORMS.MIN_ACTIVE_DAYS,
      deltaFromNorm: m.activeDays - NORMS.MIN_ACTIVE_DAYS,
      tags:          ['activity', 'consistency'],
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // СТРЕСС
  // ═══════════════════════════════════════════════════════════════

  private checkCriticalStress(m: UserMetrics): RuleResult | null {
    if (m.avgStressLevel < NORMS.CRITICAL_STRESS) return null

    return {
      ruleId:        'stress.critical',
      category:      'stress',
      severity:      'critical',
      title:         'Критически высокий уровень стресса',
      shortReason:   `Стресс ${m.avgStressLevel.toFixed(1)}/10 в среднем за 7 дней. Хронический стресс выше 9 — зона риска.`,
      suggestion:    '4-7-8 дыхание прямо сейчас: вдох 4 сек, задержка 7 сек, выдох 8 сек. Повтори 4 раза.',
      priority:      97,
      metricValue:   m.avgStressLevel,
      threshold:     NORMS.CRITICAL_STRESS,
      deltaFromNorm: m.avgStressLevel - NORMS.HIGH_STRESS,
      tags:          ['stress', 'critical', 'immediate-action'],
    }
  }

  private checkHighStress(m: UserMetrics): RuleResult | null {
    if (m.avgStressLevel < NORMS.HIGH_STRESS)      return null
    if (m.avgStressLevel >= NORMS.CRITICAL_STRESS) return null

    return {
      ruleId:        'stress.high',
      category:      'stress',
      severity:      'warning',
      title:         'Ввести практику снижения стресса',
      shortReason:   `Стресс ${m.avgStressLevel.toFixed(1)}/10 — выше нормы (≤6).`,
      suggestion:    '10-минутная медитация или прогрессивная мышечная релаксация снижают кортизол на 15–20% по данным исследований.',
      priority:      78,
      metricValue:   m.avgStressLevel,
      threshold:     NORMS.HIGH_STRESS,
      deltaFromNorm: m.avgStressLevel - NORMS.HIGH_STRESS,
      tags:          ['stress', 'mindfulness', 'cortisol'],
    }
  }

  private checkStressAndSleepCombo(m: UserMetrics): RuleResult | null {
    // Комбо: высокий стресс + плохой сон = взаимно усиливают
    if (m.avgStressLevel < NORMS.HIGH_STRESS)     return null
    if (m.avgSleepHours >= NORMS.TARGET_SLEEP_LOW) return null

    return {
      ruleId:        'combo.stress_sleep',
      category:      'stress',
      severity:      'critical',
      title:         'Цикл стресс-недосып — нужно разорвать',
      shortReason:   `Стресс ${m.avgStressLevel.toFixed(1)}/10 + сон ${m.avgSleepHours.toFixed(1)}ч — эти факторы взаимно усиливают друг друга.`,
      suggestion:    'Приоритет: нормализуй сон. Даже +1 час сна снижает уровень кортизола на следующий день на 10–15%.',
      priority:      93,
      metricValue:   m.avgStressLevel,
      threshold:     NORMS.HIGH_STRESS,
      deltaFromNorm: m.avgSleepHours - NORMS.TARGET_SLEEP_LOW,
      tags:          ['combo', 'stress', 'sleep', 'cortisol'],
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // НАСТРОЕНИЕ
  // ═══════════════════════════════════════════════════════════════

  private checkCriticalMood(m: UserMetrics): RuleResult | null {
    if (m.avgMoodScore >= NORMS.CRITICAL_MOOD) return null

    return {
      ruleId:        'mood.critical',
      category:      'mood',
      severity:      'critical',
      title:         'Очень низкое настроение — нужна поддержка',
      shortReason:   `Настроение ${m.avgMoodScore.toFixed(1)}/10 в среднем за 7 дней.`,
      suggestion:    'Поговори с кем-то близким сегодня. Если ощущение не проходит — рассмотри консультацию специалиста.',
      priority:      99,
      metricValue:   m.avgMoodScore,
      threshold:     NORMS.CRITICAL_MOOD,
      deltaFromNorm: m.avgMoodScore - 7,
      tags:          ['mood', 'critical', 'mental-health'],
    }
  }

  private checkLowMood(m: UserMetrics): RuleResult | null {
    if (m.avgMoodScore < NORMS.CRITICAL_MOOD)  return null
    if (m.avgMoodScore >= NORMS.LOW_MOOD)       return null

    return {
      ruleId:        'mood.low',
      category:      'mood',
      severity:      'warning',
      title:         'Поднять базовый уровень настроения',
      shortReason:   `Настроение ${m.avgMoodScore.toFixed(1)}/10 — ниже комфортного уровня (≥5).`,
      suggestion:    'Дневной свет + движение — самое эффективное доказанное средство. 15 мин прогулки утром повышают настроение на 1–2 пункта.',
      priority:      82,
      metricValue:   m.avgMoodScore,
      threshold:     NORMS.LOW_MOOD,
      deltaFromNorm: m.avgMoodScore - 7,
      tags:          ['mood', 'light', 'activity'],
    }
  }

  private checkMoodStressCombo(m: UserMetrics): RuleResult | null {
    // Низкое настроение + высокий стресс + плохой сон одновременно
    const problems = [
      m.avgMoodScore  <  NORMS.LOW_MOOD,
      m.avgStressLevel > NORMS.HIGH_STRESS,
      m.avgSleepHours  < NORMS.TARGET_SLEEP_LOW,
    ].filter(Boolean).length

    if (problems < 2) return null

    return {
      ruleId:        'combo.mood_stress_sleep',
      category:      'mood',
      severity:      'critical',
      title:         'Комплексное нарушение — системный подход',
      shortReason:   `Одновременно: настроение ${m.avgMoodScore.toFixed(1)}/10, стресс ${m.avgStressLevel.toFixed(1)}/10, сон ${m.avgSleepHours.toFixed(1)}ч.`,
      suggestion:    'Исправь одно — остальные улучшатся автоматически. Начни со сна: это самый быстрый рычаг.',
      priority:      96,
      metricValue:   problems,
      threshold:     1,
      deltaFromNorm: -(3 - problems),
      tags:          ['combo', 'mood', 'stress', 'sleep', 'priority'],
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // КОМБИНИРОВАННЫЕ
  // ═══════════════════════════════════════════════════════════════

  private checkSleepNutritionCombo(m: UserMetrics): RuleResult | null {
    // Мало сна И мало калорий — двойной удар по энергии
    if (m.avgSleepHours >= NORMS.MIN_SLEEP)      return null
    if (m.avgCalories   >= NORMS.MIN_CALORIES)   return null
    if (m.nutritionDays < NORMS.MIN_LOG_DAYS)    return null

    return {
      ruleId:        'combo.sleep_nutrition',
      category:      'nutrition',
      severity:      'critical',
      title:         'Двойной дефицит: сон + питание',
      shortReason:   `Сон ${m.avgSleepHours.toFixed(1)}ч + ${Math.round(m.avgCalories)} ккал/день — организм работает на пределе.`,
      suggestion:    'Добавь калорийный завтрак до 10:00 — он компенсирует часть усталости от недосыпа.',
      priority:      90,
      metricValue:   m.avgCalories,
      threshold:     NORMS.MIN_CALORIES,
      deltaFromNorm: m.avgCalories - NORMS.TARGET_CALORIES,
      tags:          ['combo', 'sleep', 'nutrition', 'energy'],
    }
  }

  private checkRecoveryPattern(m: UserMetrics): RuleResult | null {
    // Активность нормальная, но нет восстановления (стресс + мало сна)
    if (m.avgActivityMins < NORMS.MIN_ACTIVITY_MINS) return null
    if (m.avgSleepHours   >= NORMS.TARGET_SLEEP_LOW)  return null
    if (m.avgStressLevel  <  NORMS.HIGH_STRESS)        return null

    return {
      ruleId:        'combo.recovery_deficit',
      category:      'activity',
      severity:      'warning',
      title:         'Нагрузка без восстановления',
      shortReason:   `Активность ${Math.round(m.avgActivityMins)} мин/день, но сон ${m.avgSleepHours.toFixed(1)}ч + стресс ${m.avgStressLevel.toFixed(1)}/10.`,
      suggestion:    'Снизь интенсивность тренировок на 20–30% до нормализации сна. Перетренированность снижает настроение.',
      priority:      60,
      metricValue:   m.avgActivityMins,
      threshold:     NORMS.MIN_ACTIVITY_MINS,
      deltaFromNorm: m.avgSleepHours - NORMS.TARGET_SLEEP_LOW,
      tags:          ['combo', 'recovery', 'activity', 'sleep'],
    }
  }

  private checkPositiveFeedback(m: UserMetrics): RuleResult | null {
    // Всё хорошо — дать позитивное подкрепление
    const allGood =
      m.avgSleepHours   >= NORMS.TARGET_SLEEP_LOW  &&
      m.avgCalories     >= NORMS.MIN_CALORIES       &&
      m.avgActivityMins >= NORMS.TARGET_ACTIVITY    &&
      m.avgStressLevel  <= 5                         &&
      m.avgMoodScore    >= 7

    if (!allGood) return null

    return {
      ruleId:        'positive.all_good',
      category:      'mood',
      severity:      'info',
      title:         'Отличные показатели этой недели',
      shortReason:   `Сон ${m.avgSleepHours.toFixed(1)}ч, активность ${Math.round(m.avgActivityMins)} мин, настроение ${m.avgMoodScore.toFixed(1)}/10.`,
      suggestion:    'Поддерживай этот ритм. Стабильность важнее пиковых результатов — именно она строит долгосрочное самочувствие.',
      priority:      30,
      metricValue:   m.avgMoodScore,
      threshold:     7,
      deltaFromNorm: 0,
      tags:          ['positive', 'maintenance'],
    }
  }

  // ─── Вспомогательный метод: топ-N по приоритету ──────────────
  topN(metrics: UserMetrics, n = 4): RuleResult[] {
    return this.evaluate(metrics).slice(0, n)
  }

  /** Только критические — для алёртов */
  critical(metrics: UserMetrics): RuleResult[] {
    return this.evaluate(metrics).filter(r => r.severity === 'critical')
  }

  /** Хэш состояния — для кэша (изменился ли набор сработавших правил) */
  stateHash(metrics: UserMetrics): string {
    const ids = this.evaluate(metrics).map(r => r.ruleId).sort().join('|')
    return Buffer.from(ids).toString('base64').slice(0, 16)
  }
}