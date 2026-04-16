// types/health.ts

// ── Shared ────────────────────────────────────────────────────
export type MetricType   = "sleep" | "food" | "mood" | "stress" | "activity" | "water"
export type SeverityType = "good" | "attention" | "alert"

export type AnomalyType     = 'spike' | 'drop' | 'trend' | 'gap'
export type AnomalySeverity = 'warning' | 'critical'
export type AnomalyMetric   = 'sleep' | 'stress' | 'mood' | 'activity' | 'water' | 'nutrition'
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
  id?:         string
  metric:      MetricType
  severity:    SeverityType
  title:       string
  description: string
}

export interface RuleRecommendation {
  ruleId:        string
  category:      'nutrition' | 'sleep' | 'activity' | 'stress' | 'mood'
  severity:      'critical' | 'warning' | 'info'
  title:         string
  shortReason:   string
  suggestion:    string
  priority:      number
  metricValue:   number
  threshold:     number
  deltaFromNorm: number
  tags:          string[]
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
  mlRecommendations?: Recommendation[]
  sources?:          ArticleSource[]
  ruleRecommendations?: RuleRecommendation[]
  hasCriticalAlerts?: boolean
  anomalyReport?:     AnomalyReport
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

export interface Anomaly {
  metric:       AnomalyMetric
  type:         AnomalyType
  severity:     AnomalySeverity
  value:        number | null
  norm:         number | null
  deviation:    number | null
  message:      string
  date:         string
  daysAffected?: number
}
 
export interface AnomalyReport {
  hasAnomalies: boolean
  hasCritical:  boolean
  anomalies:    Anomaly[]
  gapDays:      number
  dataQuality:  number    // 0-100%
  message:      string | null
}

// Добавить в frontend/types/health.ts

// ── Геймификация ──────────────────────────────────────────────

export interface StreakInfo {
  current: number
  best:    number
}

export interface FullStreakData {
  anyData:    StreakInfo   // 🔥 Любые данные
  allMetrics: StreakInfo   // ✨ Все 6 метрик
  goalsMet:   StreakInfo   // 🎯 Выполнение нормы
}

export interface UserLevelInfo {
  level:       string      // ключ: 'beginner' | 'amateur' | 'expert' | 'master'
  name:        string      // 'Новичок' | 'Любитель' | 'Эксперт' | 'Мастер'
  xp:          number      // очки на текущем уровне (от порога)
  nextLevelXp: number      // сколько нужно до следующего
  totalXp:     number      // всего очков
}

export interface Achievement {
  id:          string
  title:       string
  description: string
  icon:        string      // ключ для iconMap
  rarity:      'common' | 'rare' | 'epic' | 'legendary'
  category:    'streak' | 'goal' | 'improvement' | 'anomaly' | 'level'
  points:      number
  progress:    number      // текущий прогресс
  maxProgress: number      // цель
  unlockedAt?: string      // ISO date если получен
}

// Миллстоуны для отображения прогресса стрика
export const STREAK_MILESTONES = [3, 5, 7, 10, 14, 20, 30, 60, 100] as const

// Конфиг уровней для отображения прогрессии
export const LEVEL_CONFIG: Record<string, { name: string; minXp: number; color: string }> = {
  beginner: { name: 'Новичок',  minXp: 0,    color: 'text-green-400'  },
  amateur:  { name: 'Любитель', minXp: 300,  color: 'text-blue-400'   },
  expert:   { name: 'Эксперт',  minXp: 700,  color: 'text-purple-400' },
  master:   { name: 'Мастер',   minXp: 1500, color: 'text-amber-400'  },
}

// GamificationDto — ответ от GET /gamification
export interface GamificationDto {
  streakAny:        number
  streakFull:       number
  streakNorm:       number
  longestAny:       number
  longestFull:      number
  longestNorm:      number
  totalPoints:      number
  level:            number
  levelName:        string
  nextLevelAt:      number | null
  badges:           string[]
  badgeDates:       Record<string, string>
  recentBadges:     string[]
  totalEntries:     number
  streakFreezeUsed: boolean
}
