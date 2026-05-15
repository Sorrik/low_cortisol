// dto/ml-response.dto.ts

// ── Shared types ──────────────────────────────────────────────
export type MetricType        = 'sleep' | 'food' | 'mood' | 'stress' | 'activity' | 'water'
export type SeverityType      = 'good' | 'attention' | 'alert'
export type PhaseMode         = 'cold_start' | 'learning' | 'personal'
export type Direction         = 'positive' | 'negative'
export type TriggerSourceType = 'rule' | 'ml_shap' | 'llm' | 'consistency' | 'fallback'
export type ConfidenceType    = 'low' | 'medium' | 'high'
export type ChainStrengthType = 'weak' | 'moderate' | 'strong'

export class TriggerSignalDto {
  source!:           TriggerSourceType
  metric?:           MetricType | null
  current_value?:    number | null
  personal_baseline?: number | null
  z_score?:          number | null
  delta_7d?:         number | null
  shap_contribution?: number | null
  confidence?:       ConfidenceType | null
}

export class ModelMetaDto {
  version?:             string | null
  samples_used?:        number | null
  cv_status?:           'ok' | 'insufficient_data' | null
  cv_mae?:              number | null
  cv_r2?:               number | null
  baseline_mae?:        number | null
  baseline_r2?:         number | null
  improvement_mae_pct?: number | null
}

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

/**
 * Ссылка на причинно-следственную цепочку, на которой построена рекомендация.
 * Заполняется LLM при использовании ПРИЧИННО-СЛЕДСТВЕННЫХ ЦЕПОЧЕК из
 * промпта (см. CausalChainService). null — если рекомендация одиночная.
 */
export class CausalChainDto {
  chain_id!:  string
  trigger!:   string
  mediator?:  string | null
  outcome!:   string
  lag!:       string
  strength!:  ChainStrengthType
}

export class RecommendationDto {
  id?:             string
  metric!:         MetricType
  severity!:       SeverityType
  title!:          string
  description!:    string
  rule_id?:        string | null
  trigger_signal?: TriggerSignalDto | null
  causal_chain?:   CausalChainDto | null
}

export class MlPredictResponseDto {
  user_id!:           string
  phase!:             PhaseInfoDto
  predicted_mood!:    number | null
  confidence_lower!:  number | null
  confidence_upper!:  number | null
  top_influencers!:   InfluencerDto[]
  recommendations!:   RecommendationDto[]
  model_version!:     string
  model_meta?:        ModelMetaDto | null
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
