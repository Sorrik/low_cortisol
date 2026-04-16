// backend/src/user-profile/dto/onboarding.dto.ts

import {
  IsString, IsEnum, IsArray, IsNumber, IsOptional,
  Min, Max, ArrayMinSize,
} from 'class-validator'
import {
  GoalType, SleepChronotype, ActivityLevel,
  SportType, AgeRange, Gender,
} from '../user-profile.entity'

const GOALS       = ['sleep', 'stress', 'energy', 'mood', 'weight']
const SPORT_TYPES = ['running', 'gym', 'yoga', 'cycling', 'swimming', 'team_sports', 'martial_arts', 'home_workout', 'none']
const SPORT_GOALS = ['lose_weight', 'build_muscle', 'improve_endurance', 'stay_healthy', 'reduce_stress']
const CHRONOTYPES = ['early_bird', 'night_owl', 'no_routine']
const ACT_LEVELS  = ['sedentary', 'light', 'moderate', 'active']
const AGE_RANGES  = ['18-25', '26-35', '36-45', '46+']
const GENDERS     = ['male', 'female', 'other', 'prefer_not_to_say']

// ── Шаг 1 ─────────────────────────────────────────────────────
export class OnboardingStep1Dto {
  @IsEnum(AGE_RANGES)
  ageRange!: AgeRange

  @IsEnum(GENDERS)
  gender!: Gender

  @IsString()
  @IsOptional()
  name?: string
}

// ── Шаг 2 ─────────────────────────────────────────────────────
export class OnboardingStep2Dto {
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(GOALS, { each: true })
  goals!: GoalType[]

  @IsEnum(GOALS)
  primaryGoal!: GoalType
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
  @IsEnum(AGE_RANGES)
  ageRange!: AgeRange

  @IsEnum(GENDERS)
  gender!: Gender

  @IsString()
  @IsOptional()
  name?: string

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(GOALS, { each: true })
  goals!: GoalType[]

  @IsEnum(GOALS)
  primaryGoal!: GoalType

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
  ageRange!:              AgeRange | null
  gender!:                Gender | null
  goals!:                 GoalType[]
  primaryGoal!:           GoalType | null
  chronotype!:            SleepChronotype | null
  sleepGoalHours!:        number | null
  activityLevel!:         ActivityLevel | null
  sportTypes!:            SportType[]
  workoutsPerWeek!:       number | null
  avgWorkoutDurationMin!: number | null
  sportGoal!:             string | null
  baselineStress!:        number | null
  onboardingCompleted!:   boolean
}