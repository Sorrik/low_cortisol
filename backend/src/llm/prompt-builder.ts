// backend/src/llm/prompt-builder.ts

import { RelevantArticle } from '../rag/rag.service'

// ── Типы ─────────────────────────────────────────────────────

interface HealthData {
  sleep:     { date: string; duration_hours: number; quality: number }[]
  mood:      { date: string; mood_score: number }[]
  stress:    { date: string; level: number }[]
  activity:  { date: string; duration_minutes: number; intensity: string }[]
  water:     { date: string; amount_ml: number }[]
  nutrition: { date: string; calories: number; protein_grams: number; carbs_grams: number; fat_grams: number }[]
  _user_profile?: {
    primary_goal:        string
    sleep_goal_hours:    number
    chronotype:          string
    activity_level:      string
    baseline_stress:     number
    weekly_training_min: number
    sport_goal:          string | null
  }
}

export interface ShapInfluencer {
  factor:        string
  impact:        number
  raw_shap:      number
  direction:     'positive' | 'negative'
  description:   string
  feature_value: number
}

export interface MlPrediction {
  predicted_mood:   number | null
  confidence_lower: number | null
  confidence_upper: number | null
  top_influencers:  ShapInfluencer[]
  phase_mode:       string
  model_version:    string
}

interface MetricSummary {
  avg:   number
  min:   number
  max:   number
  days:  number
  trend: 'improving' | 'worsening' | 'stable' | 'no_data'
}

export interface HealthQueryContext {
  avgSleepHours:      number
  avgStress:          number
  avgMood:            number
  avgActivityMinutes: number
  avgWaterGlasses:    number
}

// ── Helpers ───────────────────────────────────────────────────

function avg(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function trend(values: number[], higherIsBetter: boolean): MetricSummary['trend'] {
  if (values.length < 3) return 'stable'
  const first = avg(values.slice(0, Math.ceil(values.length / 2)))
  const last  = avg(values.slice(Math.floor(values.length / 2)))
  const delta = last - first
  if (Math.abs(delta) < 0.3) return 'stable'
  if (higherIsBetter) return delta > 0 ? 'improving' : 'worsening'
  return delta < 0 ? 'improving' : 'worsening'
}

function summarize(values: number[], higherIsBetter: boolean): MetricSummary {
  if (!values.length) return { avg: 0, min: 0, max: 0, days: 0, trend: 'no_data' }
  return {
    avg:   Math.round(avg(values) * 10) / 10,
    min:   Math.round(Math.min(...values) * 10) / 10,
    max:   Math.round(Math.max(...values) * 10) / 10,
    days:  values.length,
    trend: trend(values, higherIsBetter),
  }
}

function lastNDays<T extends { date: string }>(records: T[], n: number): T[] {
  return [...records].sort((a, b) => a.date.localeCompare(b.date)).slice(-n)
}

export function extractHealthContext(healthData: HealthData): HealthQueryContext {
  const W = 7
  const sleep    = lastNDays(healthData.sleep,    W)
  const stress   = lastNDays(healthData.stress,   W)
  const mood     = lastNDays(healthData.mood,     W)
  const activity = lastNDays(healthData.activity, W)
  const water    = lastNDays(healthData.water,    W)
  return {
    avgSleepHours:      Math.round(avg(sleep.map(r => r.duration_hours)) * 10) / 10,
    avgStress:          Math.round(avg(stress.map(r => r.level))         * 10) / 10,
    avgMood:            Math.round(avg(mood.map(r => r.mood_score))      * 10) / 10,
    avgActivityMinutes: Math.round(avg(activity.map(r => r.duration_minutes))),
    avgWaterGlasses:    Math.round(avg(water.map(r => r.amount_ml / 250)) * 10) / 10,
  }
}

// ── Словари ───────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  sleep:  'улучшить сон',
  stress: 'снизить стресс',
  energy: 'повысить энергию',
  mood:   'улучшить настроение',
  weight: 'контроль веса',
}

