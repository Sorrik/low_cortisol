// backend/src/insights/anomaly-detection.service.ts
//
// Детектор аномалий в данных здоровья.
//
// Аномалия = резкое отклонение от ЛИЧНОЙ нормы пользователя.
// Не от среднестатистических значений, а от его собственной истории.
//
// Три типа:
//   1. spike     — резкий выброс (стресс 9 при норме 4)
//   2. drop      — резкое падение (сон 3ч при норме 7ч)
//   3. trend     — устойчивый тренд вниз 3+ дней подряд
//   4. gap       — пропуск данных 2+ дня (пользователь не вводил)

import { Injectable, Logger } from '@nestjs/common'

export type AnomalyType     = 'spike' | 'drop' | 'trend' | 'gap'
export type AnomalySeverity = 'warning' | 'critical'
export type AnomalyMetric   = 'sleep' | 'stress' | 'mood' | 'activity' | 'water' | 'nutrition'

export interface Anomaly {
  metric:      AnomalyMetric
  type:        AnomalyType
  severity:    AnomalySeverity
  value:       number | null        // текущее значение
  norm:        number | null        // личная норма
  deviation:   number | null        // отклонение в % или абсолютное
  message:     string               // человекочитаемое описание
  date:        string               // дата аномалии
  daysAffected?: number             // для gap и trend — сколько дней
}

