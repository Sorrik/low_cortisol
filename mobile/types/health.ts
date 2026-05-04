// mobile/types/health.ts
export type MetricType   = 'sleep' | 'food' | 'mood' | 'stress' | 'activity' | 'water'
export type SeverityType = 'good' | 'attention' | 'alert'

export type AnomalyType     = 'spike' | 'drop' | 'trend' | 'gap'
export type AnomalySeverity = 'warning' | 'critical'
export type AnomalyMetric   = 'sleep' | 'stress' | 'mood' | 'activity' | 'water' | 'nutrition'

export interface SleepRecord {
  id: string; date: string
  hours: number; quality: number
  bedTime?: string; wakeTime?: string
  interruptions?: number; notes?: string
}

export interface NutritionRecord {
  id: string; date: string
  kcal: number; proteins: number; fats: number; carbs: number
  mealName?: string; mealType?: string
  description?: string; notes?: string
}

export interface MoodRecord {
  id: string; date: string
  value: number; notes?: string
}

export interface StressRecord {
  id: string; date: string
  level: number; notes?: string
}

export interface ActivityRecord {
  id: string; date: string
  type?: string
  duration: number
  intensity?: string
  caloriesBurned?: number
  calories?: number
  steps?: number
  notes?: string
}

export interface WaterRecord {
  id: string; date: string
  glasses: number; amountMl?: number; notes?: string
}

export interface Profile {
  firstName: string; lastName: string
  email: string; birthDate?: string
}

export type TriggerSource = 'rule' | 'ml_shap' | 'llm' | 'consistency' | 'fallback'
export type Confidence    = 'low' | 'medium' | 'high'

export interface TriggerSignal {
  source:             TriggerSource
  metric?:            MetricType | null
  current_value?:     number | null
  personal_baseline?: number | null
  z_score?:           number | null
  delta_7d?:          number | null
  shap_contribution?: number | null
  confidence?:        Confidence | null
}

export interface Recommendation {
  id?:             string
  metric:          MetricType
  severity:        SeverityType
  title:           string
  description:     string
  rule_id?:        string | null
  trigger_signal?: TriggerSignal | null
}

export interface ModelMeta {
  version?:             string | null
  samples_used?:        number | null
  cv_status?:           'ok' | 'insufficient_data' | null
  cv_mae?:              number | null
  cv_r2?:               number | null
  baseline_mae?:        number | null
  baseline_r2?:         number | null
  improvement_mae_pct?: number | null
}

export interface RuleRecommendation {
  ruleId: string
  category: 'nutrition' | 'sleep' | 'activity' | 'stress' | 'mood'
  severity: 'critical' | 'warning' | 'info'
  title: string
  shortReason: string
  suggestion: string
  priority: number
  metricValue: number
  threshold: number
  deltaFromNorm: number
  tags: string[]
}

export interface ArticleSource {
  index: number; pmid: string; title: string; year: string; url: string
}

export interface PhaseInfo {
  mode:             'cold_start' | 'learning' | 'personal'
  total_records:    number
  records_needed:   number
  accuracy_percent?: number
  message?:         string
}

export interface Influencer {
  factor: string; impact: number; raw_shap: number | null
  direction: 'positive' | 'negative'
  description: string; feature_value: number | null
}

export interface DataCompleteness {
  sleep: number; mood: number; stress: number
  activity: number; nutrition: number; water: number
}

export interface InsightsResponse {
  user_id?:          string
  phase:             PhaseInfo
  predicted_mood:    number | null
  confidence_lower?: number | null
  confidence_upper?: number | null
  top_influencers?:  Influencer[]
  recommendations:   Recommendation[]
  mlRecommendations?: Recommendation[]
  sources?:          ArticleSource[]
  ruleRecommendations?: RuleRecommendation[]
  hasCriticalAlerts?: boolean
  anomalyReport?:    AnomalyReport
  model_version?:    string
  model_meta?:       ModelMeta | null
  disclaimer?:       string
  data_completeness?: DataCompleteness
}

export interface Anomaly {
  metric:        AnomalyMetric
  type:          AnomalyType
  severity:      AnomalySeverity
  value:         number | null
  norm:          number | null
  deviation:     number | null
  message:       string
  date:          string
  daysAffected?: number
}

export interface AnomalyReport {
  hasAnomalies: boolean; hasCritical: boolean
  anomalies: Anomaly[]; gapDays: number
  dataQuality: number; message: string | null
}

export interface GamificationDto {
  streakAny: number; streakFull: number; streakNorm: number
  longestAny: number; longestFull: number; longestNorm: number
  totalPoints: number; level: number; levelName: string
  nextLevelAt: number | null
  badges: string[]; badgeDates: Record<string, string>
  recentBadges: string[]; totalEntries: number
  streakFreezeUsed: boolean
}

export interface StreakInfo { current: number; best: number }

export interface FullStreakData {
  anyData: StreakInfo; allMetrics: StreakInfo; goalsMet: StreakInfo
}

export interface UserLevelInfo {
  level: string; name: string
  xp: number; nextLevelXp: number; totalXp: number
}

export interface Achievement {
  id: string; title: string; description: string; icon: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  category: 'streak' | 'goal' | 'improvement' | 'anomaly' | 'level'
  points: number; progress: number; maxProgress: number; unlockedAt?: string
}

export const STREAK_MILESTONES = [3, 5, 7, 10, 14, 20, 30, 60, 100] as const

export const LEVEL_CONFIG: Record<string, { name: string; minXp: number; color: string }> = {
  beginner: { name: 'Новичок',  minXp: 0,    color: '#22c55e' },
  amateur:  { name: 'Любитель', minXp: 300,  color: '#3b82f6' },
  expert:   { name: 'Эксперт',  minXp: 700,  color: '#8b5cf6' },
  master:   { name: 'Мастер',   minXp: 1500, color: '#f59e0b' },
}

export type HealthRecord =
  | SleepRecord | NutritionRecord | MoodRecord
  | StressRecord | ActivityRecord | WaterRecord

export interface MetricConfig {
  key: MetricType; label: string; icon: string; color: string; unit: string
}
