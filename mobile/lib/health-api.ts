// mobile/lib/health-api.ts
import { api } from './api'
import type {
  SleepRecord, StressRecord, MoodRecord, ActivityRecord,
  WaterRecord, NutritionRecord, InsightsResponse, GamificationDto,
  FullStreakData, UserLevelInfo, Achievement, Profile,
} from '@/types/health'

// ── Helpers ───────────────────────────────────────────────
const getData = <T>(res: any): T[] => {
  const payload = res.data ?? res
  if (Array.isArray(payload))         return payload
  if (Array.isArray(payload.data))    return payload.data
  if (Array.isArray(payload.results)) return payload.results
  return []
}

// ── Mappers ───────────────────────────────────────────────
function calcHours(bed?: string, wake?: string): number {
  if (!bed || !wake) return 0
  const [bh, bm] = bed.split(':').map(Number)
  const [wh, wm] = wake.split(':').map(Number)
  let minutes = (wh * 60 + wm) - (bh * 60 + bm)
  if (minutes < 0) minutes += 24 * 60
  return Math.round((minutes / 60) * 10) / 10
}

const mapSleep = (r: any): SleepRecord => ({
  id: r.id, date: r.date,
  hours:         r.duration_hours ?? calcHours(r.bedTime, r.wakeTime) ?? 0,
  quality:       r.quality ?? 0,
  bedTime:       r.bedTime,
  wakeTime:      r.wakeTime,
  interruptions: r.interruptions,
  notes:         r.notes,
})

const mapNutrition = (r: any): NutritionRecord => ({
  id: r.id, date: r.date,
  kcal:        r.calories     ?? r.kcal ?? 0,
  proteins:    r.proteinGrams ?? r.protein_grams ?? r.proteins ?? 0,
  fats:        r.fatGrams     ?? r.fat_grams     ?? r.fats     ?? 0,
  carbs:       r.carbsGrams   ?? r.carbs_grams   ?? r.carbs    ?? 0,
  mealName:    r.mealType     ?? r.meal_name     ?? r.mealName,
  mealType:    r.mealType,
  description: r.description  ?? r.notes,
  notes:       r.notes,
})

const mapMood = (r: any): MoodRecord => ({
  id: r.id, date: r.date,
  value: r.moodScore ?? r.value ?? r.mood_score ?? 0,
  notes: r.notes,
})

const mapStress = (r: any): StressRecord => ({
  id: r.id, date: r.date,
  level: r.level ?? 0,
  notes: r.notes,
})

const UI_ACTIVITY_TYPE_MAP: Record<string, string> = {
  walk: 'walking',
  run: 'running',
  yoga: 'other',
  gym: 'gym',
  sport: 'other',
  other: 'other',
  walking: 'walking',
  running: 'running',
  cycling: 'cycling',
}

const BACKEND_ACTIVITY_TYPE_MAP: Record<string, BackendActivityPayload['type']> = {
  walk: 'walk',
  run: 'run',
  yoga: 'yoga',
  gym: 'gym',
  sport: 'sport',
  other: 'other',
  walking: 'walk',
  running: 'run',
  cycling: 'other',
}

type BackendActivityPayload = {
  date: string
  time?: string
  type: 'walk' | 'run' | 'yoga' | 'gym' | 'sport' | 'other'
  durationMinutes: number
  intensity: 'light' | 'moderate' | 'vigorous'
  caloriesBurned?: number
  steps?: number
  notes?: string
}

function normalizeActivityPayload(data: any): BackendActivityPayload {
  return {
    date: data.date,
    ...(data.time ? { time: data.time } : {}),
    type: BACKEND_ACTIVITY_TYPE_MAP[data.type] ?? 'other',
    durationMinutes: data.durationMinutes ?? data.duration ?? 0,
    intensity: data.intensity ?? 'moderate',
    ...(data.caloriesBurned != null
      ? { caloriesBurned: data.caloriesBurned }
      : data.calories != null
        ? { caloriesBurned: data.calories }
        : {}),
    ...(data.steps != null ? { steps: data.steps } : {}),
    ...(data.notes ? { notes: data.notes } : {}),
  }
}

