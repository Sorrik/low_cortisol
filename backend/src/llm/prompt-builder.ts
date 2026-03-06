// backend/src/llm/prompt-builder.ts

import { RelevantArticle } from '../rag/rag.service'

interface HealthData {
  sleep:     { date: string; duration_hours: number; quality: number }[]
  mood:      { date: string; mood_score: number }[]
  stress:    { date: string; level: number }[]
  activity:  { date: string; duration_minutes: number; intensity: string }[]
  water:     { date: string; amount_ml: number }[]
  nutrition: { date: string; calories: number; protein_grams: number; carbs_grams: number; fat_grams: number }[]
}

interface MetricSummary {
  avg:  number
  min:  number
  max:  number
  days: number
  trend:'improving' | 'worsening' | 'stable' | 'no_data'
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
  return [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-n)
}

// ── Экспортируем контекст для RagService ──────────────────────

export interface HealthQueryContext {
  avgSleepHours:      number
  avgStress:          number
  avgMood:            number
  avgActivityMinutes: number
  avgWaterGlasses:    number
}

export function extractHealthContext(healthData: HealthData): HealthQueryContext {
  const WINDOW = 7
  const sleep    = lastNDays(healthData.sleep,    WINDOW)
  const stress   = lastNDays(healthData.stress,   WINDOW)
  const mood     = lastNDays(healthData.mood,      WINDOW)
  const activity = lastNDays(healthData.activity,  WINDOW)
  const water    = lastNDays(healthData.water,     WINDOW)

  return {
    avgSleepHours:      Math.round(avg(sleep.map(r => r.duration_hours)) * 10) / 10,
    avgStress:          Math.round(avg(stress.map(r => r.level))         * 10) / 10,
    avgMood:            Math.round(avg(mood.map(r => r.mood_score))      * 10) / 10,
    avgActivityMinutes: Math.round(avg(activity.map(r => r.duration_minutes))),
    avgWaterGlasses:    Math.round(avg(water.map(r => r.amount_ml / 250)) * 10) / 10,
  }
}

// ── Главная функция ───────────────────────────────────────────

export function buildRecommendationPrompt(
  healthData: HealthData,
  articles:   RelevantArticle[] = [],   // ← RAG контекст
): string {

  const WINDOW = 7
  const sleep     = lastNDays(healthData.sleep,      WINDOW)
  const mood      = lastNDays(healthData.mood,       WINDOW)
  const stress    = lastNDays(healthData.stress,     WINDOW)
  const activity  = lastNDays(healthData.activity,   WINDOW)
  const water     = lastNDays(healthData.water,      WINDOW)
  const nutrition = lastNDays(healthData.nutrition,  WINDOW)

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
    let streak = 0
    for (const r of [...sleep].reverse()) {
      if (r.duration_hours < 6) streak++
      else break
    }
    return streak
  })()

  const highStressStreak = (() => {
    let streak = 0
    for (const r of [...stress].reverse()) {
      if (r.level > 6) streak++
      else break
    }
    return streak
  })()

  // ── Блок с данными пользователя ──────────────────────────

  const dataSection = `
ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ЗА ПОСЛЕДНИЕ ${WINDOW} ДНЕЙ:

Сон:
- Средняя продолжительность: ${stats.sleep.avg}ч (норма: 7–9ч)
- Качество сна: ${stats.quality.avg}/10
- Тренд: ${stats.sleep.trend}
- Дней с данными: ${stats.sleep.days}/${WINDOW}
${badSleepStreak >= 2 ? `⚠️ ${badSleepStreak} дней подряд сон менее 6 часов` : ''}

Настроение:
- Среднее: ${stats.mood.avg}/10 (разброс: ${stats.mood.min}–${stats.mood.max})
- Тренд: ${stats.mood.trend}
- Дней с данными: ${stats.mood.days}/${WINDOW}

Стресс:
- Средний уровень: ${stats.stress.avg}/10
- Тренд: ${stats.stress.trend}
- Дней с данными: ${stats.stress.days}/${WINDOW}
${highStressStreak >= 2 ? `⚠️ ${highStressStreak} дней подряд стресс выше 6/10` : ''}

Активность:
- Среднее время: ${stats.activity.avg} мин/день
- Тренд: ${stats.activity.trend}
- Дней с данными: ${stats.activity.days}/${WINDOW}

Вода:
- Среднее: ${stats.water.avg} стаканов/день (норма: 8)
- Тренд: ${stats.water.trend}
- Дней с данными: ${stats.water.days}/${WINDOW}

Питание:
- Средние калории: ${stats.calories.avg} ккал/день
- Средний белок: ${stats.protein.avg} г/день
- Дней с данными: ${stats.calories.days}/${WINDOW}
`.trim()

  // ── RAG блок: научный контекст ───────────────────────────

  const scienceSection = articles.length > 0
    ? `

НАУЧНЫЙ КОНТЕКСТ (актуальные исследования):
${articles.map((a, i) => `
[${i + 1}] ${a.title} (${a.year}, PubMed PMID:${a.pmid})
${a.abstract.slice(0, 500)}...
`).join('\n')}

При формулировке рекомендаций ссылайся на эти исследования, используя формат:
"Согласно исследованию [N], ..." или "Исследования показывают, что..."
`.trim()
    : ''

  // ── Промпты ───────────────────────────────────────────────

  const systemPrompt = `Ты — персональный health-коуч, основывающий свои рекомендации на научных данных.
Ты анализируешь данные о здоровье пользователя и даёшь конкретные, actionable рекомендации.

Правила:
1. Только конкретные советы — не общие слова типа "старайся спать больше"
2. Если есть паттерн (несколько дней подряд) — укажи его явно
3. Связывай метрики: "стресс влияет на сон, что ухудшает настроение"
4. Если есть научный контекст — используй его для обоснования рекомендаций
5. Максимум 4 рекомендации, отсортированные по приоритету
6. Для каждой рекомендации укажи severity: good/attention/alert
7. Тон: поддерживающий, не осуждающий

Отвечай ТОЛЬКО валидным JSON без markdown, без пояснений вне JSON.`

  const userPrompt = `${dataSection}

${scienceSection}

Верни JSON строго в этом формате:
{
  "recommendations": [
    {
      "metric": "sleep" | "mood" | "stress" | "activity" | "water" | "food",
      "severity": "good" | "attention" | "alert",
      "title": "Короткий заголовок (до 50 символов)",
      "description": "Конкретный совет с научным обоснованием (2-3 предложения)"
    }
  ]
}`

  return JSON.stringify({ system: systemPrompt, user: userPrompt })
}