// backend/src/insights/calorie-thresholds.service.ts
//
// Расчёт индивидуальных порогов потребления калорий по формуле
// Mifflin-St Jeor (1990) — клинический стандарт оценки BMR.
//
// С момента введения точных полей age/weightKg/heightCm в профиле
// используется их фактические значения; для незаполненных полей
// применяются популяционные средние по полу как fallback.
//
// Поле nutritionGoal (lose_weight / maintain / muscle_gain) сдвигает
// targetCalories относительно TDEE и пересчитывает min/max границы:
//   - lose_weight  → target = TDEE * 0.85 (дефицит 15%)
//   - maintain     → target = TDEE * 1.00
//   - muscle_gain  → target = TDEE * 1.10 (профицит 10%)

import { Injectable } from '@nestjs/common'

import {
  ActivityLevel,
  AgeRange,
  Gender,
  NutritionGoal,
} from '../user-profile/user-profile.entity'

export interface CalorieThresholds {
  /** Basal Metabolic Rate, ккал/сутки. */
  bmr: number
  /** Total Daily Energy Expenditure: BMR * activity multiplier, ккал/сутки. */
  tdee: number
  /**
   * Целевое дневное потребление с учётом nutritionGoal:
   *   lose_weight  → 0.85 × TDEE
   *   maintain     → 1.00 × TDEE
   *   muscle_gain  → 1.10 × TDEE
   */
  targetCalories: number
  /** Нижний порог: ниже считается дефицитом → правило calorie_deficit. */
  minCalories: number
  /** Верхний порог: выше считается профицитом → правило calorie_surplus. */
  maxCalories: number
}

export interface CalorieThresholdsInput {
  gender:        Gender   | null
  /** Точный возраст из профиля. Приоритет над ageRange. */
  age?:          number   | null
  /** Точный вес в кг. Если null — берётся популяционное среднее по полу. */
  weightKg?:     number   | null
  /** Точный рост в см. Если null — берётся популяционное среднее по полу. */
  heightCm?:     number   | null
  /** @deprecated fallback для записей до миграции на age. */
  ageRange:      AgeRange | null
  activityLevel: ActivityLevel | null
  /** Цель по питанию. По умолчанию maintain. */
  nutritionGoal?: NutritionGoal | null
}

/**
 * Популяционные средние по полу для веса/роста (взрослые 18–60 лет).
 * Используются ТОЛЬКО когда соответствующее поле отсутствует в профиле.
 */
const POPULATION_AVERAGES: Record<
  'male' | 'female' | 'unknown',
  { weightKg: number; heightCm: number }
> = {
  male:    { weightKg: 78, heightCm: 178 },
  female:  { weightKg: 67, heightCm: 165 },
  unknown: { weightKg: 72, heightCm: 171 },
}

/** Середина возрастного диапазона (для старых записей с ageRange). */
const AGE_MIDPOINTS: Record<AgeRange, number> = {
  '18-25': 22,
  '26-35': 30,
  '36-45': 40,
  '46+':   50,
}

/** Множители активности по Harris-Benedict для BMR → TDEE. */
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light:     1.375,
  moderate:  1.55,
  active:    1.725,
}

/** Коэффициенты дефицита/профицита по цели питания. */
const NUTRITION_GOAL_FACTORS: Record<NutritionGoal, number> = {
  lose_weight: 0.85,
  maintain:    1.0,
  muscle_gain: 1.1,
}

/** Запасные значения для полностью пустого профиля. */
const FALLBACK_BMR  = 1620
const FALLBACK_TDEE = 2230

/**
 * Чистая функция расчёта порогов калорий. Используется как самим
 * CalorieThresholdsService (DI-обёртка для использования из NestJS-сервисов
 * с инъекцией), так и напрямую — например, в UserProfileService при
 * формировании DTO профиля. Чистая функция без побочных эффектов позволяет
 * избежать циклической зависимости между UserProfileModule и InsightsModule.
 */
export function computeCalorieThresholds(
  input: CalorieThresholdsInput,
): CalorieThresholds {
  // Полностью пустой профиль → fallback по умолчанию.
  if (
    !input.gender &&
    input.age == null &&
    input.weightKg == null &&
    input.heightCm == null &&
    !input.ageRange &&
    !input.activityLevel
  ) {
    return {
      bmr:            FALLBACK_BMR,
      tdee:           FALLBACK_TDEE,
      targetCalories: FALLBACK_TDEE,
      minCalories:    Math.round(FALLBACK_TDEE * 0.75),
      maxCalories:    Math.round(FALLBACK_TDEE * 1.30),
    }
  }

  const populationKey =
    input.gender === 'male'   ? 'male'   :
    input.gender === 'female' ? 'female' : 'unknown'

  const populationDefaults = POPULATION_AVERAGES[populationKey]
  const weightKg = input.weightKg ?? populationDefaults.weightKg
  const heightCm = input.heightCm ?? populationDefaults.heightCm
  const age =
    input.age ??
    (input.ageRange ? AGE_MIDPOINTS[input.ageRange] : 30)

  const baseBmr = 10 * weightKg + 6.25 * heightCm - 5 * age
  const genderOffset =
    input.gender === 'male'   ?  5  :
    input.gender === 'female' ? -161 :
    // Для null/unknown — берём середину между мужской и женской формулами.
    (5 + -161) / 2

  const bmr = Math.round(baseBmr + genderOffset)

  const activityMul = input.activityLevel
    ? ACTIVITY_MULTIPLIERS[input.activityLevel]
    : ACTIVITY_MULTIPLIERS.light
  const tdee = Math.round(bmr * activityMul)

  const nutritionFactor = input.nutritionGoal
    ? NUTRITION_GOAL_FACTORS[input.nutritionGoal]
    : NUTRITION_GOAL_FACTORS.maintain
  const targetCalories = Math.round(tdee * nutritionFactor)

  return {
    bmr,
    tdee,
    targetCalories,
    // Минимальный/максимальный порог считаются от target, чтобы при цели
    // muscle_gain допустимый диапазон смещался выше, а при lose_weight —
    // ниже, и срабатывание правил calorie_deficit/surplus оставалось
    // адекватным цели.
    minCalories: Math.round(targetCalories * 0.85),
    maxCalories: Math.round(targetCalories * 1.20),
  }
}

@Injectable()
export class CalorieThresholdsService {
  /** Совместимая обёртка над computeCalorieThresholds для DI. */
  compute(input: CalorieThresholdsInput): CalorieThresholds {
    return computeCalorieThresholds(input)
  }
}