const mapActivity = (r: any): ActivityRecord => ({
  id: r.id, date: r.date,
  type:           UI_ACTIVITY_TYPE_MAP[r.type] ?? r.type ?? 'other',
  duration:       r.durationMinutes ?? r.duration_minutes ?? r.duration ?? 0,
  intensity:      r.intensity,
  caloriesBurned: r.caloriesBurned  ?? r.calories_burned,
  calories:       r.caloriesBurned  ?? r.calories_burned,
  steps:          r.steps,
  notes:          r.notes,
})

const mapWater = (r: any): WaterRecord => ({
  id: r.id, date: r.date,
  glasses:  r.glasses  ?? Math.round((r.amountMl ?? r.amount_ml ?? 0) / 250),
  amountMl: r.amountMl ?? r.amount_ml ?? (r.glasses ? r.glasses * 250 : 0),
  notes:    r.notes,
})

// ── GET ───────────────────────────────────────────────────
export const getSleepRecords     = () => api.get('/sleep').then(r => getData<any>(r).map(mapSleep))
export const getStressRecords    = () => api.get('/stress').then(r => getData<any>(r).map(mapStress))
export const getMoodRecords      = () => api.get('/mood').then(r => getData<any>(r).map(mapMood))
export const getActivityRecords  = () => api.get('/activity').then(r => getData<any>(r).map(mapActivity))
export const getWaterRecords     = () => api.get('/water').then(r => getData<any>(r).map(mapWater))
export const getNutritionRecords = () => api.get('/nutrition').then(r => getData<any>(r).map(mapNutrition))
export const getInsights         = () =>
  api.get<InsightsResponse>('/insights/me', { timeout: 35_000 }).then(r => r.data)
export const getGamification     = () => api.get<GamificationDto>('/gamification').then(r => r.data)

// ── POST ──────────────────────────────────────────────────
export const createSleep     = (data: any) => api.post('/sleep',     data).then(r => r.data)
export const createStress    = (data: any) => api.post('/stress',    data).then(r => r.data)
export const createMood      = (data: any) => api.post('/mood',      data).then(r => r.data)
export const createActivity  = (data: any) => api.post('/activity',  normalizeActivityPayload(data)).then(r => r.data)
export const createWater     = (data: any) => api.post('/water',     data).then(r => r.data)
export const createNutrition = (data: any) => api.post('/nutrition', data).then(r => r.data)

// ── Food vision (фото → gpt-4o → FatSecret) ───────────────
export interface AnalyzedFoodItem {
  name: string
  matchedFoodName?: string
  grams: number
  confidence: number
  matched: boolean
  calories: number
  proteinGrams: number
  carbsGrams: number
  fatGrams: number
}

export interface AnalyzePhotoResponse {
  items: AnalyzedFoodItem[]
  overall_confidence: number
  message?: string
}

export const analyzeFoodPhoto = (imageBase64: string, mimeType = 'image/jpeg') =>
  api
    .post<AnalyzePhotoResponse>('/nutrition/analyze-photo', { imageBase64, mimeType })
    .then(r => r.data)

// ── Voice → form ──────────────────────────────────────────
export type VoiceContext = 'mood' | 'sleep' | 'food' | 'water'

export interface VoiceResponse<T = Record<string, any>> {
  transcript: string
  fields: T & { confidence: number }
}

export async function voiceToForm<T = Record<string, any>>(
  audioUri: string,
  context: VoiceContext,
  filename = 'audio.m4a',
  mimeType = 'audio/m4a',
): Promise<VoiceResponse<T>> {
  // axios+RN+FormData ломается на Network Error. Используем fetch напрямую —
  // RN fetch корректно обрабатывает multipart с file-объектом { uri, name, type }.
  const { useAuthStore } = await import('@/store/auth.store')
  const token = useAuthStore.getState().token
  const baseURL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  const form = new FormData()
  form.append('context', context)
  form.append('audio', { uri: audioUri, name: filename, type: mimeType } as any)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120_000)

  try {
    const res = await fetch(`${baseURL}/ai/voice-to-form`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: 'application/json',
        // Content-Type не ставим — RN fetch сам выставит multipart/form-data с boundary.
      },
      body: form,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`voice-to-form ${res.status}: ${text || res.statusText}`)
    }
    return (await res.json()) as VoiceResponse<T>
  } finally {
    clearTimeout(timer)
  }
}

