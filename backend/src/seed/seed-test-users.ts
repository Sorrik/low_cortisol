/**
 * backend/src/seed/seed-test-users.ts
 *
 * Создаёт 5 «настоящих» пользователей с 14 днями данных. Каждый персонаж —
 * реалистичный кейс с дневной вариативностью (вход/выход из паттерна,
 * выходные vs будни), но с устойчивым уклоном, который CausalChainService
 * и ML должны заметить.
 *
 * Запуск (PowerShell):
 *   $env:DATABASE_URL="postgresql://postgres:password@localhost:5432/low_cortisol"
 *   npx ts-node -r tsconfig-paths/register src/seed/seed-test-users.ts
 *
 * Запуск через docker-compose:
 *   docker-compose exec backend npx ts-node -r tsconfig-paths/register src/seed/seed-test-users.ts
 *
 * ═══════════════════════════════════════════════════════════════
 * Персонажи (пароль для всех: Test1234!):
 *   1. masha@test.local   — Маша, 28, маркетолог. Здоровый ЗОЖ.
 *                           Ожидаемые цепочки: F1, F2 (позитивные).
 *   2. andrey@test.local  — Андрей, 32, senior dev. Поздние жирные ужины,
 *                           недосып. Ожидаем: A1, A2, C1.
 *   3. olya@test.local    — Оля, 35, мама в декрете. Высокий стресс,
 *                           дегидратация. Ожидаем: D3, E1.
 *   4. kirill@test.local  — Кирилл, 41, директор. Вечерние интенсивные
 *                           тренировки, перетрен. Ожидаем: B1, B2, D2.
 *   5. dima@test.local    — Дима, 22, студент. Хаос в графике, дефицит
 *                           белка. Ожидаем: A4, C2, C3.
 * ═══════════════════════════════════════════════════════════════
 */

import 'reflect-metadata'
import { DataSource } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'

import { User }          from '../users/user.entity'
import { UserProfile }   from '../user-profile/user-profile.entity'
import { SleepData }     from '../sleep/sleep.entity'
import { MoodData }      from '../mood/mood.entity'
import { StressData }    from '../stress/stress.entity'
import { ActivityData }  from '../activity/activity.entity'
import { WaterData }     from '../water/water.entity'
import { NutritionData } from '../nutrition/nutrition.entity'
import { UserGamification } from '../gamification/gamification.entity'

// ── DB Setup ──────────────────────────────────────────────────
const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/low_cortisol',
  entities: [User, UserProfile, SleepData, MoodData, StressData,
             ActivityData, WaterData, NutritionData, UserGamification],
  synchronize: false,
  logging: false,
})

// ── Helpers ───────────────────────────────────────────────────

function daysAgo(daysBack: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysBack)
  return d.toISOString().split('T')[0]
}

function rnd(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min))
}

function rndF(min: number, max: number, dec = 1): number {
  return parseFloat((min + Math.random() * (max - min)).toFixed(dec))
}

function hhmm(hour: number, minute = 0): string {
  // Защита от переноса через полночь: hhmm(24, 30) → 00:30, иначе
  // получаем «24:35» и Postgres падает с date/time out of range.
  const h = ((hour % 24) + 24) % 24
  const m = ((minute % 60) + 60) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** True с заданной вероятностью (0..1). */
function chance(p: number): boolean {
  return Math.random() < p
}

/** Случайный элемент массива. */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** День недели: 0=Sunday, 1=Monday, ..., 6=Saturday. */
function dowOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay()
}

function isWeekend(dateStr: string): boolean {
  const d = dowOf(dateStr)
  return d === 0 || d === 6
}

const PASSWORD = 'Test1234!'

// ── Каталог реалистичных приёмов пищи ─────────────────────────

