// dto/ml-predict.dto.ts

export class SleepRecordDto {
  date!:           string
  duration_hours!: number
  quality!:        number
  interruptions?:  number
}

export class MoodRecordDto {
  date!:       string
  mood_score!: number
}

export class StressRecordDto {
  date!:  string
  level!: number
}

export class ActivityRecordDto {
  date!:              string
  duration_minutes!:  number
  intensity?:         string
  calories_burned?:   number
}

export class WaterRecordDto {
  date!:      string
  amount_ml!: number
}

export class NutritionRecordDto {
  date!:          string
  calories!:      number
  protein_grams!: number
  carbs_grams?:   number
  fat_grams?:     number
}

export class HealthDataDto {
  user_id!:    string
  sleep?:      SleepRecordDto[]
  mood?:       MoodRecordDto[]
  stress?:     StressRecordDto[]
  activity?:   ActivityRecordDto[]
  water?:      WaterRecordDto[]
  nutrition?:  NutritionRecordDto[]
}

// backend/src/ml/dto/ml-predict.dto.ts

export class MlPredictDto {
  user_id!:      string
  health_data!:  Record<string, any>
  user_profile?: {               // ← новое: личные нормы из анкеты
    sleepGoalHours:        number
    baselineStress:        number
    chronotype:            string
    primaryGoal:           string
    activityLevel:         string
    workoutsPerWeek:       number
    avgWorkoutDurationMin: number
    weeklyTrainingMinutes: number
    sportGoal:             string | null
  }
}