// ── PATCH ─────────────────────────────────────────────────
export const updateSleep     = (id: string, d: any) => api.patch(`/sleep/${id}`,     d).then(r => r.data)
export const updateStress    = (id: string, d: any) => api.patch(`/stress/${id}`,    d).then(r => r.data)
export const updateMood      = (id: string, d: any) => api.patch(`/mood/${id}`,      d).then(r => r.data)
export const updateActivity  = (id: string, d: any) => api.patch(`/activity/${id}`,  normalizeActivityPayload(d)).then(r => r.data)
export const updateWater     = (id: string, d: any) => api.patch(`/water/${id}`,     d).then(r => r.data)
export const updateNutrition = (id: string, d: any) => api.patch(`/nutrition/${id}`, d).then(r => r.data)

// ── Auth ──────────────────────────────────────────────────
type AuthResponse = { access_token: string; refresh_token: string; user: { id: string } }

export const login = (email: string, password: string) =>
  api.post<AuthResponse>('/auth/login', { email, password })
    .then(r => ({
      access_token:  r.data.access_token,
      refresh_token: r.data.refresh_token,
      userId:        r.data.user.id,
    }))

export const register = (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
) =>
  api.post<AuthResponse>('/auth/register', {
    email,
    password,
    firstName,
    lastName,
  }).then(r => ({
    access_token:  r.data.access_token,
    refresh_token: r.data.refresh_token,
    userId:        r.data.user.id,
  }))

export const logoutApi = () => api.post('/auth/logout').catch(() => {})

// ── Profile (server) ─────────────────────────────────────

export async function getProfile(): Promise<Profile> {
  const res = await api.get('/users/me')
  const u = res.data
  return {
    firstName: u.firstName ?? '',
    lastName:  u.lastName  ?? '',
    email:     u.email     ?? '',
    birthDate: u.dateOfBirth ? String(u.dateOfBirth).slice(0, 10) : '',
  }
}

export async function updateProfile(updates: Partial<Profile>): Promise<Profile> {
  const body: Record<string, any> = {}
  if (updates.firstName !== undefined) body.firstName   = updates.firstName
  if (updates.lastName  !== undefined) body.lastName    = updates.lastName
  if (updates.birthDate !== undefined) body.dateOfBirth = updates.birthDate || null
  const res = await api.patch('/users/me', body)
  const u = res.data
  return {
    firstName: u.firstName ?? '',
    lastName:  u.lastName  ?? '',
    email:     u.email     ?? '',
    birthDate: u.dateOfBirth ? String(u.dateOfBirth).slice(0, 10) : '',
  }
}

// ── Gamification ──────────────────────────────────────────
const LEVEL_THRESHOLDS = [
  { key: 'beginner', name: 'Новичок',  min: 0    },
  { key: 'amateur',  name: 'Любитель', min: 300  },
  { key: 'expert',   name: 'Эксперт',  min: 700  },
  { key: 'master',   name: 'Мастер',   min: 1500 },
]

export async function getFullStreakData(): Promise<FullStreakData> {
  const g = await getGamification()
  return {
    anyData:    { current: g.streakAny,  best: g.longestAny  },
    allMetrics: { current: g.streakFull, best: g.longestFull },
    goalsMet:   { current: g.streakNorm, best: g.longestNorm },
  }
}

export async function getUserLevel(): Promise<UserLevelInfo> {
  const g = await getGamification()
  const curIdx    = g.level - 1
  const cur       = LEVEL_THRESHOLDS[curIdx] ?? LEVEL_THRESHOLDS[0]
  const next      = LEVEL_THRESHOLDS[curIdx + 1]
  const xpInLevel = g.totalPoints - cur.min
  const nextXp    = next ? next.min - cur.min : 500
  return {
    level: cur.key, name: g.levelName,
    xp: xpInLevel, nextLevelXp: nextXp, totalXp: g.totalPoints,
  }
}