const CHRONOTYPE_LABELS: Record<string, string> = {
  early_bird: 'жаворонок',
  night_owl:  'сова',
  no_routine: 'без режима',
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'почти не тренируется',
  light:     '1–2 тренировки в неделю',
  moderate:  '3–4 тренировки в неделю',
  active:    'тренируется каждый день',
}

const SPORT_GOAL_LABELS: Record<string, string> = {
  lose_weight:       'похудение',
  build_muscle:      'набор мышечной массы',
  improve_endurance: 'выносливость',
  stay_healthy:      'поддержание здоровья',
  reduce_stress:     'снятие стресса через спорт',
}

const TREND_RU: Record<string, string> = {
  improving: 'улучшается',
  worsening: 'ухудшается',
  stable:    'стабильный',
  no_data:   'нет данных',
}

// ── Секция профиля ────────────────────────────────────────────

function buildProfileSection(p: NonNullable<HealthData['_user_profile']>): string {
  const lines = [
    `ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:`,
    `  Главная цель: ${GOAL_LABELS[p.primary_goal] ?? p.primary_goal}`,
    `  Личная норма сна: ${p.sleep_goal_hours} ч`,
    `  Хронотип: ${CHRONOTYPE_LABELS[p.chronotype] ?? p.chronotype}`,
    `  Активность: ${ACTIVITY_LABELS[p.activity_level] ?? p.activity_level}`,
    `  Базовый стресс (при регистрации): ${p.baseline_stress}/10`,
  ]
  if (p.weekly_training_min > 0) {
    lines.push(`  Недельная нагрузка: ${p.weekly_training_min} мин/нед`)
  }
  if (p.sport_goal) {
    lines.push(`  Цель в спорте: ${SPORT_GOAL_LABELS[p.sport_goal] ?? p.sport_goal}`)
  }
  return lines.join('\n')
}

// ── Секция SHAP — структурированные факторы для GPT ──────────
//
// Ключевое изменение: вместо текстовых описаний ("Стресс вчера
// 7/10 снижает настроение") передаём числовые данные напрямую.
// GPT обязан ссылаться на конкретный фактор в каждой рекомендации.

function buildShapSection(ml: MlPrediction): string {
  if (ml.phase_mode === 'cold_start' || !ml.top_influencers?.length) return ''

  const model = ml.phase_mode === 'learning' ? 'Ridge-регрессия' : 'Gradient Boosting'

  const lines: string[] = []

  lines.push(`ML_PREDICTION (${model}):`)

  if (ml.predicted_mood != null) {
    const ci = (ml.confidence_lower != null && ml.confidence_upper != null)
      ? ` [${ml.confidence_lower}–${ml.confidence_upper}]`
      : ''
    lines.push(`  predicted_mood_tomorrow: ${ml.predicted_mood}/10${ci}`)
  }

  lines.push(``)
  lines.push(`SHAP_FACTORS — причины прогноза (КАЖДАЯ рекомендация ОБЯЗАНА`)
  lines.push(`ссылаться на один из этих факторов с его числовым значением):`)

  const negative = ml.top_influencers.filter(f => f.direction === 'negative')
  const positive = ml.top_influencers.filter(f => f.direction === 'positive')

  if (negative.length) {
    lines.push(`  Снижают настроение:`)
    negative.forEach(f => {
      lines.push(`    - фактор: "${f.factor}"`)
      lines.push(`      значение: ${Math.round(f.feature_value * 10) / 10}`)
      lines.push(`      SHAP-вклад: ${f.raw_shap.toFixed(3)} (влияние: -${f.impact.toFixed(2)})`)
    })
  }

  if (positive.length) {
    lines.push(`  Поддерживают настроение:`)
    positive.forEach(f => {
      lines.push(`    - фактор: "${f.factor}"`)
      lines.push(`      значение: ${Math.round(f.feature_value * 10) / 10}`)
      lines.push(`      SHAP-вклад: +${f.raw_shap.toFixed(3)} (влияние: +${f.impact.toFixed(2)})`)
    })
  }

  return lines.join('\n')
}

