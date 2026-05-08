// backend/src/insights/calorie-thresholds.service.ts
//
// Расчёт индивидуальных порогов потребления калорий по формуле
// Mifflin-St Jeor (1990) — клинический стандарт оценки BMR. Применяется
// в RecommendationRulesService вместо статических констант 1500/2000/3000,
// чтобы:
//   • для худенькой 50-летней женщины 2000 ккал — норма, не дефицит,
//   • для крупного 25-летнего активного мужчины 3000 ккал — не профицит.
//
// Профиль пользователя содержит ageRange (диапазон), gender и activityLevel,
// но НЕ содержит конкретного веса/роста. Поэтому для веса/роста используются
// популяционные средние по полу — это вносит ошибку ±10–15%, но намного точнее
// единых констант для всех. Если профиль вообще не заполнен — fallback на
// популяционные значения «универсального» взрослого.

import { Injectable } from '@nestjs/common'

import {
  ActivityLevel,
  AgeRange,
  Gender,
} from '../user-profile/user-profile.entity'

export interface CalorieThresholds {
  /** Basal Metabolic Rate, ккал/сутки. */
  bmr: number
  /** Total Daily Energy Expenditure: BMR * activity multiplier, ккал/сутки. */
  tdee: number
  /** Целевое дневное потребление = TDEE (поддержание веса). */
  targetCalories: number
  /** Нижний порог: ниже считается дефицитом → срабатывает правило calorie_deficit. */
  minCalories: number
  /** Верхний порог: выше считается профицитом → срабатывает правило calorie_surplus. */
  maxCalories: number
}

/**
 * Популяционные средние по полу для веса/роста (взрослые 18–60 лет).
 * Источник: Росстат (демография), оценочные значения.
 */
const POPULATION_AVERAGES: Record<
  'male' | 'female' | 'unknown',
  { weightKg: number; heightCm: number }
> = {
  male:    { weightKg: 78, heightCm: 178 },
  female:  { weightKg: 67, heightCm: 165 },
  unknown: { weightKg: 72, heightCm: 171 },
}

/** Середина возрастного диапазона профиля. Для 46+ берём 50 (компромисс). */
const AGE_MIDPOINTS: Record<AgeRange, number> = {
  '18-25': 22,
  '26-35': 30,
  '36-45': 40,
  '46+':   50,
}

/** Множители активности по Harris-Benedict для перевода BMR → TDEE. */
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light:     1.375,
  moderate:  1.55,
  active:    1.725,
}

/**
 * Запасные значения для случая, когда профиль вообще не заполнен.
 * 70 кг, 170 см, 30 лет, активность light — даёт TDEE ≈ 2230 ккал.
 */
const FALLBACK_BMR  = 1620
const FALLBACK_TDEE = 2230

@Injectable()
export class CalorieThresholdsService {

  /**
   * Считает пороги для пользователя. Все входные поля опциональны —
   * для отсутствующих используются популяционные средние.
   *
   * Формула Mifflin-St Jeor:
   *   BMR(male)   = 10W + 6.25H - 5A + 5
   *   BMR(female) = 10W + 6.25H - 5A - 161
   * где W — масса (кг), H — рост (см), A — возраст (лет).
   *
   * Для gender='other'/'prefer_not_to_say' используется средняя из
   * мужской и женской формул (разница в смещении 5 vs -161).
   */
  compute(profile: {
    gender:        Gender   | null
    ageRange:      AgeRange | null
    activityLevel: ActivityLevel | null
  }): CalorieThresholds {
    if (!profile.gender && !profile.ageRange && !profile.activityLevel) {
      return {
        bmr:            FALLBACK_BMR,
        tdee:           FALLBACK_TDEE,
        targetCalories: FALLBACK_TDEE,
        minCalories:    Math.round(FALLBACK_TDEE * 0.75),
        maxCalories:    Math.round(FALLBACK_TDEE * 1.30),
      }
    }

    const populationKey =
      profile.gender === 'male'   ? 'male'   :
      profile.gender === 'female' ? 'female' : 'unknown'
    const { weightKg, heightCm } = POPULATION_AVERAGES[populationKey]
    const age = profile.ageRange ? AGE_MIDPOINTS[profile.ageRange] : 30

    const baseBmr = 10 * weightKg + 6.25 * heightCm - 5 * age
    const genderOffset =
      profile.gender === 'male'   ? 5    :
      profile.gender === 'female' ? -161 :
      // Для нейтральных значений берём середину между мужской и женской формулами.
      (5 + -161) / 2

    const bmr = Math.round(baseBmr + genderOffset)

    const activityMul = profile.activityLevel
      ? ACTIVITY_MULTIPLIERS[profile.activityLevel]
      : ACTIVITY_MULTIPLIERS.light
    const tdee = Math.round(bmr * activityMul)

    return {
      bmr,
      tdee,
      targetCalories: tdee,
      // Нижний порог 75% от TDEE — устойчивый дефицит, который при длительном
      // удержании снижает базовый обмен и ухудшает регуляцию настроения.
      minCalories: Math.round(tdee * 0.75),
      // Верхний порог 130% от TDEE — устойчивый профицит, ведущий к набору веса
      // и ухудшению чувствительности к инсулину при многомесячном удержании.
      maxCalories: Math.round(tdee * 1.30),
    }
  }
}
