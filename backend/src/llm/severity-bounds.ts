// backend/src/llm/severity-bounds.ts
//
// Единый расчёт средних, норм и границ severity за то же окно, что видит LLM.
// Им пользуются промпт, коррекция severity и гарантированные критичные карточки,
// поэтому цифры в тексте и цвет карточки не могут разойтись.

import { MetricType, RecommendationDto } from '../ml/dto/ml-response.dto'

export const SEVERITY_WINDOW_DAYS = 7

type Severity = 'good' | 'attention' | 'alert'
type SeverityMap = Record<string, Severity>
type DatedRecord = { date?: string }

export interface SeverityBounds {
  averages: {
    calories: number
    protein: number
    sleep: number
    stress: number
    mood: number
    water: number
  }
  targets: {
    calories: number
    protein: number
    water: number
    sleep: number
    baselineStress: number
  }
  calorieDeficit: number
  proteinDeficit: number
  waterDeficit: number
  floor: SeverityMap
  ceil: SeverityMap
}

const dayOf = (record: DatedRecord) => String(record.date ?? 'unknown').slice(0, 10)
const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
const roundTo = (value: number, step: number) => Math.round(value / step) * step

function lastRecords<T extends DatedRecord>(records: T[] = [], days: number): T[] {
  return [...records].sort((a, b) => dayOf(a).localeCompare(dayOf(b))).slice(-days)
}

/** Суммы по дням за последние N дней с данными: приёмов пищи и воды бывает несколько в день. */
function lastDailySums<T extends DatedRecord>(
  records: T[] = [],
  value: (record: T) => number,
  days: number,
): number[] {
  const byDay = new Map<string, number>()
  for (const record of records) {
    byDay.set(dayOf(record), (byDay.get(dayOf(record)) ?? 0) + (value(record) || 0))
  }
  return [...byDay.keys()]
    .sort()
    .slice(-days)
    .map((day) => byDay.get(day)!)
    .filter((sum) => sum > 0)
}

export function computeSeverityBounds(
  healthData: any,
  days = SEVERITY_WINDOW_DAYS,
): SeverityBounds {
  const avgOf = (records: any[], key: string) =>
    mean(lastRecords(records, days).map((record: any) => record[key] ?? 0))

  const calories = mean(lastDailySums<any>(healthData.nutrition, (r) => r.calories, days))
  const protein = mean(lastDailySums<any>(healthData.nutrition, (r) => r.protein_grams, days))
  const water = mean(lastDailySums<any>(healthData.water, (r) => r.amount_ml, days))
  const sleep = avgOf(healthData.sleep, 'duration_hours')
  const stress = avgOf(healthData.stress, 'level')
  const mood = avgOf(healthData.mood, 'mood_score')

  // Если норм нет в профиле, берём популяционные значения.
  const profile = healthData._user_profile ?? {}
  const targets = {
    calories: profile.target_calories ?? 2000,
    protein: profile.target_protein_g ?? 75,
    water: profile.target_water_ml ?? 2000,
    sleep: profile.sleep_goal_hours ?? 8,
    baselineStress: profile.baseline_stress ?? 5,
  }

  const calorieDeficit = calories > 0 ? (targets.calories - calories) / targets.calories : 0
  const proteinDeficit = protein > 0 ? (targets.protein - protein) / targets.protein : 0
  const waterDeficit = water > 0 ? (targets.water - water) / targets.water : 0

  const floor: SeverityMap = {}
  const ceil: SeverityMap = {}

  if (calories > 0) {
    if (calorieDeficit >= 0.25 || calories > targets.calories * 1.75 || proteinDeficit >= 0.25) {
      floor.food = 'alert'
    }
    const maxDeficit = Math.max(calorieDeficit, proteinDeficit)
    if (maxDeficit < 0.1) ceil.food = 'good'
    else if (maxDeficit < 0.25) ceil.food = 'attention'
  }

  if (sleep > 0) {
    if (sleep < 5.5) floor.sleep = 'alert'
    else if (sleep > 10 || sleep < 7) floor.sleep = 'attention'
    if (sleep >= targets.sleep) ceil.sleep = 'good'
    else if (sleep >= targets.sleep - 0.5) ceil.sleep = 'attention'
  }

  if (stress > 0) {
    if (stress > 8) floor.stress = 'alert'
    else if (stress >= 5) floor.stress = 'attention'
    if (stress < 4) ceil.stress = 'good'
    else if (stress < 5) ceil.stress = 'attention'
  }

  if (mood > 0) {
    if (mood < 4) floor.mood = 'alert'
    else if (mood < 6) floor.mood = 'attention'
    if (mood >= 7) ceil.mood = 'good'
    else if (mood >= 6) ceil.mood = 'attention'
  }

  if (water > 0) {
    if (waterDeficit >= 0.5) floor.water = 'alert'
    else if (waterDeficit < 0.1) ceil.water = 'good'
    else if (waterDeficit < 0.3) ceil.water = 'attention'
  }

  return {
    averages: { calories, protein, sleep, stress, mood, water },
    targets,
    calorieDeficit,
    proteinDeficit,
    waterDeficit,
    floor,
    ceil,
  }
}

export function criticalMetrics(bounds: SeverityBounds): string[] {
  return Object.keys(bounds.floor).filter((metric) => bounds.floor[metric] === 'alert')
}