const BADGE_META: Record<string, {
  title: string; description: string; icon: string
  rarity: Achievement['rarity']; category: Achievement['category']
  points: number; maxProgress: number
}> = {
  streak_any_3:       { title:'3 дня',           description:'3 дня с любыми данными',     icon:'flame',       rarity:'common',    category:'streak',      points:10,   maxProgress:3    },
  streak_any_5:       { title:'5 дней',           description:'5 дней подряд',              icon:'flame',       rarity:'common',    category:'streak',      points:20,   maxProgress:5    },
  streak_any_7:       { title:'Неделя!',          description:'7 дней без пропусков',       icon:'flame',       rarity:'common',    category:'streak',      points:50,   maxProgress:7    },
  streak_any_10:      { title:'10 дней',          description:'10 дней подряд',             icon:'flame',       rarity:'rare',      category:'streak',      points:80,   maxProgress:10   },
  streak_any_14:      { title:'Две недели',       description:'14 дней — уже привычка',     icon:'flame',       rarity:'rare',      category:'streak',      points:120,  maxProgress:14   },
  streak_any_20:      { title:'20 дней',          description:'20 дней без пропусков',      icon:'flame',       rarity:'rare',      category:'streak',      points:180,  maxProgress:20   },
  streak_any_30:      { title:'Месяц!',           description:'30 дней — дисциплина',       icon:'flame',       rarity:'epic',      category:'streak',      points:300,  maxProgress:30   },
  streak_any_60:      { title:'60 дней',          description:'Два месяца подряд',          icon:'zap',         rarity:'epic',      category:'streak',      points:600,  maxProgress:60   },
  streak_any_100:     { title:'100 дней',         description:'Легендарный результат',      icon:'crown',       rarity:'legendary', category:'streak',      points:1000, maxProgress:100  },
  streak_full_3:      { title:'Полный день ×3',   description:'3 дня — все 6 метрик',       icon:'layout-grid', rarity:'common',    category:'streak',      points:20,   maxProgress:3    },
  streak_full_7:      { title:'Перфекционист',    description:'7 дней — все метрики',       icon:'layout-grid', rarity:'rare',      category:'streak',      points:100,  maxProgress:7    },
  streak_full_14:     { title:'Идеально',         description:'14 дней — полный набор',     icon:'layout-grid', rarity:'epic',      category:'streak',      points:250,  maxProgress:14   },
  streak_full_30:     { title:'Бриллиант',        description:'30 дней — все метрики',      icon:'layout-grid', rarity:'legendary', category:'streak',      points:700,  maxProgress:30   },
  streak_norm_3:      { title:'В норме ×3',       description:'3 дня: сон+стресс в норме',  icon:'target',      rarity:'common',    category:'goal',        points:30,   maxProgress:3    },
  streak_norm_7:      { title:'Неделя в норме',   description:'7 дней личного баланса',     icon:'target',      rarity:'rare',      category:'goal',        points:100,  maxProgress:7    },
  streak_norm_14:     { title:'Мастер нормы',     description:'14 дней в балансе',          icon:'target',      rarity:'epic',      category:'goal',        points:250,  maxProgress:14   },
  streak_norm_30:     { title:'Гармония',         description:'30 дней — личный баланс',    icon:'target',      rarity:'legendary', category:'goal',        points:600,  maxProgress:30   },
  sleep_week:         { title:'Неделя хорошего сна', description:'7 дней сон ≥ нормы',     icon:'moon',        rarity:'rare',      category:'goal',        points:80,   maxProgress:7    },
  sleep_champ:        { title:'Чемпион сна',      description:'14 дней качество ≥ 7/10',   icon:'moon',        rarity:'epic',      category:'goal',        points:150,  maxProgress:14   },
  sleep_improver:     { title:'Сон улучшился',    description:'Средний сон вырос на 1+ ч', icon:'trending-up', rarity:'rare',      category:'improvement', points:100,  maxProgress:1    },
  calm_week:          { title:'Спокойная неделя', description:'7 дней стресс ≤ базового',   icon:'brain',       rarity:'rare',      category:'goal',        points:80,   maxProgress:7    },
  stress_survivor:    { title:'Пережил кризис',   description:'Восстановился после пика',   icon:'activity',    rarity:'epic',      category:'anomaly',     points:200,  maxProgress:1    },
  zen_master:         { title:'Мастер дзен',      description:'30 дней стресс ≤ 4/10',     icon:'brain',       rarity:'legendary', category:'goal',        points:500,  maxProgress:30   },
  mood_rising:        { title:'Настроение растёт',description:'5 дней настроение ≥ 6/10',  icon:'smile',       rarity:'common',    category:'improvement', points:40,   maxProgress:5    },
  mood_stable:        { title:'Эмоц. баланс',     description:'14 дней настроение ≥ 6/10', icon:'smile',       rarity:'rare',      category:'goal',        points:100,  maxProgress:14   },
  mood_improver:      { title:'Счастливее',       description:'Настроение выросло на 2+',   icon:'trending-up', rarity:'rare',      category:'improvement', points:120,  maxProgress:1    },
  active_week:        { title:'Активная неделя',  description:'5 из 7 дней с тренировкой',  icon:'footprints',  rarity:'common',    category:'goal',        points:60,   maxProgress:5    },
  sport_starter:      { title:'Начало пути',      description:'10 тренировок записано',     icon:'footprints',  rarity:'rare',      category:'goal',        points:80,   maxProgress:10   },
  activity_improver:  { title:'Стал активнее',    description:'Активность выросла на 20%',  icon:'trending-up', rarity:'rare',      category:'improvement', points:100,  maxProgress:1    },
  hydration_week:     { title:'Гидрация ×7',      description:'7 дней ≥ 1500 мл воды',     icon:'droplets',    rarity:'rare',      category:'goal',        points:80,   maxProgress:7    },
  anomaly_survived:   { title:'Выброс пережит',   description:'Вернулся к норме за 3 дня',  icon:'search',      rarity:'rare',      category:'anomaly',     points:120,  maxProgress:1    },
  anomaly_3_survived: { title:'Кризис-менеджер',  description:'3 аномалии пережиты',        icon:'search',      rarity:'epic',      category:'anomaly',     points:300,  maxProgress:3    },
  first_entry:        { title:'Первый шаг',       description:'Первая запись данных',        icon:'user',        rarity:'common',    category:'goal',        points:10,   maxProgress:1    },
  completionist:      { title:'Перфекционист',    description:'30 дней — все 6 метрик',     icon:'layout-grid', rarity:'epic',      category:'goal',        points:200,  maxProgress:30   },
  level_beginner:     { title:'Новичок',          description:'Старт пути',                  icon:'user',        rarity:'common',    category:'level',       points:0,    maxProgress:1    },
  level_amateur:      { title:'Любитель',         description:'300 очков',                   icon:'star',        rarity:'common',    category:'level',       points:0,    maxProgress:300  },
  level_expert:       { title:'Эксперт',          description:'700 очков',                   icon:'award',       rarity:'rare',      category:'level',       points:0,    maxProgress:700  },
  level_master:       { title:'Мастер',           description:'1500 очков',                  icon:'crown',       rarity:'epic',      category:'level',       points:0,    maxProgress:1500 },
}

