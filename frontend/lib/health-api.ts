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
  type:            "walking" | "running" | "gym" | "cycling" | "other"
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
export const getInsights        = (): Promise<InsightsResponse> =>
  api.get("/insights/me").then((r) => r.data)
export const getRecommendations = () =>
  api.get<Recommendation[]>("/insights/recommendations").then(getData)

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