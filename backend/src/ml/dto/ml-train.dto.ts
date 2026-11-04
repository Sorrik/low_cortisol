// dto/ml-train.dto.ts
import { HealthDataDto } from './ml-predict.dto'

export class MlTrainDto {
  user_id!:      string
  health_data!:  Record<string, any>
  user_profile?: {               // ← новое: ML адаптирует пороги под личные нормы
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