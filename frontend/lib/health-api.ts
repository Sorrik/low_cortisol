import api from "./api"

import type {
  SleepRecord, NutritionRecord, MoodRecord,
  StressRecord, ActivityRecord, WaterRecord,
  InsightsResponse, Recommendation,   Profile,
} from "@/types/health"

// ── Helpers ───────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getData = <T>(res: { data: { data?: T[]; results?: T[] } | T[] }): T[] => {
  const payload = res.data
  if (Array.isArray(payload))         return payload
  if (Array.isArray(payload.data))    return payload.data
  if (Array.isArray(payload.results)) return payload.results
  return []
}

/** Текущее время в формате HH:MM — дефолт для обязательного поля time */
export const nowTime = (): string => new Date().toTimeString().slice(0, 5)

// ── Mappers (API → Frontend) ──────────────────────────────
function calcHours(bed?: string, wake?: string): number {
  if (!bed || !wake) return 0
  const [bh, bm] = bed.split(":").map(Number)
  const [wh, wm] = wake.split(":").map(Number)
  let minutes = (wh * 60 + wm) - (bh * 60 + bm)
  if (minutes < 0) minutes += 24 * 60
  return Math.round((minutes / 60) * 10) / 10
}

const ACTIVITY_TYPE_MAP: Record<string, ActivityRecord["type"]> = {
  walk: "walk", run: "run", yoga: "yoga",
  gym: "gym", sport: "sport", other: "other",
  walking: "walk", running: "run", cycling: "other",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapSleep = (r: any): SleepRecord => ({
  id:            r.id,
  date:          r.date,
  hours:         r.duration_hours ?? calcHours(r.bedTime, r.wakeTime) ?? 0,
  quality:       r.quality ?? 0,
  bedTime:       r.bedTime,
  wakeTime:      r.wakeTime,
  interruptions: r.interruptions,
  notes:         r.notes,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapNutrition = (r: any): NutritionRecord => ({
  id:       r.id,
  date:     r.date,
  kcal:     r.calories    ?? r.kcal ?? 0,
  proteins: r.proteinGrams ?? r.protein_grams ?? r.proteins ?? 0,  // ← camelCase first
  fats:     r.fatGrams     ?? r.fat_grams     ?? r.fats     ?? 0,  // ← camelCase first
  carbs:    r.carbsGrams   ?? r.carbs_grams   ?? r.carbs    ?? 0,  // ← camelCase first
  mealName: r.mealType     ?? r.meal_name     ?? r.mealName,       // ← mealType first
  notes:    r.description  ?? r.notes,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapMood = (r: any): MoodRecord => ({
  id:    r.id,
  date:  r.date,
  value: r.moodScore ?? r.value ?? r.mood_score ?? 0,  // ← moodScore first!
  notes: r.notes,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapStress = (r: any): StressRecord => ({
  id:    r.id,
  date:  r.date,
  level: r.level ?? 0,
  notes: r.notes,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapActivity = (r: any): ActivityRecord => ({
  id:             r.id,
  date:           r.date,
  type:           ACTIVITY_TYPE_MAP[r.type] ?? "other",
  duration:       r.durationMinutes  ?? r.duration_minutes ?? r.duration ?? 0,  // ← camelCase first
  intensity:      r.intensity,
  caloriesBurned: r.caloriesBurned   ?? r.calories_burned,  // ← camelCase first
  steps:          r.steps,
  notes:          r.notes,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapWater = (r: any): WaterRecord => ({
  id:       r.id,
  date:     r.date,
  glasses:  r.glasses  ?? Math.round((r.amountMl ?? r.amount_ml ?? 0) / 250),  // ← amountMl first
  amountMl: r.amountMl ?? r.amount_ml ?? (r.glasses ? r.glasses * 250 : 0),    // ← amountMl first
  notes:    r.notes,
})

// ── Payload types (точное соответствие бэкенд DTO) ────────

export type SleepPayload = {
  date:           string
  bedTime:        string   // "23:00"
  wakeTime:       string   // "07:00"
  quality:        number   // 1–10
  interruptions?: number
  notes?:         string
}

export type MoodPayload = {
  date:      string
  time:      string   // "09:00" — обязательное поле!
  moodScore: number   // 1–10 (было value — неверно!)
  emotions?: string
  triggers?: string
  notes?:    string
}

export type StressPayload = {
  date:            string
  time:            string   // "14:00" — обязательное поле!
  level:           number   // 1–10
  cause?:          string
  copingStrategy?: string
}

export type ActivityPayload = {
  date:            string
  time?:           string
  type:            "walk" | "run" | "yoga" | "gym" | "sport" | "other"
  durationMinutes: number
  intensity:       "light" | "moderate" | "vigorous"
  caloriesBurned?: number
  notes?:          string
}

export type WaterPayload = {
  date:     string
  time:     string   // "08:00" — обязательное поле!
  amountMl: number   // camelCase, без glasses!
}

export type NutritionPayload = {
  date:         string
  time:         string   // "12:00" — обязательное поле!
  mealType:     "breakfast" | "lunch" | "dinner" | "snack"  // enum, обязательное!
  description:  string   // обязательное!
  calories:     number
  proteinGrams: number   // camelCase
  carbsGrams:   number   // camelCase
  fatGrams:     number   // camelCase
}


// ── Insights ──────────────────────────────────────────────
// timeout 35s: холодный старт ML-сервиса (train + predict + LLM) занимает ~15-20с
export const getInsights        = (): Promise<InsightsResponse> =>
  api.get("/insights/me", { timeout: 35_000 }).then((r) => r.data)
export const getRecommendations = () =>
  api.get<{ data: Recommendation[] }>("/insights/recommendations").then(getData)

export type FeedbackRating = "helpful" | "not_helpful"
export interface FeedbackPayload {
  ruleId: string
  rating: FeedbackRating
  comment?: string
  recommendationSnapshot?: Record<string, unknown>
}
export interface FeedbackResponse {
  id: string
  createdAt: string
}
export const submitRecommendationFeedback = (
  payload: FeedbackPayload,
): Promise<FeedbackResponse> =>
  api.post("/insights/feedback", payload).then((r) => r.data)

// ── Sleep ─────────────────────────────────────────────────
export const getSleepRecords    = () =>
  api.get("/sleep").then(r => getData<any>(r).map(mapSleep))
export const createSleepRecord  = (d: SleepPayload) =>
  api.post("/sleep", d).then(r => r.data)
export const updateSleepRecord  = (id: string, d: Partial<SleepPayload>) =>
  api.patch(`/sleep/${id}`, d).then(r => r.data)
export const deleteSleepRecord  = (id: string) =>
  api.delete(`/sleep/${id}`)

// ── Nutrition ─────────────────────────────────────────────
export const getNutritionRecords    = () =>
  api.get("/nutrition").then(r => getData<any>(r).map(mapNutrition))
export const createNutritionRecord  = (d: NutritionPayload) =>
  api.post("/nutrition", d).then(r => r.data)
export const updateNutritionRecord  = (id: string, d: Partial<NutritionPayload>) =>
  api.patch(`/nutrition/${id}`, d).then(r => r.data)
export const deleteNutritionRecord  = (id: string) =>
  api.delete(`/nutrition/${id}`)

// ── Mood ──────────────────────────────────────────────────
export const getMoodRecords     = () =>
  api.get("/mood").then(r => getData<any>(r).map(mapMood))
export const createMoodRecord   = (d: MoodPayload) =>
  api.post("/mood", d).then(r => r.data)
export const updateMoodRecord   = (id: string, d: Partial<MoodPayload>) =>
  api.patch(`/mood/${id}`, d).then(r => r.data)
export const deleteMoodRecord   = (id: string) =>
  api.delete(`/mood/${id}`)

// ── Stress ────────────────────────────────────────────────
export const getStressRecords   = () =>
  api.get("/stress").then(r => getData<any>(r).map(mapStress))
export const createStressRecord = (d: StressPayload) =>
  api.post("/stress", d).then(r => r.data)
export const updateStressRecord = (id: string, d: Partial<StressPayload>) =>
  api.patch(`/stress/${id}`, d).then(r => r.data)
export const deleteStressRecord = (id: string) =>
  api.delete(`/stress/${id}`)

// ── Activity ──────────────────────────────────────────────
export const getActivityRecords     = () =>
  api.get("/activity").then(r => getData<any>(r).map(mapActivity))
export const createActivityRecord   = (d: ActivityPayload) =>
  api.post("/activity", d).then(r => r.data)
export const updateActivityRecord   = (id: string, d: Partial<ActivityPayload>) =>
  api.patch(`/activity/${id}`, d).then(r => r.data)
export const deleteActivityRecord   = (id: string) =>
  api.delete(`/activity/${id}`)

// ── Water ─────────────────────────────────────────────────
export const getWaterRecords    = () =>
  api.get("/water").then(r => getData<any>(r).map(mapWater))
export const createWaterRecord  = (d: WaterPayload) =>
  api.post("/water", d).then(r => r.data)
export const updateWaterRecord  = (id: string, d: Partial<WaterPayload>) =>
  api.patch(`/water/${id}`, d).then(r => r.data)
export const deleteWaterRecord  = (id: string) =>
  api.delete(`/water/${id}`)

// ── User / Profile ────────────────────────────────────────────

const PROFILE_KEY = "user"

const defaultProfile = (): Profile => ({
  firstName: "",
  lastName:  "",
  email:     "",
  birthDate: "",
})

export function getProfile(): Promise<Profile> {
  if (typeof window === "undefined") return Promise.resolve(defaultProfile())
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return Promise.resolve(raw ? { ...defaultProfile(), ...JSON.parse(raw) } : defaultProfile())
  } catch {
    return Promise.resolve(defaultProfile())
  }
}

export function updateProfile(updates: Partial<Profile>): Promise<Profile> {
  return getProfile().then((current) => {
    const next = { ...current, ...updates }
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
    return next
  })
}

// Добавить в frontend/lib/health-api.ts
// Все три функции используют один эндпоинт GET /gamification
// и трансформируют данные в нужный формат для компонентов.

import type {
  GamificationDto, FullStreakData, UserLevelInfo, Achievement,
} from '@/types/health'

// Вместо функции fetchGamification с fetch()
async function fetchGamification(): Promise<GamificationDto> {
  // Используем уже настроенный axios instance
  const res = await api.get('/gamification');
  return res.data;
}

// ── getFullStreakData ─────────────────────────────────────────

export async function getFullStreakData(): Promise<FullStreakData> {
  const g = await fetchGamification()
  return {
    anyData:    { current: g.streakAny,  best: g.longestAny  },
    allMetrics: { current: g.streakFull, best: g.longestFull },
    goalsMet:   { current: g.streakNorm, best: g.longestNorm },
  }
}

// ── getUserLevel ──────────────────────────────────────────────

const LEVEL_THRESHOLDS = [
  { key: 'beginner', name: 'Новичок',  min: 0    },
  { key: 'amateur',  name: 'Любитель', min: 300  },
  { key: 'expert',   name: 'Эксперт',  min: 700  },
  { key: 'master',   name: 'Мастер',   min: 1500 },
]

export async function getUserLevel(): Promise<UserLevelInfo> {
  const g = await fetchGamification()

  const levels    = LEVEL_THRESHOLDS
  const curIdx    = g.level - 1                             // level в БД: 1,2,3,4
  const cur       = levels[curIdx]  ?? levels[0]
  const next      = levels[curIdx + 1]
  const xpInLevel = g.totalPoints - cur.min
  const nextXp    = next ? next.min - cur.min : 500         // на макс. уровне — заглушка

  return {
    level:       cur.key,
    name:        g.levelName,
    xp:          xpInLevel,
    nextLevelXp: nextXp,
    totalXp:     g.totalPoints,
  }
}

// ── getAchievements ───────────────────────────────────────────
// Маппинг бейджей из BadgeId → Achievement для UI.
// progress/maxProgress: для стрик-бейджей показывает текущий стрик,
// для остальных — 1/1 если получен, 0/1 если нет.

const BADGE_META: Record<string, {
  title: string; description: string; icon: string
  rarity: Achievement['rarity']; category: Achievement['category']
  points: number; maxProgress: number
}> = {
  // streak_any
  streak_any_3:   { title:'3 дня',          description:'3 дня с любыми данными',    icon:'flame',      rarity:'common',    category:'streak', points:10,  maxProgress:3   },
  streak_any_5:   { title:'5 дней',          description:'5 дней подряд',             icon:'flame',      rarity:'common',    category:'streak', points:20,  maxProgress:5   },
  streak_any_7:   { title:'Неделя!',         description:'7 дней без пропусков',      icon:'flame',      rarity:'common',    category:'streak', points:50,  maxProgress:7   },
  streak_any_10:  { title:'10 дней',         description:'10 дней подряд',            icon:'flame',      rarity:'rare',      category:'streak', points:80,  maxProgress:10  },
  streak_any_14:  { title:'Две недели',       description:'14 дней — уже привычка',   icon:'flame',      rarity:'rare',      category:'streak', points:120, maxProgress:14  },
  streak_any_20:  { title:'20 дней',         description:'20 дней без пропусков',     icon:'flame',      rarity:'rare',      category:'streak', points:180, maxProgress:20  },
  streak_any_30:  { title:'Месяц!',          description:'30 дней — дисциплина',      icon:'flame',      rarity:'epic',      category:'streak', points:300, maxProgress:30  },
  streak_any_60:  { title:'60 дней',         description:'Два месяца подряд',         icon:'zap',        rarity:'epic',      category:'streak', points:600, maxProgress:60  },
  streak_any_100: { title:'100 дней',        description:'Легендарный результат',     icon:'crown',      rarity:'legendary', category:'streak', points:1000,maxProgress:100 },
  // streak_full
  streak_full_3:  { title:'Полный день ×3',  description:'3 дня — все 6 метрик',      icon:'layout-grid',rarity:'common',    category:'streak', points:20,  maxProgress:3   },
  streak_full_7:  { title:'Перфекционист',   description:'7 дней — все метрики',      icon:'layout-grid',rarity:'rare',      category:'streak', points:100, maxProgress:7   },
  streak_full_14: { title:'Идеально',        description:'14 дней — полный набор',    icon:'layout-grid',rarity:'epic',      category:'streak', points:250, maxProgress:14  },
  streak_full_30: { title:'Бриллиант',       description:'30 дней — все метрики',     icon:'layout-grid',rarity:'legendary', category:'streak', points:700, maxProgress:30  },
  // streak_norm
  streak_norm_3:  { title:'В норме ×3',      description:'3 дня: сон+стресс в норме', icon:'target',     rarity:'common',    category:'goal',   points:30,  maxProgress:3   },
  streak_norm_7:  { title:'Неделя в норме',  description:'7 дней личного баланса',    icon:'target',     rarity:'rare',      category:'goal',   points:100, maxProgress:7   },
  streak_norm_14: { title:'Мастер нормы',    description:'14 дней в балансе',         icon:'target',     rarity:'epic',      category:'goal',   points:250, maxProgress:14  },
  streak_norm_30: { title:'Гармония',        description:'30 дней — личный баланс',   icon:'target',     rarity:'legendary', category:'goal',   points:600, maxProgress:30  },
  // sleep
  sleep_week:     { title:'Неделя хорошего сна',description:'7 дней сон ≥ нормы',    icon:'moon',       rarity:'rare',      category:'goal',   points:80,  maxProgress:7   },
  sleep_champ:    { title:'Чемпион сна',     description:'14 дней качество ≥ 7/10',  icon:'moon',       rarity:'epic',      category:'goal',   points:150, maxProgress:14  },
  sleep_improver: { title:'Сон улучшился',   description:'Средний сон вырос на 1+ ч', icon:'trending-up',rarity:'rare',      category:'improvement',points:100,maxProgress:1},
  // stress
  calm_week:      { title:'Спокойная неделя',description:'7 дней стресс ≤ базового',  icon:'brain',      rarity:'rare',      category:'goal',   points:80,  maxProgress:7   },
  stress_survivor:{ title:'Пережил кризис',  description:'Восстановился после пика',  icon:'activity',   rarity:'epic',      category:'anomaly',points:200, maxProgress:1   },
  zen_master:     { title:'Мастер дзен',     description:'30 дней стресс ≤ 4/10',    icon:'brain',      rarity:'legendary', category:'goal',   points:500, maxProgress:30  },
  // mood
  mood_rising:    { title:'Настроение растёт',description:'5 дней настроение ≥ 6/10', icon:'smile',      rarity:'common',    category:'improvement',points:40,maxProgress:5 },
  mood_stable:    { title:'Эмоц. баланс',    description:'14 дней настроение ≥ 6/10', icon:'smile',      rarity:'rare',      category:'goal',   points:100, maxProgress:14  },
  mood_improver:  { title:'Счастливее',      description:'Настроение выросло на 2+',  icon:'trending-up',rarity:'rare',      category:'improvement',points:120,maxProgress:1},
  // activity
  active_week:    { title:'Активная неделя', description:'5 из 7 дней с тренировкой', icon:'footprints', rarity:'common',    category:'goal',   points:60,  maxProgress:5   },
  sport_starter:  { title:'Начало пути',     description:'10 тренировок записано',    icon:'footprints', rarity:'rare',      category:'goal',   points:80,  maxProgress:10  },
  activity_improver:{title:'Стал активнее',  description:'Активность выросла на 20%', icon:'trending-up',rarity:'rare',      category:'improvement',points:100,maxProgress:1},
  // water
  hydration_week: { title:'Гидрация ×7',     description:'7 дней ≥ 1500 мл воды',    icon:'droplets',   rarity:'rare',      category:'goal',   points:80,  maxProgress:7   },
  // anomaly
  anomaly_survived:   {title:'Выброс пережит',  description:'Вернулся к норме за 3 дня',icon:'search', rarity:'rare', category:'anomaly',points:120,maxProgress:1},
  anomaly_3_survived: {title:'Кризис-менеджер', description:'3 аномалии пережиты',      icon:'search', rarity:'epic', category:'anomaly',points:300,maxProgress:3},
  // data
  first_entry:    { title:'Первый шаг',      description:'Первая запись данных',      icon:'user',       rarity:'common',    category:'goal',   points:10,  maxProgress:1   },
  completionist:  { title:'Перфекционист',   description:'30 дней — все 6 метрик',    icon:'layout-grid',rarity:'epic',      category:'goal',   points:200, maxProgress:30  },
  // levels
  level_beginner: { title:'Новичок',         description:'Старт пути',                icon:'user',       rarity:'common',    category:'level',  points:0,   maxProgress:1   },
  level_amateur:  { title:'Любитель',        description:'300 очков',                 icon:'star',       rarity:'common',    category:'level',  points:0,   maxProgress:300 },
  level_expert:   { title:'Эксперт',         description:'700 очков',                 icon:'award',      rarity:'rare',      category:'level',  points:0,   maxProgress:700 },
  level_master:   { title:'Мастер',          description:'1500 очков',                icon:'crown',      rarity:'epic',      category:'level',  points:0,   maxProgress:1500},
}

export async function getAchievements(): Promise<Achievement[]> {
  const g = await fetchGamification()
  const earnedSet = new Set(g.badges)

  return Object.entries(BADGE_META).map(([id, meta]) => {
    const earned    = earnedSet.has(id)
    const earnedAt  = g.badgeDates[id]

    // Для стрик-бейджей прогресс = текущий стрик
    let progress = earned ? meta.maxProgress : 0
    if (id.startsWith('streak_any_') && !earned) {
      progress = Math.min(g.streakAny, meta.maxProgress)
    } else if (id.startsWith('streak_full_') && !earned) {
      progress = Math.min(g.streakFull, meta.maxProgress)
    } else if (id.startsWith('streak_norm_') && !earned) {
      progress = Math.min(g.streakNorm, meta.maxProgress)
    } else if (id.startsWith('level_') && !earned) {
      progress = Math.min(g.totalPoints, meta.maxProgress)
    }

    return {
      id,
      ...meta,
      progress,
      unlockedAt: earnedAt,
    }
  })
}
