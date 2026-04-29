// dto/ml-response.dto.ts

// ── Shared types ──────────────────────────────────────────────
export type MetricType   = 'sleep' | 'food' | 'mood' | 'stress' | 'activity' | 'water'
export type SeverityType = 'good' | 'attention' | 'alert'
export type PhaseMode    = 'cold_start' | 'learning' | 'personal'
export type Direction    = 'positive' | 'negative'

// ── Predict response ──────────────────────────────────────────
export class PhaseInfoDto {
  mode!:             PhaseMode
  total_records!:    number
  records_needed!:   number
  accuracy_percent!: number
  message!:          string
}

export class InfluencerDto {
  factor!:        string
  impact!:        number
  raw_shap!:      number | null
  direction!:     Direction
  description!:   string
  feature_value!: number | null
}

export class DataCompletenessDto {
  sleep!:     number   // 0–100
  mood!:      number
  stress!:    number
  activity!:  number
  nutrition!: number
  water!:     number
}

export class RecommendationDto {          // ← новый класс
  metric!:      MetricType
  severity!:    SeverityType
  title!:       string
  description!: string
}

export class MlPredictResponseDto {
  user_id!:           string
  phase!:             PhaseInfoDto
  predicted_mood!:    number | null
  confidence_lower!:  number | null
  confidence_upper!:  number | null
  top_influencers!:   InfluencerDto[]
  recommendations!:   RecommendationDto[]   // ← было string[]
  model_version!:     string
  data_completeness!: DataCompletenessDto
}

// ── Train response ────────────────────────────────────────────
export class MlTrainResponseDto {
  status!:         string
  user_id!:        string
  phase!:          PhaseMode
  total_records!:  number
  samples_used!:   number
  features_count!: number
  cv_mae!:         number | null
  cv_r2!:          number | null
  oob_r2!:         number | null
  model_version!:  string
  trained_at!:     string
  message!:        string
}