/** Короткое описание проблемы для раздела обязательных тем в промпте. */
export function describeCriticalMetric(metric: string, bounds: SeverityBounds): string {
  const { averages: avg, targets } = bounds
  const kcal = roundTo(avg.calories, 10)
  const kcalTarget = roundTo(targets.calories, 10)
  switch (metric) {
    case 'food':
      if (avg.calories > targets.calories * 1.75) {
        return `около ${kcal} ккал в день при норме ${kcalTarget}`
      }
      if (bounds.calorieDeficit > 0 && bounds.calorieDeficit >= bounds.proteinDeficit) {
        return `около ${kcal} ккал в день при норме ${kcalTarget}, не хватает примерно ${kcalTarget - kcal}`
      }
      return `около ${Math.round(avg.protein)} г белка в день при норме ${targets.protein} г`
    case 'sleep':
      return `сон около ${avg.sleep.toFixed(1)} ч при норме ${targets.sleep} ч`
    case 'stress':
      return `стресс около ${avg.stress.toFixed(1)} из 10`
    case 'mood':
      return `настроение около ${avg.mood.toFixed(1)} из 10`
    case 'water':
      return `около ${roundTo(avg.water, 50)} мл воды в день при норме ${targets.water} мл`
    default:
      return metric
  }
}

/** Запасная карточка на случай, если LLM пропустила критичную метрику. */
export function buildCriticalCard(metric: string, bounds: SeverityBounds): RecommendationDto {
  const { averages: avg, targets } = bounds
  const fact = describeCriticalMetric(metric, bounds)
  const card = (title: string, description: string): RecommendationDto => ({
    metric: metric as MetricType,
    severity: 'alert',
    title,
    description,
    causal_chain: null,
  })

  switch (metric) {
    case 'food':
      if (bounds.calorieDeficit >= 0.25) {
        const kcal = roundTo(avg.calories, 10)
        const kcalTarget = roundTo(targets.calories, 10)
        return card(
          'Еды заметно меньше твоей нормы',
          `Выходит около ${kcal} ккал в день при норме ${kcalTarget}, то есть не хватает примерно ${kcalTarget - kcal}. ` +
            'Начни с малого: добавь плотный перекус днём, например творог с орехами или бутерброд с яйцом.',
        )
      }
      if (avg.calories > targets.calories * 1.75) {
        return card(
          'Калорий намного больше нормы',
          `Выходит ${fact}. Для начала присмотрись к перекусам и напиткам: часто лишнее прячется именно там.`,
        )
      }
      return card(
        'Белка заметно меньше нормы',
        `Выходит ${fact}. За обедом и ужином добавь понятный источник белка: творог, яйца, рыбу или бобовые.`,
      )
    case 'sleep':
      return card(
        'Сна сейчас слишком мало',
        `Ночь длится около ${avg.sleep.toFixed(1)} ч при норме ${targets.sleep} ч, и такой недосып быстро бьёт по энергии и настроению. ` +
          'На этой неделе попробуй ложиться хотя бы на 30 минут раньше.',
      )
    case 'stress':
      return card(
        'Стресс держится очень высоко',
        `Напряжение держится около ${avg.stress.toFixed(1)} из 10. Вечером выдели время на короткую прогулку или дыхательное упражнение. ` +
          'Если такое состояние длится не первую неделю, лучше обсудить его со специалистом.',
      )
    case 'mood':
      return card(
        'Настроение держится низким',
        `Настроение держится около ${avg.mood.toFixed(1)} из 10. Выбери на завтра одно небольшое приятное дело и не требуй от себя большего. ` +
          'Если такое состояние длится не первую неделю, лучше обсудить его со специалистом.',
      )
    default:
      return card(
        'Воды сильно меньше нормы',
        `Выходит ${fact}. Держи бутылку воды на виду и выпивай стакан за каждым приёмом пищи.`,
      )
  }
}

/** Запасной текст для карточки «можно подтянуть», если шаг стиля не дал чистого результата. */
export function buildAttentionCard(metric: string, bounds: SeverityBounds): RecommendationDto {
  const { averages: avg, targets } = bounds
  const fact = describeCriticalMetric(metric, bounds)
  const card = (title: string, description: string): RecommendationDto => ({
    metric: metric as MetricType,
    severity: 'attention',
    title,
    description,
    causal_chain: null,
  })

  switch (metric) {
    case 'food':
      return card('С едой есть что подтянуть', `Выходит ${fact}. Для начала добавь один небольшой перекус днём.`)
    case 'sleep':
      return card(
        'Ночи могли бы быть длиннее',
        `Ночь длится около ${avg.sleep.toFixed(1)} ч при норме ${targets.sleep} ч. Для начала ложись немного раньше и понаблюдай за самочувствием.`,
      )
    case 'stress':
      return card(
        'Напряжение стоит немного снизить',
        `Сейчас оно около ${avg.stress.toFixed(1)} из 10. Попробуй оставить вечером короткую паузу без телефона и дел.`,
      )
    case 'mood':
      return card(
        'Настроению не хватает опоры',
        `Сейчас оно около ${avg.mood.toFixed(1)} из 10. Запланируй на завтра небольшое дело, которое тебя радует.`,
      )
    case 'water':
      return card('Воды можно пить побольше', `Выходит ${fact}. Для начала выпивай стакан за каждым приёмом пищи.`)
    default:
      return card(
        'Движения можно добавить',
        'Для начала добавь короткую прогулку в обычный день. Даже небольшой шаг заметен к концу недели.',
      )
  }
}