type Meal = {
  description: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

const BREAKFASTS_HEALTHY: Meal[] = [
  { description: 'Овсянка с черникой и миндалём', calories: 380, protein: 14, carbs: 55, fat: 11 },
  { description: 'Омлет из 3 яиц, тост, авокадо',  calories: 420, protein: 22, carbs: 25, fat: 24 },
  { description: 'Творог 5% с орехами и мёдом',    calories: 350, protein: 28, carbs: 30, fat: 12 },
  { description: 'Греческий йогурт + гранола',     calories: 320, protein: 18, carbs: 42, fat:  8 },
  { description: 'Сырники с ягодным соусом',       calories: 410, protein: 24, carbs: 38, fat: 16 },
]

const LUNCHES_HEALTHY: Meal[] = [
  { description: 'Курица гриль с гречкой и салатом', calories: 580, protein: 42, carbs: 60, fat: 14 },
  { description: 'Лосось с булгуром и брокколи',     calories: 620, protein: 38, carbs: 55, fat: 22 },
  { description: 'Боул с тунцом и киноа',            calories: 560, protein: 34, carbs: 58, fat: 16 },
  { description: 'Индейка с рисом басмати',          calories: 600, protein: 40, carbs: 65, fat: 12 },
  { description: 'Тёплый салат с курицей и нутом',   calories: 540, protein: 36, carbs: 48, fat: 18 },
]

const DINNERS_HEALTHY: Meal[] = [
  { description: 'Запечённая треска с овощами',  calories: 420, protein: 32, carbs: 30, fat: 14 },
  { description: 'Стейк из индейки + салат',     calories: 480, protein: 40, carbs: 22, fat: 22 },
  { description: 'Тушёная курица с овощами',     calories: 450, protein: 36, carbs: 28, fat: 18 },
  { description: 'Креветки с овощным гарниром',  calories: 410, protein: 32, carbs: 24, fat: 16 },
]

const LATE_HEAVY_DINNERS: Meal[] = [
  // Жирные ужины >= 30% fat ratio — нужно для A1
  { description: 'Пицца пепперони (3 куска)',          calories: 720, protein: 30, carbs: 70, fat: 34 },
  { description: 'Бургер с картошкой фри',             calories: 880, protein: 32, carbs: 80, fat: 42 },
  { description: 'Шаверма из доставки',                calories: 760, protein: 28, carbs: 75, fat: 36 },
  { description: 'Жирные роллы Филадельфия + соусы',   calories: 690, protein: 22, carbs: 78, fat: 32 },
  { description: 'Куриные крылья с соусом BBQ',        calories: 820, protein: 38, carbs: 35, fat: 50 },
  { description: 'Лазанья болоньезе (большая порция)', calories: 780, protein: 34, carbs: 65, fat: 38 },
]

const QUICK_BREAKFASTS: Meal[] = [
  { description: 'Кофе и круассан',     calories: 320, protein:  6, carbs: 38, fat: 16 },
  { description: 'Бутерброд с колбасой',calories: 380, protein: 14, carbs: 32, fat: 22 },
  { description: 'Энергетик и шоколадка',calories: 380, protein:  4, carbs: 60, fat: 14 },
]

const SKIP_OR_SNACK: Meal[] = [
  { description: 'Йогурт и яблоко',    calories: 220, protein:  8, carbs: 38, fat:  4 },
  { description: 'Пачка чипсов',       calories: 280, protein:  4, carbs: 30, fat: 16 },
  { description: 'Шоколадный батончик',calories: 250, protein:  3, carbs: 32, fat: 12 },
  { description: 'Лапша быстрого приготовления', calories: 320, protein: 7, carbs: 50, fat: 11 },
]

// ── Persona types ─────────────────────────────────────────────

interface DayData {
  sleep?: { bedTime: string; wakeTime: string; quality: number; durationHours: number; interruptions: number }
  mood?:  { moodScore: number; time: string }
  stress: { level: number; time: string }[]
  activity: { type: string; intensity: string; durationMinutes: number; time: string; caloriesBurned?: number }[]
  water: { amountMl: number; time: string }[]
  nutrition: { time: string; mealType: string; meal: Meal }[]
}

interface PersonaDef {
  email:     string
  firstName: string
  lastName:  string
  name:      string
  profile: {
    age:            number
    weightKg:       number
    heightCm:       number
    gender:         'male' | 'female'
    nutritionGoal:  'lose_weight' | 'maintain' | 'muscle_gain'
    chronotype:     'early_bird' | 'night_owl' | 'no_routine'
    sleepGoalHours: number
    baselineStress: number
    activityLevel:  'sedentary' | 'light' | 'moderate' | 'active'
    workoutsPerWeek: number
    avgWorkoutDurationMin: number
    primaryGoal:    'sleep' | 'stress' | 'energy' | 'mood' | 'weight'
    goals:          ('sleep' | 'stress' | 'energy' | 'mood' | 'weight')[]
    sportTypes:     string[]
    sportGoal:      'lose_weight' | 'build_muscle' | 'improve_endurance' | 'stay_healthy' | 'reduce_stress' | null
  }
  /** Генерирует один день. dayIndex=0 — вчера, 13 — 14 дней назад. */
  generateDay: (dayIndex: number, dateStr: string) => DayData
}

// ── Sleep helpers ─────────────────────────────────────────────

/** Считает durationHours из bedTime + wakeTime с учётом перехода через полночь. */
function sleepDuration(bedTime: string, wakeTime: string): number {
  const [bh, bm] = bedTime.split(':').map(Number)
  const [wh, wm] = wakeTime.split(':').map(Number)
  let bed = bh + bm / 60
  let wake = wh + wm / 60
  if (wake < bed) wake += 24
  return parseFloat((wake - bed).toFixed(1))
}

function buildSleep(bedTime: string, wakeTime: string, quality: number, interruptions = 0) {
  return {
    bedTime,
    wakeTime,
    durationHours: sleepDuration(bedTime, wakeTime),
    quality,
    interruptions,
  }
}

// ──────────────────────────────────────────────────────────────
// 1. Маша — образцовый ЗОЖ
// ──────────────────────────────────────────────────────────────
const masha: PersonaDef = {
  email: 'masha@test.local',
  firstName: 'Маша',
  lastName: 'Соколова',
  name: 'Маша',
  profile: {
    age: 28, weightKg: 65, heightCm: 168, gender: 'female',
    nutritionGoal: 'maintain',
    chronotype: 'early_bird',
    sleepGoalHours: 8, baselineStress: 4,
    activityLevel: 'moderate', workoutsPerWeek: 4, avgWorkoutDurationMin: 45,
    primaryGoal: 'energy', goals: ['energy', 'mood', 'sleep'],
    sportTypes: ['running', 'yoga'],
    sportGoal: 'stay_healthy',
  },
  generateDay: (_i, dateStr) => {
    const weekend = isWeekend(dateStr)
    // По выходным сдвигает отбой на час, всё остальное — стабильно
    const bedH = weekend ? 23 : 22
    const bed  = hhmm(bedH, rnd(15, 45))
    const wake = hhmm(weekend ? 8 : 7, rnd(0, 30))
    const sleep = buildSleep(bed, wake, rnd(7, 9), rnd(0, 1))

    return {
      sleep,
      mood: { moodScore: rnd(7, 9), time: hhmm(8, rnd(0, 30)) },
      stress: [
        { level: rnd(3, 5), time: hhmm(13, 0) },
        { level: rnd(2, 4), time: hhmm(20, 0) },
      ],
      activity: weekend
        ? [{ type: 'yoga', intensity: 'light', durationMinutes: rnd(40, 60), time: hhmm(10, 0), caloriesBurned: rnd(140, 200) }]
        : [{ type: 'running', intensity: 'moderate', durationMinutes: rnd(30, 45), time: hhmm(7, 0), caloriesBurned: rnd(240, 320) }],
      water: [
        { amountMl: 300, time: hhmm(7, 0) },
        { amountMl: 500, time: hhmm(10, 0) },
        { amountMl: 500, time: hhmm(13, 0) },
        { amountMl: 500, time: hhmm(16, 0) },
        { amountMl: rnd(300, 500), time: hhmm(19, 0) },
      ],
      nutrition: [
        { time: hhmm(8, 0),  mealType: 'breakfast', meal: pick(BREAKFASTS_HEALTHY) },
        { time: hhmm(13, 0), mealType: 'lunch',     meal: pick(LUNCHES_HEALTHY) },
        { time: hhmm(19, 0), mealType: 'dinner',    meal: pick(DINNERS_HEALTHY) },
      ],
    }
  },
}

// ──────────────────────────────────────────────────────────────
// 2. Андрей — late eater + недосып
// Будни — поздняя работа, ужины из доставки в 22:00-23:00.
// Выходные — нормальный график. Цепочки A1, A2, C1.
// ──────────────────────────────────────────────────────────────
const andrey: PersonaDef = {
  email: 'andrey@test.local',
  firstName: 'Андрей',
  lastName: 'Лебедев',
  name: 'Андрей',
  profile: {
    age: 32, weightKg: 88, heightCm: 180, gender: 'male',
    nutritionGoal: 'muscle_gain',
    chronotype: 'night_owl',
    sleepGoalHours: 8, baselineStress: 5,
    activityLevel: 'light', workoutsPerWeek: 2, avgWorkoutDurationMin: 50,
    primaryGoal: 'sleep', goals: ['sleep', 'energy', 'weight'],
    sportTypes: ['gym'],
    sportGoal: 'build_muscle',
  },
  generateDay: (_i, dateStr) => {
    const weekend = isWeekend(dateStr)
    // Будни: ужин в 22:30, отбой в 01:00, сон 5-6ч
    // Выходные: ужин в 19:30, отбой в 23:30, сон 7-8ч
    if (weekend) {
      return {
        sleep: buildSleep(hhmm(23, rnd(0, 30)), hhmm(8, rnd(0, 30)), rnd(7, 8), rnd(0, 1)),
        mood: { moodScore: rnd(6, 8), time: hhmm(9, 30) },
        stress: [{ level: rnd(4, 5), time: hhmm(14, 0) }],
        activity: chance(0.7)
          ? [{ type: 'gym', intensity: 'moderate', durationMinutes: rnd(45, 60), time: hhmm(12, 0), caloriesBurned: rnd(300, 400) }]
          : [],
        water: [
          { amountMl: 400, time: hhmm(9, 0) },
          { amountMl: 500, time: hhmm(13, 0) },
          { amountMl: 500, time: hhmm(17, 0) },
          { amountMl: 400, time: hhmm(20, 0) },
        ],
        nutrition: [
          { time: hhmm(10, 0), mealType: 'breakfast', meal: pick(BREAKFASTS_HEALTHY) },
          { time: hhmm(14, 0), mealType: 'lunch',     meal: pick(LUNCHES_HEALTHY) },
          { time: hhmm(19, 30),mealType: 'dinner',    meal: pick(DINNERS_HEALTHY) },
        ],
      }
    }

    // Будни: типичный late-eater паттерн. Жирный ужин в 22:30 + 5-6ч сна
    // → качество стабильно низкое 3-5. Это реалистично: после большого
    // объёма еды поздно вечером ЖКТ не успевает разгрузиться, плюс
    // короткий сон сам по себе ухудшает фазу REM.
    return {
      sleep: buildSleep(hhmm(1, rnd(0, 30)), hhmm(7, rnd(0, 30)), rnd(3, 5), rnd(2, 3)),
      mood: { moodScore: rnd(4, 6), time: hhmm(7, 45) },
      stress: [
        { level: rnd(6, 8), time: hhmm(11, 0) },
        { level: rnd(5, 7), time: hhmm(18, 0) },
      ],
      activity: [{ type: 'walk', intensity: 'light', durationMinutes: rnd(15, 25), time: hhmm(13, 0) }],
      water: [
        { amountMl: 400, time: hhmm(9, 0) },
        { amountMl: 500, time: hhmm(13, 0) },
        { amountMl: 300, time: hhmm(17, 0) },
        { amountMl: 300, time: hhmm(22, 30) },
      ],
      nutrition: [
        { time: hhmm(8, 30), mealType: 'breakfast', meal: pick(QUICK_BREAKFASTS) },
        { time: hhmm(14, 0), mealType: 'lunch',     meal: pick(LUNCHES_HEALTHY) },
        // Late fatty meal — ключевой триггер A1
        { time: hhmm(rnd(22, 23), rnd(0, 30)), mealType: 'dinner', meal: pick(LATE_HEAVY_DINNERS) },
      ],
    }
  },
}

// ──────────────────────────────────────────────────────────────
// 3. Оля — хронический стресс + дегидратация
// Цепочки D3, E1.
// ──────────────────────────────────────────────────────────────
const olya: PersonaDef = {
  email: 'olya@test.local',
  firstName: 'Оля',
  lastName: 'Морозова',
  name: 'Оля',
  profile: {
    age: 35, weightKg: 70, heightCm: 165, gender: 'female',
    nutritionGoal: 'lose_weight',
    chronotype: 'no_routine',
    sleepGoalHours: 8, baselineStress: 6,
    activityLevel: 'light', workoutsPerWeek: 1, avgWorkoutDurationMin: 30,
    primaryGoal: 'stress', goals: ['stress', 'mood', 'weight'],
    sportTypes: ['yoga', 'home_workout'],
    sportGoal: 'lose_weight',
  },
  generateDay: (_i, _dateStr) => {
    // Сон обрывистый — 5.5-7ч, качество 5-7, 2-3 прерывания.
    // Отбой между 22:30 и 23:45 — рано из-за ребёнка, но просыпается ночью.
    const sleep = buildSleep(
      hhmm(rnd(22, 23), rnd(15, 59)),
      hhmm(rnd(6, 7), rnd(0, 30)),
      rnd(5, 7),
      rnd(2, 3),
    )
    return {
      sleep,
      mood: { moodScore: rnd(4, 6), time: hhmm(8, 0) },
      stress: [
        { level: rnd(7, 9), time: hhmm(10, 0) },
        { level: rnd(6, 8), time: hhmm(15, 0) },
        { level: rnd(7, 8), time: hhmm(20, 0) },
      ],
      activity: chance(0.3)
        ? [{ type: 'home_workout', intensity: 'light', durationMinutes: rnd(20, 30), time: hhmm(11, 0), caloriesBurned: rnd(80, 130) }]
        : [{ type: 'walk', intensity: 'light', durationMinutes: rnd(20, 40), time: hhmm(15, 0), caloriesBurned: rnd(60, 110) }],
      // Хронически мало воды — 800-1200 мл/день (норма 30*70 = 2100)
      water: [
        { amountMl: rnd(200, 300), time: hhmm(9, 0) },
        { amountMl: rnd(250, 350), time: hhmm(14, 0) },
        { amountMl: rnd(200, 300), time: hhmm(19, 0) },
      ],
      nutrition: [
        { time: hhmm(8, 30), mealType: 'breakfast', meal: pick(BREAKFASTS_HEALTHY) },
        // Часто пропускает / перехватывает что-то по ходу
        ...(chance(0.6)
          ? [{ time: hhmm(13, 30), mealType: 'lunch', meal: pick(LUNCHES_HEALTHY) }]
          : [{ time: hhmm(14, 0),  mealType: 'snack', meal: pick(SKIP_OR_SNACK) }]),
        { time: hhmm(19, 30), mealType: 'dinner', meal: pick(DINNERS_HEALTHY) },
      ],
    }
  },
}

// ──────────────────────────────────────────────────────────────
// 4. Кирилл — вечерние интенсивные тренировки + перетрен
// Цепочки B1 (vigorous вечером → плохой сон), B2 (overtraining), D2.
// ──────────────────────────────────────────────────────────────
const kirill: PersonaDef = {
  email: 'kirill@test.local',
  firstName: 'Кирилл',
  lastName: 'Воронов',
  name: 'Кирилл',
  profile: {
    age: 41, weightKg: 82, heightCm: 178, gender: 'male',
    nutritionGoal: 'maintain',
    chronotype: 'no_routine',
    sleepGoalHours: 8, baselineStress: 5,
    activityLevel: 'active', workoutsPerWeek: 5, avgWorkoutDurationMin: 70,
    primaryGoal: 'sleep', goals: ['sleep', 'stress', 'energy'],
    sportTypes: ['gym', 'martial_arts'],
    sportGoal: 'stay_healthy',
  },
  generateDay: (_i, dateStr) => {
    const dow = dowOf(dateStr)
    // Тренировка в 21:00 в Пн/Ср/Пт/Сб (4 раза в неделю vigorous вечером)
    const heavyTrainDays = new Set([1, 3, 5, 6])
    const trains = heavyTrainDays.has(dow)
    const lightDay = dow === 0  // воскресенье — отдых

    let activity: DayData['activity']
    if (trains) {
      activity = [
        { type: 'gym', intensity: 'vigorous', durationMinutes: rnd(60, 80), time: hhmm(21, rnd(0, 15)),
          caloriesBurned: rnd(450, 600) },
      ]
    } else if (lightDay) {
      activity = []
    } else {
      activity = [
        { type: 'walk', intensity: 'light', durationMinutes: rnd(25, 40), time: hhmm(8, 0),
          caloriesBurned: rnd(110, 170) },
      ]
    }

    return {
      // Тренировался → плохой сон (vigorous gym в 21:00 поднимает
      // кортизол и температуру → ухудшается засыпание и качество).
      // Не тренировался → нормальный.
      sleep: trains
        ? buildSleep(hhmm(0, rnd(15, 45)), hhmm(7, rnd(0, 20)), rnd(3, 5), rnd(1, 3))
        : buildSleep(hhmm(23, rnd(0, 30)), hhmm(7, rnd(0, 30)), rnd(6, 8), rnd(0, 1)),
      mood: { moodScore: trains ? rnd(4, 6) : rnd(7, 8), time: hhmm(8, 0) },
      stress: [
        { level: rnd(6, 8), time: hhmm(12, 0) },
        { level: rnd(5, 7), time: hhmm(19, 0) },
      ],
      activity,
      water: [
        { amountMl: 500, time: hhmm(8, 0) },
        { amountMl: 750, time: hhmm(13, 0) },
        { amountMl: 500, time: hhmm(17, 0) },
        ...(trains ? [{ amountMl: 750, time: hhmm(22, 0) }] : []),
        { amountMl: 400, time: hhmm(20, 0) },
      ],
      nutrition: [
        { time: hhmm(7, 30), mealType: 'breakfast', meal: pick(BREAKFASTS_HEALTHY) },
        { time: hhmm(13, 0), mealType: 'lunch',     meal: pick(LUNCHES_HEALTHY) },
        // Постренировочный приём
        ...(trains ? [{ time: hhmm(22, 30), mealType: 'dinner', meal: pick(DINNERS_HEALTHY) }] : []),
        ...(!trains ? [{ time: hhmm(19, 0), mealType: 'dinner', meal: pick(DINNERS_HEALTHY) }] : []),
      ],
    }
  },
}

// ──────────────────────────────────────────────────────────────
// 5. Дима — хаос в графике + дефицит белка
// Цепочки A4 (low protein → mood), C2 (irregular bedtime), C3 (sleep debt).
// ──────────────────────────────────────────────────────────────
const dima: PersonaDef = {
  email: 'dima@test.local',
  firstName: 'Дима',
  lastName: 'Орлов',
  name: 'Дима',
  profile: {
    age: 22, weightKg: 75, heightCm: 183, gender: 'male',
    nutritionGoal: 'maintain',
    chronotype: 'night_owl',
    sleepGoalHours: 8, baselineStress: 5,
    activityLevel: 'sedentary', workoutsPerWeek: 1, avgWorkoutDurationMin: 30,
    primaryGoal: 'mood', goals: ['mood', 'energy'],
    sportTypes: ['home_workout'],
    sportGoal: 'stay_healthy',
  },
  generateDay: (i, _dateStr) => {
    // Каждый день — рулетка времени отхода ко сну. Но последние 3 дня
    // (i ∈ {0,1,2}) детерминированно «дедлайн»: ложится в 3-4 утра,
    // спит 4.5-5ч. Это нужно для срабатывания C3 (3 дня sleep<5.5 →
    // mood drop), без него цепочка случайно может не сработать.
    const isCrunchDay = i <= 2
    const roll = isCrunchDay ? 0.95 : Math.random()
    let bed: string, wake: string, qual: number, hours: number
    if (roll < 0.3) {
      bed = hhmm(22, rnd(0, 45)); wake = hhmm(7, rnd(0, 30))
    } else if (roll < 0.6) {
      bed = hhmm(1,  rnd(0, 45)); wake = hhmm(8, rnd(30, 59))
    } else {
      // Поздний отбой 3-4 утра, подъём 8-9 → сон 4.5-5ч
      bed = hhmm(rnd(3, 4),  rnd(0, 45))
      wake = hhmm(rnd(8, 9), rnd(0, 30))
    }
    qual = isCrunchDay ? rnd(3, 5) : rnd(4, 7)
    hours = sleepDuration(bed, wake)
    if (hours > 11) hours = 11
    const sleep = { bedTime: bed, wakeTime: wake, durationHours: parseFloat(hours.toFixed(1)), quality: qual, interruptions: rnd(0, 2) }

    // Питание хаотичное: часто пропускает завтрак, тяжёлый ужин или фастфуд
    const nutrition: DayData['nutrition'] = []
    if (chance(0.5)) {
      nutrition.push({ time: hhmm(11, 0), mealType: 'breakfast', meal: pick(QUICK_BREAKFASTS) })
    }
    // Обед
    if (chance(0.7)) {
      nutrition.push({ time: hhmm(15, 0), mealType: 'lunch', meal: pick(LUNCHES_HEALTHY) })
    } else {
      nutrition.push({ time: hhmm(16, 0), mealType: 'snack', meal: pick(SKIP_OR_SNACK) })
    }
    // Ужин — часто пельмени/пицца, иногда что-то нормальное
    if (chance(0.6)) {
      nutrition.push({ time: hhmm(21, rnd(0, 45)), mealType: 'dinner', meal: pick(LATE_HEAVY_DINNERS) })
    } else {
      nutrition.push({ time: hhmm(20, 0), mealType: 'dinner', meal: pick(DINNERS_HEALTHY) })
    }
    // Ночной перекус
    if (chance(0.3)) {
      nutrition.push({ time: hhmm(rnd(0, 1), 30), mealType: 'snack', meal: pick(SKIP_OR_SNACK) })
    }

    return {
      sleep,
      mood: { moodScore: isCrunchDay ? rnd(3, 5) : rnd(4, 6), time: hhmm(wake.startsWith('1') ? 11 : 9, 0) },
      stress: [{ level: rnd(4, 6), time: hhmm(16, 0) }],
      activity: chance(0.25)
        ? [{ type: 'home_workout', intensity: 'moderate', durationMinutes: rnd(15, 30), time: hhmm(18, 0), caloriesBurned: rnd(80, 140) }]
        : [],
      water: [
        { amountMl: rnd(300, 500), time: hhmm(11, 0) },
        { amountMl: rnd(300, 500), time: hhmm(16, 0) },
        { amountMl: rnd(300, 500), time: hhmm(22, 0) },
      ],
      nutrition,
    }
  },
}

const PERSONAS: PersonaDef[] = [masha, andrey, olya, kirill, dima]
const DAYS = 14

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Seed-тест пользователей запущен\n')
  await ds.initialize()
  console.log('✅ БД подключена\n')

  const userRepo      = ds.getRepository(User)
  const profileRepo   = ds.getRepository(UserProfile)
  const sleepRepo     = ds.getRepository(SleepData)
  const moodRepo      = ds.getRepository(MoodData)
  const stressRepo    = ds.getRepository(StressData)
  const activityRepo  = ds.getRepository(ActivityData)
  const waterRepo     = ds.getRepository(WaterData)
  const nutritionRepo = ds.getRepository(NutritionData)

  for (const persona of PERSONAS) {
    console.log('──────────────────────────────────────────')
    console.log(`👤 ${persona.firstName} ${persona.lastName} (${persona.email})`)

    let user = await userRepo.findOne({ where: { email: persona.email } })
    if (user) {
      console.log(`   ♻️  существует (${user.id}) — пересоздаём данные`)
      await sleepRepo.delete({ userId: user.id })
      await moodRepo.delete({ userId: user.id })
      await stressRepo.delete({ userId: user.id })
      await activityRepo.delete({ userId: user.id })
      await waterRepo.delete({ userId: user.id })
      await nutritionRepo.delete({ userId: user.id })
    } else {
      const hash = await bcrypt.hash(PASSWORD, 10)
      user = userRepo.create({
        id: randomUUID(),
        email: persona.email,
        passwordHash: hash,
        firstName: persona.firstName,
        lastName: persona.lastName,
        isActive: true,
      })
      await userRepo.save(user)
      console.log(`   ✅ создан (${user.id})`)
    }

    // Профиль с НОВЫМИ полями (age/weight/height/nutritionGoal)
    let profile = await profileRepo.findOne({ where: { userId: user.id } })
    if (!profile) {
      profile = profileRepo.create({ userId: user.id })
    }
    profile.age                   = persona.profile.age
    profile.weightKg              = persona.profile.weightKg
    profile.heightCm              = persona.profile.heightCm
    profile.gender                = persona.profile.gender
    profile.name                  = persona.name
    profile.ageRange              = null  // новый онбординг ageRange не пишет
    profile.nutritionGoal         = persona.profile.nutritionGoal
    profile.sleepGoalHours        = persona.profile.sleepGoalHours
    profile.baselineStress        = persona.profile.baselineStress
    profile.chronotype            = persona.profile.chronotype
    profile.activityLevel         = persona.profile.activityLevel
    profile.workoutsPerWeek       = persona.profile.workoutsPerWeek
    profile.avgWorkoutDurationMin = persona.profile.avgWorkoutDurationMin
    profile.primaryGoal           = persona.profile.primaryGoal
    profile.goals                 = persona.profile.goals
    profile.sportTypes            = persona.profile.sportTypes as any
    profile.sportGoal             = persona.profile.sportGoal as any
    profile.onboardingCompleted   = true
    profile.onboardingCompletedAt = new Date()
    await profileRepo.save(profile)

    // 14 дней данных: i=13 → 14 дней назад, i=0 → вчера
    for (let i = DAYS - 1; i >= 0; i--) {
      const date = daysAgo(i + 1)
      const day = persona.generateDay(i, date)

      if (day.sleep) {
        await sleepRepo.save(sleepRepo.create({
          userId: user.id, date,
          bedTime:       day.sleep.bedTime,
          wakeTime:      day.sleep.wakeTime,
          durationHours: day.sleep.durationHours,
          quality:       day.sleep.quality,
          interruptions: day.sleep.interruptions,
        }))
      }
      if (day.mood) {
        await moodRepo.save(moodRepo.create({
          userId: user.id, date,
          time:      day.mood.time,
          moodScore: day.mood.moodScore,
        }))
      }
      for (const st of day.stress) {
        await stressRepo.save(stressRepo.create({
          userId: user.id, date,
          time: st.time, level: st.level,
        }))
      }
      for (const act of day.activity) {
        await activityRepo.save(activityRepo.create({
          userId: user.id, date,
          time: act.time, type: act.type, intensity: act.intensity,
          durationMinutes: act.durationMinutes,
          caloriesBurned:  act.caloriesBurned ?? null,
        }))
      }
      for (const w of day.water) {
        await waterRepo.save(waterRepo.create({
          userId: user.id, date,
          time: w.time, amountMl: w.amountMl,
        }))
      }
      for (const n of day.nutrition) {
        await nutritionRepo.save(nutritionRepo.create({
          userId: user.id, date,
          time:         n.time,
          mealType:     n.mealType,
          description:  n.meal.description,
          calories:     n.meal.calories,
          proteinGrams: n.meal.protein,
          carbsGrams:   n.meal.carbs,
          fatGrams:     n.meal.fat,
        }))
      }
    }
    console.log(`   📅 ${DAYS} дней данных вставлено`)
  }

  console.log('\n══════════════════════════════════════════')
  console.log('🎉 Seed завершён!\n')
  printVerificationGuide()

  await ds.destroy()
}