export interface AnomalyReport {
  hasAnomalies:    boolean
  hasCritical:     boolean
  anomalies:       Anomaly[]
  gapDays:         number           // сколько дней без данных
  dataQuality:     number           // 0-100%, насколько полны данные за 14 дней
  message:         string | null    // общее сообщение для пользователя
}

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name)

  // ── Главный метод ─────────────────────────────────────────

  detect(healthData: {
    sleep:     { date: string; duration_hours: number; quality: number }[]
    mood:      { date: string; mood_score: number }[]
    stress:    { date: string; level: number }[]
    activity:  { date: string; duration_minutes: number }[]
    water:     { date: string; amount_ml: number }[]
    nutrition: { date: string; calories: number; protein_grams: number }[]
  }): AnomalyReport {

    const anomalies: Anomaly[] = []

    // Пропуски данных (gap)
    const gapResult  = this._detectGaps(healthData)
    anomalies.push(...gapResult.anomalies)

    // Аномалии по каждой метрике
    anomalies.push(...this._detectSleepAnomalies(healthData.sleep))
    anomalies.push(...this._detectStressAnomalies(healthData.stress))
    anomalies.push(...this._detectMoodAnomalies(healthData.mood))
    anomalies.push(...this._detectActivityAnomalies(healthData.activity))
    anomalies.push(...this._detectWaterAnomalies(healthData.water))

    // Сортируем: critical → warning, свежие → старые
    anomalies.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'critical' ? -1 : 1
      }
      return b.date.localeCompare(a.date)
    })

    const hasCritical   = anomalies.some(a => a.severity === 'critical')
    const hasAnomalies  = anomalies.length > 0
    const dataQuality   = gapResult.dataQuality
    const gapDays       = gapResult.gapDays

    let message: string | null = null
    if (gapDays >= 3) {
      message = `Вы не вводили данные ${gapDays} дня подряд. Прогноз может быть менее точным.`
    } else if (hasCritical) {
      message = `Обнаружены критические отклонения от вашей нормы. Обратите внимание на рекомендации.`
    }

    this.logger.log(
      `[anomaly] anomalies=${anomalies.length}, critical=${hasCritical}, ` +
      `gap=${gapDays}d, quality=${dataQuality}%`
    )

    return { hasAnomalies, hasCritical, anomalies, gapDays, dataQuality, message }
  }

  // ── Пропуски данных ───────────────────────────────────────

  private _detectGaps(data: any): {
    anomalies: Anomaly[]
    gapDays:   number
    dataQuality: number
  } {
    const today     = new Date()
    const anomalies: Anomaly[] = []

    // Считаем последний день с любыми данными
    const allDates: string[] = []
    for (const field of ['sleep', 'mood', 'stress', 'activity', 'water', 'nutrition']) {
      const records = data[field] ?? []
      for (const r of records) {
        if (r.date) allDates.push(r.date)
      }
    }

    if (allDates.length === 0) {
      return { anomalies: [], gapDays: 0, dataQuality: 0 }
    }

    // Сравниваем по ISO-дате, а не по timestamp — чтобы не было погрешности ±1 день
    const todayStr   = today.toISOString().split('T')[0]
    const lastDateStr = allDates.reduce((max, d) => d.slice(0, 10) > max ? d.slice(0, 10) : max, '')
    const lastDate   = new Date(lastDateStr)
    const gapDays    = Math.floor(
      (new Date(todayStr).getTime() - new Date(lastDateStr).getTime()) / 86400000
    )

    if (gapDays >= 2) {
      const severity: AnomalySeverity = gapDays >= 5 ? 'critical' : 'warning'
      anomalies.push({
        metric:      'mood',  // gap влияет на все метрики, но главное — настроение
        type:        'gap',
        severity,
        value:       null,
        norm:        null,
        deviation:   null,
        daysAffected: gapDays,
        date:        lastDate.toISOString().split('T')[0],
        message:     gapDays >= 5
          ? `Вы не вводили данные ${gapDays} дней. ML-прогноз значительно снижен по точности.`
          : `Пропуск ${gapDays} дня в данных — прогноз менее точный.`,
      })
    }

    // Качество данных за 14 дней
    const window14 = new Set<string>()
    for (let i = 0; i < 14; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      window14.add(d.toISOString().split('T')[0])
    }

    const daysWithMoodData = new Set(
      (data.mood ?? []).map((r: any) => r.date).filter((d: string) => window14.has(d))
    ).size

    const dataQuality = Math.round((daysWithMoodData / 14) * 100)

    return { anomalies, gapDays, dataQuality }
  }

  // ── Сон ──────────────────────────────────────────────────

  private _detectSleepAnomalies(
    records: { date: string; duration_hours: number; quality: number }[]
  ): Anomaly[] {
    if (records.length < 5) return []

    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
    const anomalies: Anomaly[] = []

    // Личная норма — медиана за последние 30 дней (кроме последних 3)
    
    const baseline  = sorted.slice(0, -3)
    if (baseline.length < 3) return []
    const normHours = this._median(baseline.map(r => r.duration_hours))
    const normQuality = this._median(baseline.map(r => r.quality))

    // Последние 3 дня
    const recent = sorted.slice(-3)
    if (baseline.length < 4) return []
    for (const r of recent) {
      const devHours = normHours > 0 ? (r.duration_hours - normHours) / normHours : 0

      // Резкое падение (drop): спал на 30%+ меньше нормы
      if (devHours < -0.30) {
        anomalies.push({
          metric:    'sleep',
          type:      'drop',
          severity:  devHours < -0.45 ? 'critical' : 'warning',
          value:     r.duration_hours,
          norm:      normHours,
          deviation: Math.round(Math.abs(devHours) * 100),
          date:      r.date,
          message:   `Сон ${r.duration_hours}ч — на ${Math.round(Math.abs(devHours) * 100)}% меньше вашей нормы (${normHours}ч).`,
        })
      }

      // Резкое падение качества
      if (normQuality > 0 && r.quality < normQuality * 0.65) {
        anomalies.push({
          metric:    'sleep',
          type:      'drop',
          severity:  'warning',
          value:     r.quality,
          norm:      normQuality,
          deviation: Math.round(((normQuality - r.quality) / normQuality) * 100),
          date:      r.date,
          message:   `Качество сна ${r.quality}/10 — значительно ниже вашей нормы (${normQuality}/10).`,
        })
      }
    }

    // Тренд: 3 дня подряд ухудшение
    if (recent.length >= 3) {
      const isWorsening =
        recent[0].duration_hours > recent[1].duration_hours &&
        recent[1].duration_hours > recent[2].duration_hours
      if (isWorsening && recent[2].duration_hours < normHours * 0.85) {
        anomalies.push({
          metric:      'sleep',
          type:        'trend',
          severity:    'warning',
          value:       recent[2].duration_hours,
          norm:        normHours,
          deviation:   null,
          daysAffected: 3,
          date:         recent[2].date,
          message:     `Сон ухудшается 3 дня подряд: ${recent.map(r => `${r.duration_hours}ч`).join(' → ')}.`,
        })
      }
    }

    return anomalies
  }

  // ── Стресс ───────────────────────────────────────────────

  private _detectStressAnomalies(
    records: { date: string; level: number }[]
  ): Anomaly[] {
    if (records.length < 5) return []

    const sorted   = [...records].sort((a, b) => a.date.localeCompare(b.date))
    const baseline = sorted.slice(0, -3)
    const normStress = this._median(baseline.map(r => r.level))
    const recent   = sorted.slice(-3)
    const anomalies: Anomaly[] = []
    if (baseline.length < 4) return []
    if (normStress < 2) return []
    for (const r of recent) {
      // Spike: стресс резко вырос (на 3+ единицы от нормы)
      if (r.level - normStress >= 3) {
        anomalies.push({
          metric:    'stress',
          type:      'spike',
          severity:  r.level >= 8 ? 'critical' : 'warning',
          value:     r.level,
          norm:      normStress,
          deviation: Math.round(r.level - normStress),
          date:      r.date,
          message:   `Стресс ${r.level}/10 — на ${Math.round(r.level - normStress)} пункта выше вашей нормы (${normStress}/10).`,
        })
      }
    }

    // Хронический стресс: 5+ дней выше нормы
    const lastFive = sorted.slice(-5)
    if (lastFive.length >= 5 && lastFive.every(r => r.level > normStress + 1.5)) {
      anomalies.push({
        metric:      'stress',
        type:        'trend',
        severity:    'critical',
        value:       this._mean(lastFive.map(r => r.level)),
        norm:        normStress,
        deviation:   null,
        daysAffected: 5,
        date:         lastFive[lastFive.length - 1].date,
        message:     `Стресс повышен уже 5 дней подряд. Среднее ${this._mean(lastFive.map(r => r.level)).toFixed(1)}/10 при вашей норме ${normStress}/10.`,
      })
    }

    return anomalies
  }

  // ── Настроение ────────────────────────────────────────────

  private _detectMoodAnomalies(
    records: { date: string; mood_score: number }[]
  ): Anomaly[] {
    if (records.length < 5) return []

    const sorted   = [...records].sort((a, b) => a.date.localeCompare(b.date))
    const baseline = sorted.slice(0, -3)
    const normMood = this._median(baseline.map(r => r.mood_score))
    const recent   = sorted.slice(-3)
    const anomalies: Anomaly[] = []

    for (const r of recent) {
      // Резкое падение настроения
      if (normMood - r.mood_score >= 2.5) {
        anomalies.push({
          metric:    'mood',
          type:      'drop',
          severity:  r.mood_score <= 3 ? 'critical' : 'warning',
          value:     r.mood_score,
          norm:      normMood,
          deviation: Math.round(normMood - r.mood_score),
          date:      r.date,
          message:   `Настроение ${r.mood_score}/10 — на ${Math.round(normMood - r.mood_score)} пункта ниже вашей нормы (${normMood}/10).`,
        })
      }
    }

    // Тренд вниз 3 дня
    if (recent.length >= 3) {
      const isWorsening =
        recent[0].mood_score > recent[1].mood_score &&
        recent[1].mood_score > recent[2].mood_score
      if (isWorsening && recent[2].mood_score < normMood - 1) {
        anomalies.push({
          metric:      'mood',
          type:        'trend',
          severity:    recent[2].mood_score <= 4 ? 'critical' : 'warning',
          value:       recent[2].mood_score,
          norm:        normMood,
          deviation:   null,
          daysAffected: 3,
          date:         recent[2].date,
          message:     `Настроение падает 3 дня подряд: ${recent.map(r => r.mood_score).join(' → ')}/10.`,
        })
      }
    }

    return anomalies
  }

  // ── Активность ────────────────────────────────────────────

  private _detectActivityAnomalies(
    records: { date: string; duration_minutes: number }[]
  ): Anomaly[] {
    if (records.length < 5) return []

    const sorted     = [...records].sort((a, b) => a.date.localeCompare(b.date))
    const normActive = this._median(sorted.slice(0, -3).map(r => r.duration_minutes))
    const anomalies: Anomaly[] = []

    if (normActive < 10) return []  // пользователь обычно не занимается — нечего сравнивать

    // Overload: резкий скачок нагрузки (в 3+ раза выше нормы)
    const last = sorted[sorted.length - 1]
    if (last.duration_minutes > normActive * 3 && last.duration_minutes > 120) {
      anomalies.push({
        metric:    'activity',
        type:      'spike',
        severity:  'warning',
        value:     last.duration_minutes,
        norm:      normActive,
        deviation: Math.round((last.duration_minutes / normActive - 1) * 100),
        date:      last.date,
        message:   `Резкий рост нагрузки: ${last.duration_minutes} мин — в ${(last.duration_minutes / normActive).toFixed(1)}× выше вашей нормы. Риск перетренированности.`,
      })
    }

    return anomalies
  }

  // ── Вода ─────────────────────────────────────────────────

  private _detectWaterAnomalies(
    records: { date: string; amount_ml: number }[]
  ): Anomaly[] {
    if (records.length < 4) return []

    const sorted   = [...records].sort((a, b) => a.date.localeCompare(b.date))
    const normWater = this._median(sorted.slice(0, -2).map(r => r.amount_ml))
    const anomalies: Anomaly[] = []

    const last = sorted[sorted.length - 1]

    // Критическое обезвоживание: < 1000мл
    if (last.amount_ml < 1000) {
      anomalies.push({
        metric:    'water',
        type:      'drop',
        severity:  'critical',
        value:     last.amount_ml,
        norm:      normWater,
        deviation: Math.round(((normWater - last.amount_ml) / normWater) * 100),
        date:      last.date,
        message:   `Критически мало воды: ${last.amount_ml} мл. Обезвоживание влияет на концентрацию и настроение.`,
      })
    } else if (normWater > 0 && last.amount_ml < normWater * 0.5) {
      anomalies.push({
        metric:    'water',
        type:      'drop',
        severity:  'warning',
        value:     last.amount_ml,
        norm:      normWater,
        deviation: Math.round(((normWater - last.amount_ml) / normWater) * 100),
        date:      last.date,
        message:   `Воды вдвое меньше вашей нормы: ${last.amount_ml} мл против обычных ${normWater} мл.`,
      })
    }

    return anomalies
  }

  // ── Математические helpers ────────────────────────────────

  private _median(values: number[]): number {
    if (!values.length) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid    = Math.floor(sorted.length / 2)
    const result = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
    return Math.round(result * 10) / 10
  }

  private _mean(values: number[]): number {
    if (!values.length) return 0
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
  }
}