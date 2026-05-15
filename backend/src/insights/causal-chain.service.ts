// backend/src/insights/causal-chain.service.ts
//
// CausalChainService — детектирование причинно-следственных цепочек между
// метриками пользователя. См. план:
//   design notes
//
// Сервис ищет в данных пользователя 16 паттернов (A1..F2) вида
// «триггер → (посредник) → исход» с конкретными датами и значениями.
// Результат передаётся в LLM-prompt как фактическая основа для текста
// рекомендации — это разрывает старый паттерн «среднее по метрике X — Y».

import { Injectable, Logger } from '@nestjs/common'

import type { ConsistencySnapshot } from './consistency.service'
import {
  CausalChain,
  CausalChainsResult,
  CausalChainStep,
  ChainStrength,
} from './causal-chain.types'

// ────────────────────────────────────────────────────────────────────
// Внешние типы (совпадают со структурой HealthData в insights.service)
// ────────────────────────────────────────────────────────────────────

interface SleepRecord {
  date: string
  duration_hours: number
  quality: number
  interruptions?: number | null
  bed_time?: string | null
  wake_time?: string | null
}

interface MoodRecord {
  date: string
  mood_score: number
}

interface StressRecord {
  date: string
  level: number
}

interface ActivityRecord {
  date: string
  duration_minutes: number
  intensity: string  // 'light' | 'moderate' | 'vigorous'
  time?: string | null
}

interface WaterRecord {
  date: string
  amount_ml: number
}

interface NutritionRecord {
  date: string
  calories: number
  protein_grams: number
  carbs_grams: number
  fat_grams: number
  time?: string | null
}

export interface CausalChainHealthData {
  sleep:     SleepRecord[]
  mood:      MoodRecord[]
  stress:    StressRecord[]
  activity:  ActivityRecord[]
  water:     WaterRecord[]
  nutrition: NutritionRecord[]
}

export interface CausalChainUserProfile {
  sleepGoalHours?: number | null
  baselineStress?: number | null
  /** Точная масса тела — основа персональных порогов воды и белка. */
  weightKg?: number | null
  /**
   * Персональные пороги калорий (Mifflin-St Jeor + nutritionGoal).
   * Если переданы — детекторы A3/E2 используют их вместо хардкода 1500 ккал.
   */
  calorieTargets?: {
    targetCalories: number
    minCalories:    number
    maxCalories:    number
  } | null
}

export interface CausalChainDetectOptions {
  consistencyFlags?: ConsistencySnapshot['flags']
  /** Лимит итогового набора. По умолчанию 5. */
  topN?: number
}

/**
 * Персональные пороги, выведенные из профиля. Если соответствующее поле
 * не заполнено — используются разумные дефолты, чтобы детекторы продолжали
 * работать на «холодных» аккаунтах.
 */
interface PersonalThresholds {
  /**
   * Минимально приемлемое суточное потребление калорий — ниже считаем
   * дефицитом. Берётся из calorieTargets.minCalories (это 0.85×target),
   * fallback 1500 ккал (нижняя клиническая граница для взрослого).
   */
  minCalories: number
  /**
   * Целевое суточное потребление — для расчёта серьёзного дефицита (×0.7).
   */
  targetCalories: number
  /**
   * Минимум белка в граммах за день. ~1.0 г/кг массы тела —
   * нижняя граница для не-спортивных нагрузок (RDA 0.8, рекомендуем 1.0).
   * Fallback 60 г при отсутствии веса.
   */
  proteinMin: number
  /**
   * Минимум воды в мл за день. 30 мл/кг — стандарт для умеренных климатов,
   * fallback 1500 мл (нижняя граница без учёта тела).
   */
  waterMin: number
}

function buildPersonalThresholds(profile: CausalChainUserProfile): PersonalThresholds {
  const weight = profile.weightKg && profile.weightKg > 0 ? profile.weightKg : null
  const target = profile.calorieTargets?.targetCalories ?? 2000
  const minCal = profile.calorieTargets?.minCalories   ?? 1500
  return {
    minCalories:    minCal,
    targetCalories: target,
    proteinMin:     weight ? Math.max(60, Math.round(weight * 1.0)) : 60,
    waterMin:       weight ? Math.max(1500, Math.round(weight * 30)) : 1500,
  }
}

// ────────────────────────────────────────────────────────────────────
// Внутренние типы
// ────────────────────────────────────────────────────────────────────

interface DailyAggregate {
  date: string
  // sleep
  sleepHours: number | null
  sleepQuality: number | null
  sleepInterruptions: number | null
  bedHour: number | null     // 0..24, ночь после 21 → 21..24, до 04 → 24..28 для непрерывности
  // mood
  mood: number | null
  // stress
  stress: number | null      // дневной максимум, как наиболее показательный
  // activity
  activityMinutes: number | null
  activityVigorousMinutes: number | null
  eveningVigorousFlag: boolean
  // nutrition
  totalCalories: number | null
  totalProtein: number | null   // суммарный белок за день, граммы
  totalFat: number | null
  lateMealCalories: number      // ккал в приёмах после 21:00 (того же дня)
  lateMealFat: number           // граммы жира в этих приёмах
  lateMealFlag: boolean
  // water
  waterMl: number | null
}

interface Baselines {
  normSleepHours: number | null
  normSleepQuality: number | null
  normStress: number | null
  normMood: number | null
  normWaterMl: number | null
  bedHourStd7d: number | null
}

interface ChainContext {
  /** Все дни за окно, отсортированы по дате asc. */
  days: DailyAggregate[]
  /** Быстрый доступ по дате. */
  byDate: Map<string, DailyAggregate>
  baselines: Baselines
  profile: CausalChainUserProfile
  /** Персональные пороги, выведенные из профиля (см. buildPersonalThresholds). */
  personal: PersonalThresholds
  consistencyFlags?: ConsistencySnapshot['flags']
}

// ────────────────────────────────────────────────────────────────────
// Утилиты
// ────────────────────────────────────────────────────────────────────

function median(values: number[]): number {
  const finite = values.filter(v => Number.isFinite(v))
  if (finite.length === 0) return 0
  const sorted = [...finite].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function stddev(values: number[]): number {
  const finite = values.filter(v => Number.isFinite(v))
  if (finite.length < 2) return 0
  const m = finite.reduce((s, v) => s + v, 0) / finite.length
  const variance = finite.reduce((s, v) => s + (v - m) ** 2, 0) / finite.length
  return Math.sqrt(variance)
}

function parseHourFromTime(t: string | null | undefined): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  if (!Number.isFinite(h)) return null
  return h + (Number.isFinite(m) ? m / 60 : 0)
}