function printVerificationGuide() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                     ГАЙД ПО ПРОВЕРКЕ                              ║
╠═══════════════════════════════════════════════════════════════════╣
║ Пароль для всех: ${PASSWORD.padEnd(48)} ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║ 1. masha@test.local — Маша, 28, маркетолог.                       ║
║    Профиль: 65кг / 168см / maintain.                              ║
║    Образцовый ЗОЖ: сон 7-8ч, бег по утрам, регулярное питание.    ║
║    Ожидаем цепочки: F1 (сон → mood), F2 (perfect days).           ║
║    Калории цель: ~2200 ккал. Все severity = good.                 ║
║                                                                   ║
║ 2. andrey@test.local — Андрей, 32, senior dev.                    ║
║    Профиль: 88кг / 180см / muscle_gain.                           ║
║    Будни: поздний жирный ужин в 22:30 + сон 5-6ч.                 ║
║    Выходные — нормальный график (контраст).                       ║
║    Ожидаем: A1 (late fatty → bad sleep), A2 (chronic),            ║
║    C1 (sleep deficit → stress).                                   ║
║                                                                   ║
║ 3. olya@test.local — Оля, 35, мама в декрете.                     ║
║    Профиль: 70кг / 165см / lose_weight.                           ║
║    Высокий стресс 7-8/10 каждый день, вода 800-1000мл.            ║
║    Ожидаем: D3 (stress + dehydration), E1 (хроническая            ║
║    дегидратация + активность → плохое mood).                      ║
║    Норма воды: 30×70 = 2100мл (видно как «ниже на 1100мл»).       ║
║                                                                   ║
║ 4. kirill@test.local — Кирилл, 41, директор.                      ║
║    Профиль: 82кг / 178см / maintain.                              ║
║    4 раза/нед vigorous gym в 21:00 (60-80 мин).                   ║
║    Ожидаем: B1 (evening vigorous → bad sleep), B2 (overtraining), ║
║    D2 (chronic stress + late bedtime).                            ║
║                                                                   ║
║ 5. dima@test.local — Дима, 22, студент.                           ║
║    Профиль: 75кг / 183см / maintain.                              ║
║    Хаос: отбой 22:00 / 01:00 / 03:30 каждый день рулетка.         ║
║    Низкий белок (~45-55г/день при норме 75г).                     ║
║    Ожидаем: A4 (low protein → mood), C2 (irregular bed),          ║
║    C3 (sleep debt → mood drop).                                   ║
║                                                                   ║
╠═══════════════════════════════════════════════════════════════════╣
║ Что смотреть в UI:                                                ║
║   /dashboard            — карточка «Питание из X ккал» (личная)   ║
║   /dashboard/profile    — секция «Тело и калории»                 ║
║   /dashboard/recommendations — «Почему этот совет» → цепочки      ║
║                                                                   ║
║ Полная регенерация: запусти этот скрипт повторно                  ║
║ (старые записи будут удалены и пересозданы).                      ║
╚═══════════════════════════════════════════════════════════════════╝
`)
}

main().catch(err => {
  console.error('❌ Ошибка:', err)
  process.exit(1)
})