export async function getAchievements(): Promise<Achievement[]> {
  const g = await getGamification()
  const earnedSet = new Set(g.badges)
  return Object.entries(BADGE_META).map(([id, meta]) => {
    const earned   = earnedSet.has(id)
    const earnedAt = g.badgeDates[id]
    let progress   = earned ? meta.maxProgress : 0
    if (!earned) {
      if      (id.startsWith('streak_any_'))  progress = Math.min(g.streakAny,    meta.maxProgress)
      else if (id.startsWith('streak_full_')) progress = Math.min(g.streakFull,   meta.maxProgress)
      else if (id.startsWith('streak_norm_')) progress = Math.min(g.streakNorm,   meta.maxProgress)
      else if (id.startsWith('level_'))       progress = Math.min(g.totalPoints,  meta.maxProgress)
    }
    return { id, ...meta, progress, unlockedAt: earnedAt }
  })
}

export const addSleepRecord    = (d: any) => createSleep(d)
export const deleteSleepRecord = (id: string) => api.delete(`/sleep/${id}`)
export { updateSleep as updateSleepRecord }

// Алиасы для activity
export const addActivityRecord    = (d: any) => createActivity(d)
export const deleteActivityRecord = (id: string) => api.delete(`/activity/${id}`)
export { updateActivity as updateActivityRecord }

// Алиасы для остальных (на будущее)
export const addStressRecord    = (d: any) => createStress(d)
export const deleteStressRecord = (id: string) => api.delete(`/stress/${id}`)
export { updateStress as updateStressRecord }

export const addMoodRecord    = (d: any) => createMood(d)
export const deleteMoodRecord = (id: string) => api.delete(`/mood/${id}`)
export { updateMood as updateMoodRecord }

export const addWaterRecord    = (d: any) => createWater(d)
export const deleteWaterRecord = (id: string) => api.delete(`/water/${id}`)
export { updateWater as updateWaterRecord }

export const addNutritionRecord    = (d: any) => createNutrition(d)
export const deleteNutritionRecord = (id: string) => api.delete(`/nutrition/${id}`)
export { updateNutrition as updateNutritionRecord }
