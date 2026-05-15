// backend/src/user-profile/dto/onboarding.dto.ts

import {
  IsString, IsEnum, IsArray, IsNumber, IsOptional,
  Min, Max, ArrayMinSize,
} from 'class-validator'
import {
  GoalType, SleepChronotype, ActivityLevel,
  SportType, AgeRange, Gender, NutritionGoal,
} from '../user-profile.entity'

const GOALS            = ['sleep', 'stress', 'energy', 'mood', 'weight']
const SPORT_TYPES      = ['running', 'gym', 'yoga', 'cycling', 'swimming', 'team_sports', 'martial_arts', 'home_workout', 'none']
const SPORT_GOALS      = ['lose_weight', 'build_muscle', 'improve_endurance', 'stay_healthy', 'reduce_stress']
const CHRONOTYPES      = ['early_bird', 'night_owl', 'no_routine']
const ACT_LEVELS       = ['sedentary', 'light', 'moderate', 'active']
const GENDERS          = ['male', 'female']
const NUTRITION_GOALS  = ['lose_weight', 'maintain', 'muscle_gain']

// Старый AGE_RANGES оставлен для обратной совместимости старых клиентов,
// которые пока шлют ageRange (если такие есть). При новой регистрации
// предпочитается поле age.
const AGE_RANGES       = ['18-25', '26-35', '36-45', '46+']

// ── Шаг 1 — анкета о теле ─────────────────────────────────────
export class OnboardingStep1Dto {
  @IsNumber()
  @Min(13)
  @Max(120)
  age!: number

  @IsNumber()
  @Min(30)
  @Max(300)
  weightKg!: number

  @IsNumber()
  @Min(100)
  @Max(250)
  heightCm!: number

  @IsEnum(GENDERS)
  gender!: Gender

  @IsString()
  @IsOptional()
  name?: string

  /**
   * @deprecated клиенты могут продолжать слать ageRange для совместимости,
   * но при наличии age оно игнорируется.
   */
  @IsEnum(AGE_RANGES)
  @IsOptional()
  ageRange?: AgeRange
}

// ── Шаг 2 — цели ──────────────────────────────────────────────
export class OnboardingStep2Dto {
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(GOALS, { each: true })
  goals!: GoalType[]

  @IsEnum(GOALS)
  primaryGoal!: GoalType

  /** Цель по питанию. Влияет на расчёт target_calories. */
  @IsEnum(NUTRITION_GOALS)
  nutritionGoal!: NutritionGoal
}

// ── Шаг 3 ─────────────────────────────────────────────────────
export class OnboardingStep3Dto {
  @IsEnum(CHRONOTYPES)
  chronotype!: SleepChronotype

  @IsNumber()
  @Min(5)
  @Max(12)
  sleepGoalHours!: number
}

// ── Шаг 4 ─────────────────────────────────────────────────────
export class OnboardingStep4Dto {
  @IsEnum(ACT_LEVELS)
  activityLevel!: ActivityLevel

  @IsArray()
  @IsEnum(SPORT_TYPES, { each: true })
  sportTypes!: SportType[]

  @IsNumber()
  @Min(0)
  @Max(7)
  workoutsPerWeek!: number

  @IsNumber()
  @Min(0)
  @Max(180)
  avgWorkoutDurationMin!: number

  @IsEnum(SPORT_GOALS)
  @IsOptional()
  sportGoal?: string
}

// ── Шаг 5 ─────────────────────────────────────────────────────
export class OnboardingStep5Dto {
  @IsNumber()
  @Min(1)
  @Max(10)
  baselineStress!: number
}

// ── Полный объект ──────────────────────────────────────────────
export class CompleteOnboardingDto {
  @IsNumber()
  @Min(13)
  @Max(120)
  age!: number

  @IsNumber()
  @Min(30)
  @Max(300)
  weightKg!: number

  @IsNumber()
  @Min(100)
  @Max(250)
  heightCm!: number

  @IsEnum(GENDERS)
  gender!: Gender

  @IsString()
  @IsOptional()
  name?: string

  /** @deprecated см. OnboardingStep1Dto.ageRange */
  @IsEnum(AGE_RANGES)
  @IsOptional()
  ageRange?: AgeRange

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(GOALS, { each: true })
  goals!: GoalType[]

  @IsEnum(GOALS)
  primaryGoal!: GoalType

  @IsEnum(NUTRITION_GOALS)
  nutritionGoal!: NutritionGoal

  @IsEnum(CHRONOTYPES)
  chronotype!: SleepChronotype

  @IsNumber()
  @Min(5)
  @Max(12)
  sleepGoalHours!: number

  @IsEnum(ACT_LEVELS)
  activityLevel!: ActivityLevel

  @IsArray()
  @IsEnum(SPORT_TYPES, { each: true })
  sportTypes!: SportType[]

  @IsNumber()
  @Min(0)
  @Max(7)
  workoutsPerWeek!: number

  @IsNumber()
  @Min(0)
  @Max(180)
  avgWorkoutDurationMin!: number

  @IsEnum(SPORT_GOALS)
  @IsOptional()
  sportGoal?: string

  @IsNumber()
  @Min(1)
  @Max(10)
  baselineStress!: number
}

// ── Response ──────────────────────────────────────────────────
export class UserProfileResponseDto {
  id!:                    string
  userId!:                string
  name!:                  string | null
  age!:                   number | null
  weightKg!:              number | null
  heightCm!:              number | null
  /** @deprecated клиенты должны опираться на age. */
  ageRange!:              AgeRange | null
  gender!:                Gender | null
  goals!:                 GoalType[]
  primaryGoal!:           GoalType | null
  nutritionGoal!:         NutritionGoal | null
  chronotype!:            SleepChronotype | null
  sleepGoalHours!:        number | null
  activityLevel!:         ActivityLevel | null
  sportTypes!:            SportType[]
  workoutsPerWeek!:       number | null
  avgWorkoutDurationMin!: number | null
  sportGoal!:             string | null
  baselineStress!:        number | null
  onboardingCompleted!:   boolean
  /**
   * Рассчитанные на лету индивидуальные пороги калорий (Mifflin-St Jeor
   * с учётом nutritionGoal). Возвращаются для отображения в профиле.
   */
  calorieTargets?: {
    bmr:            number
    tdee:           number
    targetCalories: number
    minCalories:    number
    maxCalories:    number
  }
}
