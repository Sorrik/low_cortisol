// dto/ml-train.dto.ts
import { HealthDataDto } from './ml-predict.dto'

export class MlTrainDto {
  user_id!:     string
  health_data!: HealthDataDto
}