// ── Главная функция ───────────────────────────────────────────

export function buildRecommendationPrompt(
  healthData: HealthData,
  articles:   RelevantArticle[] = [],
  ml?:        MlPrediction,
): string {

  const W         = 7
  const sleep     = lastNDays(healthData.sleep,     W)
  const mood      = lastNDays(healthData.mood,      W)
  const stress    = lastNDays(healthData.stress,    W)
  const activity  = lastNDays(healthData.activity,  W)
  const water     = lastNDays(healthData.water,     W)
  const nutrition = lastNDays(healthData.nutrition, W)

  const stats = {
    sleep:    summarize(sleep.map(r => r.duration_hours),      true),
    quality:  summarize(sleep.map(r => r.quality),             true),
    mood:     summarize(mood.map(r => r.mood_score),           true),
    stress:   summarize(stress.map(r => r.level),              false),
    activity: summarize(activity.map(r => r.duration_minutes), true),
    water:    summarize(water.map(r => r.amount_ml / 250),     true),
    calories: summarize(nutrition.map(r => r.calories),        true),
    protein:  summarize(nutrition.map(r => r.protein_grams),   true),
  }

  const badSleepStreak = (() => {
    let n = 0
    for (const r of [...sleep].reverse()) { if (r.duration_hours < 6) n++; else break }
    return n
  })()

  const highStressStreak = (() => {
    let n = 0
    for (const r of [...stress].reverse()) { if (r.level > 6) n++; else break }
    return n
  })()

  const up        = healthData._user_profile
  const sleepNorm = up?.sleep_goal_hours ?? 8
  const hasShap   = !!(ml && ml.phase_mode !== 'cold_start' && ml.top_influencers?.length)
  const primaryGoalLabel = up ? (GOAL_LABELS[up.primary_goal] ?? up.primary_goal) : null

  // ── System prompt ─────────────────────────────────────────
  // Роль + жёсткие правила. Данные — только в user prompt.

  const systemPrompt = [
    `Ты — персональный health-коуч. Твоя задача: взять готовые факты из данных`,
    `и SHAP_FACTORS и сформулировать 4 конкретных рекомендации.`,
    ``,
    primaryGoalLabel
      ? `Главная цель пользователя: "${primaryGoalLabel}". Каждая рекомендация приближает к этой цели.`
      : `Цель: улучшить общее самочувствие пользователя.`,
    ``,
    `ЖЁСТКИЕ ПРАВИЛА — нарушение любого делает ответ невалидным:`,
    ``,
    `1. КОНКРЕТНОСТЬ С ЦИФРАМИ.`,
    `   Запрещено: "постарайся пить больше воды".`,
    `   Обязательно: "Вчера вода: 800 мл — ниже нормы на 1200 мл. Выпей 3 стакана до обеда".`,
    `   Каждый description ОБЯЗАН содержать реальное числовое значение из данных.`,
    ``,
    hasShap
      ? [
          `2. ПРИВЯЗКА К SHAP.`,
          `   Каждая рекомендация ОБЯЗАНА ссылаться на конкретный фактор из SHAP_FACTORS.`,
          `   Запрещено придумывать проблемы которых нет в SHAP_FACTORS.`,
          `   Самый приоритетный негативный SHAP-фактор → рекомендация с severity "alert".`,
        ].join('\n')
      : `2. Опирайся строго на числа из раздела ДАННЫЕ. Не придумывай проблем которых нет.`,
    ``,
    `3. УНИКАЛЬНОСТЬ ТЕМ.`,
    `   4 рекомендации = 4 разные метрики (sleep, stress, mood, activity, water, food).`,
    `   Не давай две рекомендации про одно и то же.`,
    ``,
    `4. НОРМА СНА для этого пользователя — ${sleepNorm} ч, не стандартные 8 ч.`,
    up ? `   Базовый стресс: ${up.baseline_stress}/10. Всё что выше — отклонение.` : '',
    ``,
    `5. СОРТИРОВКА: alert → attention → good.`,
    ``,
    `6. ТОН: поддерживающий, без осуждения.`,
    ``,
    `7. ФОРМАТ: ТОЛЬКО валидный JSON без markdown, без текста до или после.`,
  ].filter(s => s !== '').join('\n')

  // ── User prompt — только данные ───────────────────────────

  const parts: string[] = []

  if (up) {
    parts.push(buildProfileSection(up))
    parts.push('')
  }

  parts.push(`ДАННЫЕ ЗА ПОСЛЕДНИЕ ${W} ДНЕЙ:`)
  parts.push(``)
  parts.push(`Сон:`)
  parts.push(`  Среднее: ${stats.sleep.avg} ч (личная норма: ${sleepNorm} ч)`)
  parts.push(`  Качество: ${stats.quality.avg}/10`)
  parts.push(`  Тренд: ${TREND_RU[stats.sleep.trend]}`)
  if (badSleepStreak >= 2) {
    parts.push(`  ВНИМАНИЕ: ${badSleepStreak} дней подряд сон менее 6 ч`)
  }
  parts.push(``)
  parts.push(`Настроение:`)
  parts.push(`  Среднее: ${stats.mood.avg}/10 (мин ${stats.mood.min} — макс ${stats.mood.max})`)
  parts.push(`  Тренд: ${TREND_RU[stats.mood.trend]}`)
  parts.push(``)
  parts.push(`Стресс:`)
  parts.push(`  Среднее: ${stats.stress.avg}/10${up ? ` (базовый: ${up.baseline_stress}/10)` : ''}`)
  parts.push(`  Тренд: ${TREND_RU[stats.stress.trend]}`)
  if (highStressStreak >= 2) {
    parts.push(`  ВНИМАНИЕ: ${highStressStreak} дней подряд стресс выше 6/10`)
  }
  parts.push(``)
  parts.push(`Активность:`)
  parts.push(`  Среднее: ${stats.activity.avg} мин/день`)
  parts.push(`  Тренд: ${TREND_RU[stats.activity.trend]}`)
  parts.push(``)
  parts.push(`Вода:`)
  parts.push(`  Среднее: ${stats.water.avg} стаканов/день (${Math.round(stats.water.avg * 250)} мл, норма: 2000 мл)`)
  parts.push(``)
  parts.push(`Питание:`)
  parts.push(`  Калории: ${stats.calories.avg} ккал/день`)
  parts.push(`  Белок: ${stats.protein.avg} г/день`)

  // SHAP — структурированные факторы
  if (ml) {
    const shapStr = buildShapSection(ml)
    if (shapStr) {
      parts.push(``)
      parts.push(shapStr)
    }
  }

  // RAG
  if (articles.length > 0) {
    parts.push(``)
    parts.push(`НАУЧНЫЙ КОНТЕКСТ (PubMed) — можно цитировать как "Согласно исследованию [N]":`)
    articles.forEach((a, i) => {
      parts.push(`[${i + 1}] ${a.title} (${a.year}, PMID:${a.pmid})`)
      parts.push(`    ${a.abstract.slice(0, 300)}...`)
    })
  }

  // JSON схема
  parts.push(``)
  parts.push(`Верни строго в этом формате, без markdown:`)
  parts.push(`{`)
  parts.push(`  "recommendations": [`)
  parts.push(`    {`)
  parts.push(`      "metric": "sleep | mood | stress | activity | water | food",`)
  parts.push(`      "severity": "alert | attention | good",`)
  parts.push(`      "title": "до 50 символов",`)
  parts.push(`      "description": "конкретный совет с числами, 2-3 предложения"`)
  parts.push(`    }`)
  parts.push(`  ]`)
  parts.push(`}`)

  const userPrompt = parts.join('\n')

  return JSON.stringify({ system: systemPrompt, user: userPrompt })
}