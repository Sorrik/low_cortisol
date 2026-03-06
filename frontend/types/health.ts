// types/health.ts

// ── Shared ────────────────────────────────────────────────────
export type MetricType   = "sleep" | "food" | "mood" | "stress" | "activity" | "water"
export type SeverityType = "good" | "attention" | "alert"

// ── Records ───────────────────────────────────────────────────

export interface SleepRecord {
  id:             string
  date:           string
  hours:          number
  quality:        number
  bedTime?:       string
  wakeTime?:      string
  interruptions?: number
  notes?:         string
}

export interface NutritionRecord {
  id:        string
  date:      string
  kcal:      number
  proteins:  number
  fats:      number
  carbs:     number
  mealName?: string
  notes?:    string
}

export interface MoodRecord {
  id:     string
  date:   string
  value:  number
  notes?: string
}

export interface StressRecord {
  id:     string
  date:   string
  level:  number
  notes?: string
}

export interface ActivityRecord {
  id:              string
  date:            string
  type:            "walk" | "run" | "yoga" | "gym" | "sport" | "other"
  duration:        number
  intensity?:      "light" | "moderate" | "vigorous"
  caloriesBurned?: number
  steps?:          number
  notes?:          string
}

export interface WaterRecord {
  id:        string
  date:      string
  glasses:   number
  amountMl?: number
  notes?:    string
}

// ── Recommendations ───────────────────────────────────────────

export interface Recommendation {
  id:          string
  metric:      MetricType
  severity:    SeverityType
  title:       string
  description: string
}

// ── Article Source — объявляем ДО InsightsResponse ───────────

export interface ArticleSource {
  index: number
  pmid:  string
  title: string
  year:  string
  url:   string
}

// ── ML Insights ───────────────────────────────────────────────

export interface PhaseInfo {
  mode:             "cold_start" | "learning" | "personal"
  total_records:    number
  records_needed:   number
  accuracy_percent: number
  message:          string
}

export interface Influencer {
  factor:        string
  impact:        number
  raw_shap:      number | null
  direction:     "positive" | "negative"
  description:   string
  feature_value: number | null
}

export interface DataCompleteness {
  sleep:     number
  mood:      number
  stress:    number
  activity:  number
  nutrition: number
  water:     number
}

export interface InsightsResponse {
  user_id:           string
  phase:             PhaseInfo
  predicted_mood:    number | null
  confidence_lower:  number | null
  confidence_upper:  number | null
  top_influencers:   Influencer[]
  recommendations:   Recommendation[]
  sources?:          ArticleSource[]   // ← теперь тип известен
  model_version:     string
  data_completeness: DataCompleteness
}

// ── UI config ─────────────────────────────────────────────────

export interface MetricConfig {
  key:   MetricType
  label: string
  icon:  string
  color: string
  unit:  string
}

// ── Union ─────────────────────────────────────────────────────

export type HealthRecord =
  | SleepRecord
  | NutritionRecord
  | MoodRecord
  | StressRecord
  | ActivityRecord
  | WaterRecord

export interface Profile {
  firstName: string
  lastName:  string
  email:     string
  birthDate: string
}