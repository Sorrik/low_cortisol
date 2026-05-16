// backend/src/insights/metrics-adapter.ts
//
// Преобразует данные существующего InsightsService → UserMetrics
// для RecommendationRulesService.

import { UserMetrics } from './recommendation-rules.service'

// Типы из существующих entities — подставь свои если отличаются
interface SleepRecord {
  hours?: number
  quality?: number
  date?: string
}
interface NutritionRecord {
  calories?: number
  proteinGrams?: number
  carbsGrams?: number
  fatGrams?: number
  date?: string
}
interface ActivityRecord {
  durationMinutes?: number
  date?: string
}
interface MoodRecord {
  score?: number
  stressLevel?: number
  date?: string
}

export class MetricsAdapter {

  static fromInsightsData(
    sleep:      SleepRecord[],
    nutrition:  NutritionRecord[],
    activity:   ActivityRecord[],
    mood:       MoodRecord[],
    opts?: {
      bodyWeightKg?: number
      goalCalories?: number
      minCalories?:  number
      maxCalories?:  number
      totalDataDays?: number
      personalDailyActivityTarget?: number
      personalProteinTarget?: number
    },
  ): UserMetrics {

    // ── Сон ───────────────────────────────────────────────────
    const sleepHours   = sleep.map(s => s.hours).filter((v): v is number => v != null)
    const sleepQuality = sleep.map(s => s.quality).filter((v): v is number => v != null)

    const avgSleepHours   = MetricsAdapter.avg(sleepHours)
    const avgSleepQuality = MetricsAdapter.avg(sleepQuality)

    // ── Питание ───────────────────────────────────────────────
    const nutritionByDay = MetricsAdapter.groupByDate(nutrition)
    const dailyCalories  = Object.values(nutritionByDay)
      .map(recs => recs.reduce((s, r) => s + (r.calories ?? 0), 0))
    const dailyProtein   = Object.values(nutritionByDay)
      .map(recs => recs.reduce((s, r) => s + (r.proteinGrams ?? 0), 0))
    const dailyCarbs     = Object.values(nutritionByDay)
      .map(recs => recs.reduce((s, r) => s + (r.carbsGrams ?? 0), 0))
    const dailyFat       = Object.values(nutritionByDay)
      .map(recs => recs.reduce((s, r) => s + (r.fatGrams ?? 0), 0))

    const nutritionDays    = dailyCalories.filter(c => c > 0).length
    const avgCalories      = MetricsAdapter.avg(dailyCalories.filter(c => c > 0))
    const avgProteinGrams  = MetricsAdapter.avg(dailyProtein.filter(c => c > 0))
    const avgCarbsGrams    = MetricsAdapter.avg(dailyCarbs.filter(c => c > 0))
    const avgFatGrams      = MetricsAdapter.avg(dailyFat.filter(c => c > 0))

    // ── Активность ────────────────────────────────────────────
    const activityByDay   = MetricsAdapter.groupByDate(activity)
    const dailyActivity   = Object.values(activityByDay)
      .map(recs => recs.reduce((s, r) => s + (r.durationMinutes ?? 0), 0))

    const avgActivityMins = MetricsAdapter.avg(dailyActivity)
    const activeDays      = dailyActivity.filter(d => d > 0).length

    // ── Стресс / Настроение ───────────────────────────────────
    const moodScores    = mood.map(m => m.score).filter((v): v is number => v != null)
    const stressLevels  = mood.map(m => m.stressLevel).filter((v): v is number => v != null)

    const avgMoodScore   = MetricsAdapter.avg(moodScores)
    const avgStressLevel = MetricsAdapter.avg(stressLevels)
    const latestMood     = moodScores[moodScores.length - 1]    ?? avgMoodScore
    const latestStress   = stressLevels[stressLevels.length - 1] ?? avgStressLevel

    // ── Общее кол-во дней ─────────────────────────────────────
    const allDates = [
      ...sleep.map(s => s.date),
      ...nutrition.map(n => n.date),
      ...activity.map(a => a.date),
      ...mood.map(m => m.date),
    ].filter((d): d is string => !!d)
    const uniqueDays   = new Set(allDates.map(d => d.slice(0, 10))).size
    const totalDataDays = opts?.totalDataDays ?? uniqueDays

    return {
      avgCalories:     avgCalories    || 0,
      avgProteinGrams: avgProteinGrams || 0,
      avgCarbsGrams:   avgCarbsGrams  || 0,
      avgFatGrams:     avgFatGrams    || 0,
      nutritionDays:   nutritionDays,

      avgSleepHours:   avgSleepHours  || 0,
      sleepQuality:    avgSleepQuality || 0,

      avgActivityMins: avgActivityMins || 0,
      activeDays:      activeDays,

      avgStressLevel:  avgStressLevel  || 0,
      avgMoodScore:    avgMoodScore    || 0,
      latestMood,
      latestStress,

      totalDataDays,
      bodyWeightKg:    opts?.bodyWeightKg,
      goalCalories:    opts?.goalCalories,
      minCalories:     opts?.minCalories,
      maxCalories:     opts?.maxCalories,
      personalDailyActivityTarget: opts?.personalDailyActivityTarget,
      personalProteinTarget:       opts?.personalProteinTarget,
    }
  }

  // ─── Утилиты ──────────────────────────────────────────────────

  private static avg(arr: number[]): number {
    if (!arr.length) return 0
    return arr.reduce((s, v) => s + v, 0) / arr.length
  }

  private static groupByDate<T extends { date?: string }>(
    records: T[],
  ): Record<string, T[]> {
    return records.reduce<Record<string, T[]>>((acc, r) => {
      const day = (r.date ?? 'unknown').slice(0, 10)
      if (!acc[day]) acc[day] = []
      acc[day].push(r)
      return acc
    }, {})
  }
}