/** Bed-hour с непрерывностью через полночь: 23:00 → 23, 01:30 → 25.5. */
function bedHourContinuous(bedTime: string | null | undefined): number | null {
  const h = parseHourFromTime(bedTime)
  if (h === null) return null
  return h < 12 ? h + 24 : h
}

function intensityRank(intensity: string): number {
  if (intensity === 'vigorous' || intensity === 'high') return 3
  if (intensity === 'moderate') return 2
  return 1
}

function previousDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function lastNDays<T extends { date: string }>(records: T[], n: number): T[] {
  return [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-n)
}

function roundTo(value: number, decimals = 1): number {
  const k = 10 ** decimals
  return Math.round(value * k) / k
}

function formatHour(hour: number): string {
  const norm = hour >= 24 ? hour - 24 : hour
  const hh = Math.floor(norm)
  const mm = Math.round((norm - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function ruDate(iso: string): string {
  // YYYY-MM-DD -> DD.MM
  if (iso.length < 10) return iso
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`
}

// ────────────────────────────────────────────────────────────────────
// Сервис
// ────────────────────────────────────────────────────────────────────

@Injectable()
export class CausalChainService {
  private readonly logger = new Logger(CausalChainService.name)

  /** Минимум данных для срабатывания cross-temporal детекторов. */
  private readonly MIN_DAYS_FOR_DETECTOR = 5

  detect(
    healthData: CausalChainHealthData,
    profile: CausalChainUserProfile,
    opts: CausalChainDetectOptions = {},
  ): CausalChainsResult {
    const ctx = this._buildContext(healthData, profile, opts)
    const topN = opts.topN ?? 5

    if (ctx.days.length < this.MIN_DAYS_FOR_DETECTOR) {
      return { chains: [], detectedCount: 0 }
    }

    const detectors: Array<(c: ChainContext) => CausalChain | null> = [
      // Группа A: питание → сон → настроение
      ctx => this._detectA1(ctx),
      ctx => this._detectA2(ctx),
      ctx => this._detectA3(ctx),
      ctx => this._detectA4(ctx),
      // Группа B: активность → сон / восстановление
      ctx => this._detectB1(ctx),
      ctx => this._detectB2(ctx),
      ctx => this._detectB3(ctx),
      // Группа C: сон → стресс / настроение (циркадные)
      ctx => this._detectC1(ctx),
      ctx => this._detectC2(ctx),
      ctx => this._detectC3(ctx),
      // Группа D: стресс → сон / питание (поведенческие)
      ctx => this._detectD1(ctx),
      ctx => this._detectD2(ctx),
      ctx => this._detectD3(ctx),
      // Группа E: вода / энергия
      ctx => this._detectE1(ctx),
      ctx => this._detectE2(ctx),
      // Группа F: положительные паттерны
      ctx => this._detectF1(ctx),
      ctx => this._detectF2(ctx),
    ]

    const detected: CausalChain[] = []
    for (const detector of detectors) {
      try {
        const chain = detector(ctx)
        if (chain) detected.push(chain)
      } catch (err) {
        // Один сбойный детектор не должен ронять всю выдачу.
        this.logger.warn(`[causal] detector failed: ${err}`)
      }
    }

    detected.sort((a, b) => b.priority - a.priority)
    const chains = detected.slice(0, topN)

    this.logger.log(
      `[causal] detected ${detected.length}, returned ${chains.length}: ` +
      chains.map(c => `${c.chainId}/${c.strength}`).join(', '),
    )

    return { chains, detectedCount: detected.length }
  }

  // ──────────────────────────────────────────────────────────────────
  // Context builder
  // ──────────────────────────────────────────────────────────────────

  private _buildContext(
    healthData: CausalChainHealthData,
    profile: CausalChainUserProfile,
    opts: CausalChainDetectOptions,
  ): ChainContext {
    // Собираем все уникальные даты
    const dateSet = new Set<string>()
    for (const r of healthData.sleep)     dateSet.add(r.date)
    for (const r of healthData.mood)      dateSet.add(r.date)
    for (const r of healthData.stress)    dateSet.add(r.date)
    for (const r of healthData.activity)  dateSet.add(r.date)
    for (const r of healthData.water)     dateSet.add(r.date)
    for (const r of healthData.nutrition) dateSet.add(r.date)

    const dates = [...dateSet].sort()
    const days: DailyAggregate[] = dates.map(date =>
      this._aggregateDay(date, healthData),
    )

    const byDate = new Map<string, DailyAggregate>()
    for (const d of days) byDate.set(d.date, d)

    return {
      days,
      byDate,
      baselines: this._buildBaselines(days),
      profile,
      personal: buildPersonalThresholds(profile),
      consistencyFlags: opts.consistencyFlags,
    }
  }

  private _aggregateDay(
    date: string,
    h: CausalChainHealthData,
  ): DailyAggregate {
    const sleep = h.sleep.find(r => r.date === date) ?? null

    const moodRec = h.mood.find(r => r.date === date) ?? null

    const stressRecs = h.stress.filter(r => r.date === date)
    const stressDaily = stressRecs.length
      ? Math.max(...stressRecs.map(r => r.level))
      : null

    const activityRecs = h.activity.filter(r => r.date === date)
    const activityMinutes = activityRecs.length
      ? activityRecs.reduce((s, r) => s + (r.duration_minutes || 0), 0)
      : null
    const activityVigorousMinutes = activityRecs
      .filter(r => intensityRank(r.intensity) >= 3)
      .reduce((s, r) => s + (r.duration_minutes || 0), 0)
    const eveningVigorousFlag = activityRecs.some(r => {
      const hour = parseHourFromTime(r.time)
      return intensityRank(r.intensity) >= 3 && hour !== null && hour >= 19
    })

    const nutritionRecs = h.nutrition.filter(r => r.date === date)
    const totalCalories = nutritionRecs.length
      ? nutritionRecs.reduce((s, r) => s + (r.calories || 0), 0)
      : null
    const totalProtein = nutritionRecs.length
      ? nutritionRecs.reduce((s, r) => s + (r.protein_grams || 0), 0)
      : null
    const totalFat = nutritionRecs.length
      ? nutritionRecs.reduce((s, r) => s + (r.fat_grams || 0), 0)
      : null
    const lateMealRecs = nutritionRecs.filter(r => {
      const hour = parseHourFromTime(r.time)
      return hour !== null && hour >= 21
    })
    const lateMealCalories = lateMealRecs.reduce((s, r) => s + (r.calories || 0), 0)
    const lateMealFat = lateMealRecs.reduce((s, r) => s + (r.fat_grams || 0), 0)
    const lateMealFlag = lateMealCalories > 0

    const waterRecs = h.water.filter(r => r.date === date)
    const waterMl = waterRecs.length
      ? waterRecs.reduce((s, r) => s + (r.amount_ml || 0), 0)
      : null

    return {
      date,
      sleepHours:                sleep?.duration_hours ?? null,
      sleepQuality:              sleep?.quality ?? null,
      sleepInterruptions:        sleep?.interruptions ?? null,
      bedHour:                   bedHourContinuous(sleep?.bed_time),
      mood:                      moodRec?.mood_score ?? null,
      stress:                    stressDaily,
      activityMinutes,
      activityVigorousMinutes,
      eveningVigorousFlag,
      totalCalories,
      totalProtein,
      totalFat,
      lateMealCalories,
      lateMealFat,
      lateMealFlag,
      waterMl,
    }
  }

  private _buildBaselines(days: DailyAggregate[]): Baselines {
    // Берём последние 30 дней, исключая последние 3 (recent), как в anomaly-detection.
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
    const window = sorted.slice(-33, -3)

    const pick = (selector: (d: DailyAggregate) => number | null): number[] =>
      window
        .map(selector)
        .filter((v): v is number => v !== null && Number.isFinite(v) && v > 0)

    const last7 = sorted.slice(-7)
    const bedHours7 = last7
      .map(d => d.bedHour)
      .filter((v): v is number => v !== null)

    return {
      normSleepHours:   median(pick(d => d.sleepHours))   || null,
      normSleepQuality: median(pick(d => d.sleepQuality)) || null,
      normStress:       median(pick(d => d.stress))       || null,
      normMood:         median(pick(d => d.mood))         || null,
      normWaterMl:      median(pick(d => d.waterMl))      || null,
      bedHourStd7d:     bedHours7.length >= 3 ? stddev(bedHours7) : null,
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Хелперы детекторов
  // ──────────────────────────────────────────────────────────────────

  /** Дни с любыми данными по двум метриками за окно — для оценки покрытия. */
  private _coverage(
    ctx: ChainContext,
    days: number,
    selectors: Array<(d: DailyAggregate) => number | null>,
  ): number {
    const window = ctx.days.slice(-days)
    if (!window.length) return 0
    const covered = window.filter(d =>
      selectors.every(s => {
        const v = s(d)
        return v !== null && Number.isFinite(v)
      }),
    ).length
    return covered / window.length
  }

  private _strengthFor(
    margin: number,
    coverage: number,
    consistencyHit: boolean,
  ): ChainStrength {
    if (consistencyHit) return 'weak'
    if (coverage < 0.7) return 'weak'
    if (margin >= 0.3 && coverage >= 0.8) return 'strong'
    return 'moderate'
  }

  private _today(ctx: ChainContext): DailyAggregate | null {
    return ctx.days.length ? ctx.days[ctx.days.length - 1] : null
  }

  private _yesterday(ctx: ChainContext): DailyAggregate | null {
    const today = this._today(ctx)
    if (!today) return null
    const prevDate = previousDate(today.date)
    return ctx.byDate.get(prevDate) ?? null
  }

  // ──────────────────────────────────────────────────────────────────
  // ГРУППА A — Питание → Сон → Настроение
  // ──────────────────────────────────────────────────────────────────

  /**
   * A1: late_meal_flag[t-1]=1 И fat_ratio[t-1]>0.35 И sleep_quality[t] < normQ*0.8
   * «Вчера в 22:30 ужин 650 ккал, 30г жира → сегодня сон 4.5ч, качество 4/10».
   */
  private _detectA1(ctx: ChainContext): CausalChain | null {
    const today = this._today(ctx)
    const yest = this._yesterday(ctx)
    if (!today || !yest) return null
    if (!yest.lateMealFlag || yest.lateMealCalories < 300) return null
    const fatRatio = yest.totalCalories
      ? (yest.lateMealFat * 9) / yest.lateMealCalories
      : 0
    if (fatRatio < 0.35) return null
    const normQ = ctx.baselines.normSleepQuality
    if (today.sleepQuality === null || !normQ) return null
    if (today.sleepQuality >= normQ * 0.8) return null

    const margin = Math.min(
      (yest.lateMealCalories - 300) / 300,
      (normQ * 0.8 - today.sleepQuality) / (normQ * 0.8),
    )
    const coverage = this._coverage(ctx, 7, [d => d.sleepQuality, d => d.totalCalories])
    const strength = this._strengthFor(
      margin,
      coverage,
      Boolean(ctx.consistencyFlags?.sleep),
    )

    const trigger: CausalChainStep = {
      metric:      'nutrition',
      date:        yest.date,
      value:       yest.lateMealCalories,
      unit:        'ккал',
      description: `поздний ужин ${Math.round(yest.lateMealCalories)} ккал, ${Math.round(yest.lateMealFat)}г жира (${ruDate(yest.date)} после 21:00)`,
    }
    const outcome: CausalChainStep = {
      metric:      'sleep',
      date:        today.date,
      value:       today.sleepQuality,
      unit:        '/10',
      description: `качество сна ${today.sleepQuality}/10${today.sleepHours ? `, длительность ${roundTo(today.sleepHours)}ч` : ''} (${ruDate(today.date)})`,
    }

    return {
      chainId:        'A1',
      category:       'nutrition_sleep',
      strength,
      trigger,
      outcome,
      lagDescription: 'вчера → сегодня',
      mechanism:      'жирная еда после 21:00 → пик инсулина и ночного кортизола → фрагментированный REM',
      recommendation: `Вчера поздний ужин (${Math.round(yest.lateMealCalories)} ккал, ${Math.round(yest.lateMealFat)}г жира) → сегодня качество сна ${today.sleepQuality}/10. На неделе сдвинь ужин на до 20:00.`,
      priority:       strength === 'strong' ? 92 : strength === 'moderate' ? 80 : 60,
      tags:           ['nutrition', 'sleep', 'cortisol', 'lag-1'],
    }
  }

  /**
   * A2: late_meal_days_14d ≥ 3 И sleep_q_7d_mean < 6
   * Хронический паттерн ночного кортизола.
   */
  private _detectA2(ctx: ChainContext): CausalChain | null {
    const last14 = ctx.days.slice(-14)
    if (last14.length < 7) return null
    const lateMealDays = last14.filter(d => d.lateMealFlag).length
    if (lateMealDays < 3) return null

    const last7 = ctx.days.slice(-7)
    const sleepQValues = last7
      .map(d => d.sleepQuality)
      .filter((v): v is number => v !== null)
    if (sleepQValues.length < 4) return null
    const avgSleepQ = sleepQValues.reduce((s, v) => s + v, 0) / sleepQValues.length
    if (avgSleepQ >= 6) return null

    const today = this._today(ctx)
    if (!today) return null

    const margin = Math.min((lateMealDays - 3) / 3, (6 - avgSleepQ) / 6)
    const coverage = this._coverage(ctx, 14, [d => d.sleepQuality])
    const strength = this._strengthFor(
      margin,
      coverage,
      Boolean(ctx.consistencyFlags?.sleep),
    )

    return {
      chainId:        'A2',
      category:       'nutrition_sleep',
      strength,
      trigger: {
        metric:      'nutrition',
        date:        today.date,
        value:       lateMealDays,
        unit:        'дней',
        description: `${lateMealDays} поздних ужинов после 21:00 за 14 дней`,
      },
      outcome: {
        metric:      'sleep',
        date:        today.date,
        value:       roundTo(avgSleepQ),
        unit:        '/10',
        description: `среднее качество сна ${roundTo(avgSleepQ)}/10 за 7 дней`,
      },
      lagDescription: 'за 14 дней',
      mechanism:      'хронический паттерн ночного кортизола',
      recommendation: `За 14 дней — ${lateMealDays} поздних ужинов. Среднее качество сна ${roundTo(avgSleepQ)}/10. Сдвиг ужина на 19:30–20:00 даёт измеримый прирост качества.`,
      priority:       strength === 'strong' ? 78 : 65,
      tags:           ['nutrition', 'sleep', 'chronic'],
    }
  }

  /**
   * A3: calories[t-1] < personal.minCalories*0.7 И mood[t] < normMood-1.5
   * Дневная гипогликемия → раздражительность утром.
   *
   * Порог дефицита персональный: для маленькой женщины с TDEE 1700
   * это будет ~1190 ккал, для крупного мужчины с TDEE 2800 — ~1700 ккал.
   * Без этого общий порог 1500 ккал «работает» только на среднего юзера.
   */
  private _detectA3(ctx: ChainContext): CausalChain | null {
    const today = this._today(ctx)
    const yest = this._yesterday(ctx)
    if (!today || !yest) return null
    const severeDeficit = ctx.personal.minCalories * 0.7
    if (yest.totalCalories === null || yest.totalCalories >= severeDeficit) return null
    if (today.mood === null) return null
    const normMood = ctx.baselines.normMood
    if (!normMood || today.mood >= normMood - 1.5) return null

    const deficit = Math.max(0, ctx.personal.minCalories - yest.totalCalories)
    const margin = Math.min(
      (severeDeficit - yest.totalCalories) / severeDeficit,
      (normMood - 1.5 - today.mood) / Math.max(normMood, 1),
    )
    const coverage = this._coverage(ctx, 7, [d => d.totalCalories, d => d.mood])
    const strength = this._strengthFor(margin, coverage, false)

    return {
      chainId:        'A3',
      category:       'nutrition_mood',
      strength,
      trigger: {
        metric:      'nutrition',
        date:        yest.date,
        value:       yest.totalCalories,
        unit:        'ккал',
        description: `${Math.round(yest.totalCalories)} ккал — дефицит ${Math.round(deficit)} ккал от вашей нормы ${ctx.personal.minCalories} (${ruDate(yest.date)})`,
      },
      outcome: {
        metric:      'mood',
        date:        today.date,
        value:       today.mood,
        unit:        '/10',
        description: `настроение ${today.mood}/10 при норме ${roundTo(normMood)}/10 (${ruDate(today.date)})`,
      },
      lagDescription: 'вчера → сегодня',
      mechanism:      'дневная гипогликемия → раздражительность и спад настроения утром',
      recommendation: `Вчера сильный дефицит калорий → сегодня настроение ${today.mood}/10. Добавь белковый завтрак ≥25г белка до 10:00.`,
      priority:       strength === 'strong' ? 80 : 65,
      tags:           ['nutrition', 'mood', 'lag-1'],
    }
  }

  /**
   * A4: protein avg < personal.proteinMin И mood_7d_mean < 5 (same-day window).
   * Дефицит триптофана/тирозина → ↓серотонин/дофамин.
   *
   * Порог белка персональный: ~1.0 г/кг массы тела (для 70 кг — 70 г),
   * fallback 60 г при отсутствии веса. RDA — 0.8 г/кг, но для активности
   * и психического здоровья нижняя клиническая граница 1.0.
   */
  private _detectA4(ctx: ChainContext): CausalChain | null {
    const last7 = ctx.days.slice(-7)
    if (last7.length < 5) return null

    const proteinVals = last7
      .map(d => d.totalProtein)
      .filter((v): v is number => v !== null && Number.isFinite(v))
    const moodVals = last7
      .map(d => d.mood)
      .filter((v): v is number => v !== null && Number.isFinite(v))
    if (proteinVals.length < 4 || moodVals.length < 4) return null

    const avgProtein = proteinVals.reduce((s, v) => s + v, 0) / proteinVals.length
    const avgMood    = moodVals.reduce((s, v) => s + v, 0) / moodVals.length

    const proteinTarget = ctx.personal.proteinMin
    if (avgProtein >= proteinTarget || avgMood >= 5) return null

    const margin = Math.min((proteinTarget - avgProtein) / proteinTarget, (5 - avgMood) / 5)
    const coverage = this._coverage(ctx, 7, [d => d.totalProtein, d => d.mood])
    const strength = this._strengthFor(margin, coverage, false)

    const today = this._today(ctx)
    if (!today) return null

    return {
      chainId:        'A4',
      category:       'nutrition_mood',
      strength,
      trigger: {
        metric:      'nutrition',
        date:        today.date,
        value:       Math.round(avgProtein),
        unit:        'г/день',
        description: `белок ${Math.round(avgProtein)}г/день при вашей норме ${proteinTarget}г (за 7 дней)`,
      },
      outcome: {
        metric:      'mood',
        date:        today.date,
        value:       roundTo(avgMood),
        unit:        '/10',
        description: `среднее настроение ${roundTo(avgMood)}/10 за 7 дней`,
      },
      lagDescription: 'за 7 дней',
      mechanism:      'дефицит триптофана/тирозина → ↓серотонин/дофамин',
      recommendation: `Белок ${Math.round(avgProtein)}г/день при норме ${proteinTarget}г, настроение ${roundTo(avgMood)}/10. Добавь 2 яйца (12г) + творог 100г (15г) на завтрак — это +27г белка в самое нужное время суток.`,
      priority:       strength === 'strong' ? 76 : 62,
      tags:           ['nutrition', 'mood', 'protein', 'chronic'],
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // ГРУППА B — Активность → Сон / Восстановление
  // ──────────────────────────────────────────────────────────────────

  /**
   * B1: evening_vigorous_flag[t-1]=1 И sleep_quality[t] < normQ-2
   */
  private _detectB1(ctx: ChainContext): CausalChain | null {
    const today = this._today(ctx)
    const yest = this._yesterday(ctx)
    if (!today || !yest) return null
    if (!yest.eveningVigorousFlag) return null
    const normQ = ctx.baselines.normSleepQuality
    if (today.sleepQuality === null || !normQ) return null
    if (today.sleepQuality >= normQ - 2) return null

    const margin = (normQ - 2 - today.sleepQuality) / Math.max(normQ, 1)
    const coverage = this._coverage(ctx, 7, [d => d.sleepQuality])
    const strength = this._strengthFor(
      margin,
      coverage,
      Boolean(ctx.consistencyFlags?.sleep),
    )

    return {
      chainId:        'B1',
      category:       'activity_sleep',
      strength,
      trigger: {
        metric:      'activity',
        date:        yest.date,
        value:       yest.activityVigorousMinutes ?? 0,
        unit:        'мин',
        description: `интенсивная тренировка после 19:00 — ${yest.activityVigorousMinutes ?? '?'} мин (${ruDate(yest.date)})`,
      },
      outcome: {
        metric:      'sleep',
        date:        today.date,
        value:       today.sleepQuality,
        unit:        '/10',
        description: `качество сна ${today.sleepQuality}/10${today.sleepHours ? `, длительность ${roundTo(today.sleepHours)}ч` : ''} (${ruDate(today.date)})`,
      },
      lagDescription: 'вчера → сегодня',
      mechanism:      'CNS-стимуляция и повышенная температура тела ночью',
      recommendation: `Вчера интенсивная тренировка вечером → сегодня качество сна ${today.sleepQuality}/10. Перенеси на до 18:00 или замени на moderate.`,
      priority:       strength === 'strong' ? 85 : 70,
      tags:           ['activity', 'sleep', 'circadian', 'lag-1'],
    }
  }

  /**
   * B2: activity_min_7d>60 И sleep_h_7d<6.5 И stress_7d>6
   * Перетренированность.
   */
  private _detectB2(ctx: ChainContext): CausalChain | null {
    const last7 = ctx.days.slice(-7)
    if (last7.length < 5) return null

    const actVals = last7.map(d => d.activityMinutes).filter((v): v is number => v !== null)
    const sleepVals = last7.map(d => d.sleepHours).filter((v): v is number => v !== null)
    const stressVals = last7.map(d => d.stress).filter((v): v is number => v !== null)
    if (actVals.length < 4 || sleepVals.length < 4 || stressVals.length < 4) return null

    const avgAct = actVals.reduce((s, v) => s + v, 0) / actVals.length
    const avgSleep = sleepVals.reduce((s, v) => s + v, 0) / sleepVals.length
    const avgStress = stressVals.reduce((s, v) => s + v, 0) / stressVals.length

    if (avgAct <= 60 || avgSleep >= 6.5 || avgStress <= 6) return null

    const margin = Math.min(
      (avgAct - 60) / 60,
      (6.5 - avgSleep) / 6.5,
      (avgStress - 6) / 6,
    )
    const coverage = this._coverage(ctx, 7, [d => d.activityMinutes, d => d.sleepHours, d => d.stress])
    const strength = this._strengthFor(margin, coverage, false)

    const today = this._today(ctx)
    if (!today) return null

    return {
      chainId:        'B2',
      category:       'activity_sleep',
      strength,
      trigger: {
        metric:      'activity',
        date:        today.date,
        value:       Math.round(avgAct),
        unit:        'мин/день',
        description: `${Math.round(avgAct)} мин/день нагрузки за 7 дней`,
      },
      mediator: {
        metric:      'sleep',
        date:        today.date,
        value:       roundTo(avgSleep),
        unit:        'ч',
        description: `сон ${roundTo(avgSleep)}ч за 7 дней`,
      },
      outcome: {
        metric:      'stress',
        date:        today.date,
        value:       roundTo(avgStress),
        unit:        '/10',
        description: `стресс ${roundTo(avgStress)}/10 за 7 дней`,
      },
      lagDescription: 'за 7 дней',
      mechanism:      'перетренированность без восстановления',
      recommendation: `За 7 дней: ${Math.round(avgAct)} мин/день, сон ${roundTo(avgSleep)}ч, стресс ${roundTo(avgStress)}/10. Снизь объём на 30% (~${Math.round(avgAct * 0.3)} мин) на 3 дня.`,
      priority:       strength === 'strong' ? 88 : 72,
      tags:           ['activity', 'sleep', 'stress', 'overtraining'],
    }
  }

  /**
   * B3: activity_min[t]>90 И water_ml[t]<personal.waterMin
   * Порог воды персональный: 30 мл/кг массы тела.
   */
  private _detectB3(ctx: ChainContext): CausalChain | null {
    const today = this._today(ctx)
    if (!today) return null
    if (today.activityMinutes === null || today.activityMinutes <= 90) return null
    const waterMin = ctx.personal.waterMin
    if (today.waterMl === null || today.waterMl >= waterMin) return null

    const margin = Math.min(
      (today.activityMinutes - 90) / 90,
      (waterMin - today.waterMl) / waterMin,
    )
    const coverage = 1.0
    const strength = this._strengthFor(margin, coverage, false)

    return {
      chainId:        'B3',
      category:       'activity_hydration',
      strength,
      trigger: {
        metric:      'activity',
        date:        today.date,
        value:       today.activityMinutes,
        unit:        'мин',
        description: `${today.activityMinutes} мин тренировки (${ruDate(today.date)})`,
      },
      outcome: {
        metric:      'water',
        date:        today.date,
        value:       today.waterMl,
        unit:        'мл',
        description: `${today.waterMl} мл воды — на ${waterMin - today.waterMl} мл ниже вашей нормы ${waterMin} мл`,
      },
      lagDescription: 'тот же день',
      mechanism:      'дегидратация после нагрузки',
      recommendation: `Сегодня ${today.activityMinutes} мин тренировки при ${today.waterMl} мл воды (норма ${waterMin}). Стакан каждый час остаток дня + 500 мл сразу после следующей тренировки.`,
      priority:       strength === 'strong' ? 76 : 60,
      tags:           ['activity', 'water', 'hydration'],
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // ГРУППА C — Сон → Стресс / Настроение (циркадные)
  // ──────────────────────────────────────────────────────────────────

  /**
   * C1: sleep_h[t-1]<5.5 И stress[t]>normStress+2
   */
  private _detectC1(ctx: ChainContext): CausalChain | null {
    const today = this._today(ctx)
    const yest = this._yesterday(ctx)
    if (!today || !yest) return null
    if (yest.sleepHours === null || yest.sleepHours >= 5.5) return null
    if (today.stress === null) return null
    const normStress = ctx.baselines.normStress ?? ctx.profile.baselineStress ?? 5
    if (today.stress <= normStress + 2) return null

    const margin = Math.min(
      (5.5 - yest.sleepHours) / 5.5,
      (today.stress - normStress - 2) / Math.max(normStress, 1),
    )
    const coverage = this._coverage(ctx, 7, [d => d.sleepHours, d => d.stress])
    const strength = this._strengthFor(
      margin,
      coverage,
      Boolean(ctx.consistencyFlags?.stress),
    )

    return {
      chainId:        'C1',
      category:       'sleep_stress',
      strength,
      trigger: {
        metric:      'sleep',
        date:        yest.date,
        value:       roundTo(yest.sleepHours),
        unit:        'ч',
        description: `сон ${roundTo(yest.sleepHours)}ч (${ruDate(yest.date)})`,
      },
      outcome: {
        metric:      'stress',
        date:        today.date,
        value:       today.stress,
        unit:        '/10',
        description: `стресс ${today.stress}/10 при норме ${roundTo(normStress)} (${ruDate(today.date)})`,
      },
      lagDescription: 'вчера → сегодня',
      mechanism:      'недосып → ↑утренний кортизол → ↑стресс-реактивность',
      recommendation: `Вчера сон ${roundTo(yest.sleepHours)}ч → сегодня стресс ${today.stress}/10. Сегодня отбой в 22:00, без экранов с 21:30.`,
      priority:       strength === 'strong' ? 90 : 75,
      tags:           ['sleep', 'stress', 'cortisol', 'lag-1'],
    }
  }

  /**
   * C2: bed_hour_std_7d > 1.5h И mood_7d_mean < 5.5
   * Нерегулярный циркадный ритм.
   */
  private _detectC2(ctx: ChainContext): CausalChain | null {
    const std = ctx.baselines.bedHourStd7d
    if (std === null || std <= 1.5) return null

    const last7 = ctx.days.slice(-7)
    const moodVals = last7.map(d => d.mood).filter((v): v is number => v !== null)
    if (moodVals.length < 4) return null
    const avgMood = moodVals.reduce((s, v) => s + v, 0) / moodVals.length
    if (avgMood >= 5.5) return null

    const today = this._today(ctx)
    if (!today) return null

    const bedHours = last7.map(d => d.bedHour).filter((v): v is number => v !== null)
    const avgBed = bedHours.length
      ? bedHours.reduce((s, v) => s + v, 0) / bedHours.length
      : 23
    const stdMin = Math.round(std * 60)

    const margin = Math.min((std - 1.5) / 1.5, (5.5 - avgMood) / 5.5)
    const coverage = this._coverage(ctx, 7, [d => d.mood, d => d.bedHour])
    const strength = this._strengthFor(margin, coverage, false)

    return {
      chainId:        'C2',
      category:       'sleep_mood',
      strength,
      trigger: {
        metric:      'sleep',
        date:        today.date,
        value:       stdMin,
        unit:        'мин',
        description: `разброс времени отбоя ±${stdMin} мин (среднее ~${formatHour(avgBed)}) за 7 дней`,
      },
      outcome: {
        metric:      'mood',
        date:        today.date,
        value:       roundTo(avgMood),
        unit:        '/10',
        description: `среднее настроение ${roundTo(avgMood)}/10 за 7 дней`,
      },
      lagDescription: 'за 7 дней',
      mechanism:      'нерегулярный циркадный ритм → дизрегуляция кортизола',
      recommendation: `За неделю отбой ±${stdMin} мин, настроение ${roundTo(avgMood)}/10. Фиксированный отбой в одно время ±30 мин — самый дешёвый рычаг.`,
      priority:       strength === 'strong' ? 78 : 64,
      tags:           ['sleep', 'mood', 'circadian'],
    }
  }

  /**
   * C3: sleep_h<5.5 три дня подряд И mood[t] < normMood-1.5
   */
  private _detectC3(ctx: ChainContext): CausalChain | null {
    const last4 = ctx.days.slice(-4)
    if (last4.length < 4) return null
    const last3 = last4.slice(-4, -1)  // позавчера-1, позавчера, вчера
    if (last3.some(d => d.sleepHours === null || d.sleepHours >= 5.5)) return null

    const today = this._today(ctx)
    if (!today || today.mood === null) return null
    const normMood = ctx.baselines.normMood
    if (!normMood || today.mood >= normMood - 1.5) return null

    const sequence = last3.map(d => `${roundTo(d.sleepHours!)}ч`).join('→')
    const margin = (normMood - 1.5 - today.mood) / Math.max(normMood, 1)
    const coverage = this._coverage(ctx, 7, [d => d.sleepHours, d => d.mood])
    const strength = this._strengthFor(margin, coverage, false)

    return {
      chainId:        'C3',
      category:       'sleep_mood',
      strength,
      trigger: {
        metric:      'sleep',
        date:        last3[last3.length - 1].date,
        value:       roundTo(last3[last3.length - 1].sleepHours!),
        unit:        'ч',
        description: `сон 3 дня подряд: ${sequence}`,
      },
      outcome: {
        metric:      'mood',
        date:        today.date,
        value:       today.mood,
        unit:        '/10',
        description: `настроение ${today.mood}/10 при норме ${roundTo(normMood)} (${ruDate(today.date)})`,
      },
      lagDescription: '3 дня → сегодня',
      mechanism:      'накопленный sleep debt → mood drop',
      recommendation: `Сон 3 дня подряд (${sequence}). Сегодня настроение ${today.mood}/10. Лечь до 22:30 — приоритет номер 1.`,
      priority:       strength === 'strong' ? 92 : 78,
      tags:           ['sleep', 'mood', 'chronic', 'sleep-debt'],
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // ГРУППА D — Стресс → Сон / Питание (поведенческие)
  // ──────────────────────────────────────────────────────────────────

  /**
   * D1: stress[t]>7 И late_meal_kcal[t]>400
   */
  private _detectD1(ctx: ChainContext): CausalChain | null {
    const today = this._today(ctx)
    if (!today) return null
    if (today.stress === null || today.stress <= 7) return null
    if (today.lateMealCalories <= 400) return null

    const margin = Math.min(
      (today.stress - 7) / 7,
      (today.lateMealCalories - 400) / 400,
    )
    const coverage = 1.0
    const strength = this._strengthFor(
      margin,
      coverage,
      Boolean(ctx.consistencyFlags?.stress),
    )

    return {
      chainId:        'D1',
      category:       'stress_eating',
      strength,
      trigger: {
        metric:      'stress',
        date:        today.date,
        value:       today.stress,
        unit:        '/10',
        description: `стресс ${today.stress}/10 (${ruDate(today.date)})`,
      },
      outcome: {
        metric:      'nutrition',
        date:        today.date,
        value:       Math.round(today.lateMealCalories),
        unit:        'ккал',
        description: `поздний ужин ${Math.round(today.lateMealCalories)} ккал после 21:00`,
      },
      lagDescription: 'тот же день',
      mechanism:      'stress-eating вечером → петля стресс-кортизол-плохой сон',
      recommendation: `Сегодня стресс ${today.stress}/10 + поздний ужин ${Math.round(today.lateMealCalories)} ккал. Типичный цикл «стресс → переедание → плохой сон → ↑стресс завтра». 10-мин дыхательная практика в 21:00 разрывает цикл.`,
      priority:       strength === 'strong' ? 82 : 68,
      tags:           ['stress', 'nutrition', 'behavior'],
    }
  }

  /**
   * D2: stress_7d>7 И bed_hour_t>23:30 (revenge bedtime)
   */
  private _detectD2(ctx: ChainContext): CausalChain | null {
    const last7 = ctx.days.slice(-7)
    const stressVals = last7.map(d => d.stress).filter((v): v is number => v !== null)
    if (stressVals.length < 4) return null
    const avgStress = stressVals.reduce((s, v) => s + v, 0) / stressVals.length
    if (avgStress <= 7) return null

    const today = this._today(ctx)
    if (!today || today.bedHour === null) return null
    if (today.bedHour < 23.5) return null

    const margin = Math.min((avgStress - 7) / 7, (today.bedHour - 23.5) / 4)
    const coverage = this._coverage(ctx, 7, [d => d.stress, d => d.bedHour])
    const strength = this._strengthFor(
      margin,
      coverage,
      Boolean(ctx.consistencyFlags?.stress),
    )

    return {
      chainId:        'D2',
      category:       'stress_sleep',
      strength,
      trigger: {
        metric:      'stress',
        date:        today.date,
        value:       roundTo(avgStress),
        unit:        '/10',
        description: `средний стресс ${roundTo(avgStress)}/10 за 7 дней`,
      },
      outcome: {
        metric:      'sleep',
        date:        today.date,
        value:       roundTo(today.bedHour),
        unit:        'ч',
        description: `отбой в ${formatHour(today.bedHour)} (${ruDate(today.date)})`,
      },
      lagDescription: 'за 7 дней',
      mechanism:      'хронический стресс отодвигает отход ко сну (revenge bedtime)',
      recommendation: `Стресс ${roundTo(avgStress)}/10 средний + отбой в ${formatHour(today.bedHour)}. Cut-off экранов в 22:30 — не для сна, а для снижения вечернего возбуждения.`,
      priority:       strength === 'strong' ? 76 : 62,
      tags:           ['stress', 'sleep', 'bedtime'],
    }
  }

  /**
   * D3: stress[t]>7 И water_ml[t]<personal.waterMin
   */
  private _detectD3(ctx: ChainContext): CausalChain | null {
    const today = this._today(ctx)
    if (!today) return null
    if (today.stress === null || today.stress <= 7) return null
    const waterMin = ctx.personal.waterMin
    if (today.waterMl === null || today.waterMl >= waterMin) return null

    const margin = Math.min(
      (today.stress - 7) / 7,
      (waterMin - today.waterMl) / waterMin,
    )
    const coverage = 1.0
    const strength = this._strengthFor(margin, coverage, false)

    return {
      chainId:        'D3',
      category:       'stress_hydration',
      strength,
      trigger: {
        metric:      'stress',
        date:        today.date,
        value:       today.stress,
        unit:        '/10',
        description: `стресс ${today.stress}/10 (${ruDate(today.date)})`,
      },
      outcome: {
        metric:      'water',
        date:        today.date,
        value:       today.waterMl,
        unit:        'мл',
        description: `${today.waterMl} мл воды — на ${waterMin - today.waterMl} мл ниже вашей нормы ${waterMin} мл`,
      },
      lagDescription: 'тот же день',
      mechanism:      'кортизол + дегидратация → головные боли, спад концентрации',
      recommendation: `Стресс ${today.stress}/10 при ${today.waterMl} мл воды. Дегидратация усиливает воспринимаемый стресс. Стакан до каждого совещания остаток дня.`,
      priority:       strength === 'strong' ? 72 : 58,
      tags:           ['stress', 'water', 'hydration'],
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // ГРУППА E — Вода / Энергия
  // ──────────────────────────────────────────────────────────────────

  /**
   * E1: water_7d<personal.waterMin И activity_7d>30 И mood_7d<5.5
   */
  private _detectE1(ctx: ChainContext): CausalChain | null {
    const last7 = ctx.days.slice(-7)
    const waterVals = last7.map(d => d.waterMl).filter((v): v is number => v !== null)
    const actVals = last7.map(d => d.activityMinutes).filter((v): v is number => v !== null)
    const moodVals = last7.map(d => d.mood).filter((v): v is number => v !== null)
    if (waterVals.length < 4 || actVals.length < 4 || moodVals.length < 4) return null

    const avgWater = waterVals.reduce((s, v) => s + v, 0) / waterVals.length
    const avgAct = actVals.reduce((s, v) => s + v, 0) / actVals.length
    const avgMood = moodVals.reduce((s, v) => s + v, 0) / moodVals.length
    const waterMin = ctx.personal.waterMin
    if (avgWater >= waterMin || avgAct <= 30 || avgMood >= 5.5) return null

    const margin = Math.min(
      (waterMin - avgWater) / waterMin,
      (avgAct - 30) / 30,
      (5.5 - avgMood) / 5.5,
    )
    const coverage = this._coverage(ctx, 7, [d => d.waterMl, d => d.activityMinutes, d => d.mood])
    const strength = this._strengthFor(margin, coverage, false)

    const today = this._today(ctx)
    if (!today) return null

    return {
      chainId:        'E1',
      category:       'hydration_energy',
      strength,
      trigger: {
        metric:      'water',
        date:        today.date,
        value:       Math.round(avgWater),
        unit:        'мл/день',
        description: `${Math.round(avgWater)} мл/день при вашей норме ${ctx.personal.waterMin} мл (за 7 дней)`,
      },
      mediator: {
        metric:      'activity',
        date:        today.date,
        value:       Math.round(avgAct),
        unit:        'мин/день',
        description: `активность ${Math.round(avgAct)} мин/день`,
      },
      outcome: {
        metric:      'mood',
        date:        today.date,
        value:       roundTo(avgMood),
        unit:        '/10',
        description: `настроение ${roundTo(avgMood)}/10`,
      },
      lagDescription: 'за 7 дней',
      mechanism:      'дегидратация при нагрузке → энерго-крах',
      recommendation: `За неделю: ${Math.round(avgWater)} мл воды, ${Math.round(avgAct)} мин активности, настроение ${roundTo(avgMood)}/10. +500 мл после каждой тренировки.`,
      priority:       strength === 'strong' ? 74 : 60,
      tags:           ['water', 'activity', 'mood'],
    }
  }

  /**
   * E2: calories[t-1] < personal.minCalories*0.75 И activity_min[t-1] > 60 И mood[t] < normMood-1
   */
  private _detectE2(ctx: ChainContext): CausalChain | null {
    const today = this._today(ctx)
    const yest = this._yesterday(ctx)
    if (!today || !yest) return null
    const lowFuelThreshold = ctx.personal.minCalories * 0.75
    if (yest.totalCalories === null || yest.totalCalories >= lowFuelThreshold) return null
    if (yest.activityMinutes === null || yest.activityMinutes <= 60) return null
    if (today.mood === null) return null
    const normMood = ctx.baselines.normMood
    if (!normMood || today.mood >= normMood - 1) return null

    const margin = Math.min(
      (lowFuelThreshold - yest.totalCalories) / lowFuelThreshold,
      (yest.activityMinutes - 60) / 60,
      (normMood - 1 - today.mood) / Math.max(normMood, 1),
    )
    const coverage = this._coverage(ctx, 7, [d => d.totalCalories, d => d.activityMinutes, d => d.mood])
    const strength = this._strengthFor(margin, coverage, false)

    return {
      chainId:        'E2',
      category:       'fuel_recovery',
      strength,
      trigger: {
        metric:      'nutrition',
        date:        yest.date,
        value:       yest.totalCalories,
        unit:        'ккал',
        description: `${Math.round(yest.totalCalories)} ккал + ${yest.activityMinutes} мин нагрузки (${ruDate(yest.date)})`,
      },
      outcome: {
        metric:      'mood',
        date:        today.date,
        value:       today.mood,
        unit:        '/10',
        description: `настроение ${today.mood}/10 при норме ${roundTo(normMood)} (${ruDate(today.date)})`,
      },
      lagDescription: 'вчера → сегодня',
      mechanism:      'тренировка в калорийном дефиците → утреннее mood ↓',
      recommendation: `Вчера ${Math.round(yest.totalCalories)} ккал + ${yest.activityMinutes} мин нагрузки → сегодня настроение ${today.mood}/10. После тренировки — обязательно перекус 300+ ккал.`,
      priority:       strength === 'strong' ? 80 : 65,
      tags:           ['nutrition', 'activity', 'mood', 'recovery'],
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // ГРУППА F — Положительные паттерны
  // ──────────────────────────────────────────────────────────────────

  /**
   * F1: sleep_h[t-1] >= 7.5 И mood[t] >= normMood+1
   */
  private _detectF1(ctx: ChainContext): CausalChain | null {
    const today = this._today(ctx)
    const yest = this._yesterday(ctx)
    if (!today || !yest) return null
    if (yest.sleepHours === null || yest.sleepHours < 7.5) return null
    const normMood = ctx.baselines.normMood
    if (!normMood || today.mood === null || today.mood < normMood + 1) return null

    const margin = Math.min((yest.sleepHours - 7.5) / 7.5, (today.mood - normMood - 1) / normMood)
    const coverage = this._coverage(ctx, 7, [d => d.sleepHours, d => d.mood])
    const strength = this._strengthFor(margin, coverage, false)

    return {
      chainId:        'F1',
      category:       'positive',
      strength,
      trigger: {
        metric:      'sleep',
        date:        yest.date,
        value:       roundTo(yest.sleepHours),
        unit:        'ч',
        description: `сон ${roundTo(yest.sleepHours)}ч (${ruDate(yest.date)})`,
      },
      outcome: {
        metric:      'mood',
        date:        today.date,
        value:       today.mood,
        unit:        '/10',
        description: `настроение ${today.mood}/10 при норме ${roundTo(normMood)} (${ruDate(today.date)})`,
      },
      lagDescription: 'вчера → сегодня',
      mechanism:      'хороший сон → стабильное настроение',
      recommendation: `Вчера сон ${roundTo(yest.sleepHours)}ч → сегодня настроение ${today.mood}/10. Этот паттерн — твой главный рычаг, фиксируй его.`,
      priority:       strength === 'strong' ? 50 : 40,
      tags:           ['sleep', 'mood', 'positive'],
    }
  }

  /**
   * F2: «perfect days» (все нормы) ≥3 из 7
   */
  private _detectF2(ctx: ChainContext): CausalChain | null {
    const last7 = ctx.days.slice(-7)
    if (last7.length < 5) return null
    const normSleep = ctx.baselines.normSleepHours ?? 7
    const normStress = ctx.baselines.normStress ?? 5
    const normWater = ctx.baselines.normWaterMl ?? 2000

    const perfectDays = last7.filter(d =>
      d.sleepHours !== null && d.sleepHours >= normSleep - 0.5 &&
      d.stress     !== null && d.stress <= normStress &&
      d.waterMl    !== null && d.waterMl >= normWater * 0.8 &&
      d.activityMinutes !== null && d.activityMinutes >= 30,
    ).length

    if (perfectDays < 3) return null

    const today = this._today(ctx)
    if (!today) return null

    const margin = (perfectDays - 3) / 4
    const coverage = this._coverage(ctx, 7, [d => d.sleepHours, d => d.stress, d => d.waterMl, d => d.activityMinutes])
    const strength = this._strengthFor(margin, coverage, false)

    return {
      chainId:        'F2',
      category:       'positive',
      strength,
      trigger: {
        metric:      'mood',
        date:        today.date,
        value:       perfectDays,
        unit:        'дней',
        description: `${perfectDays} дней с полным набором норм за 7 дней`,
      },
      outcome: {
        metric:      'mood',
        date:        today.date,
        value:       perfectDays,
        unit:        'дней',
        description: `устойчивый позитивный паттерн`,
      },
      lagDescription: 'за 7 дней',
      mechanism:      'положительный устойчивый паттерн',
      recommendation: `${perfectDays} дней с полным набором норм за неделю. Закрепи один якорный ритуал (утро или вечер) — он удержит остальное.`,
      priority:       strength === 'strong' ? 42 : 35,
      tags:           ['positive', 'streak'],
    }
  }
}
