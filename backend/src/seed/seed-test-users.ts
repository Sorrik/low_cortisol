/**
 * backend/src/seed/seed-test-users.ts
 *
 * Создаёт 5 тестовых пользователей с 14 днями данных каждый.
 * Используется для комплексного тестирования ML + LLM + геймификации.
 *
 * Запуск (PowerShell):
 *   $env:DATABASE_URL="postgresql://postgres:password@localhost:5432/low_cortisol"
 *   npx ts-node -r tsconfig-paths/register src/seed/seed-test-users.ts
 *
 * ═══════════════════════════════════════════════════════════════
 * Персонажи:
 *   1. alice@test.local — «Образцовый» — все метрики в норме
 *   2. bob@test.local   — «Недосып + стресс» — критические отклонения
 *   3. carol@test.local — «Ночной едок» — питание после 22:00
 *   4. dave@test.local  — «Вечерний спортсмен» — силовые в 22:00
 *   5. eve@test.local   — «Работоголик» — стресс >> базовый, мало калорий
 * ═══════════════════════════════════════════════════════════════
 */

import 'reflect-metadata'
import { DataSource } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'

// ── Entities ─────────────────────────────────────────────────
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
/** Возвращает строку даты YYYY-MM-DD, сдвинутую на daysBack дней назад от сегодня */
function daysAgo(daysBack: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysBack)
  return d.toISOString().split('T')[0]
}

/** Случайное число в диапазоне [min, max] */
function rnd(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min))
}

/** Случайное число с плавающей точкой в [min, max] */
function rndF(min: number, max: number, dec = 1): number {
  return parseFloat((min + Math.random() * (max - min)).toFixed(dec))
}

/** Форматирует час+минуты в строку HH:MM */
function hhmm(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const PASSWORD = 'Test1234!'

// ── Persona Definitions ───────────────────────────────────────

interface PersonaDef {
  email:     string
  firstName: string
  lastName:  string
  profile:   {
    sleepGoalHours: number
    baselineStress: number
    ageRange:       string
    gender:         string
    chronotype:     string
  }
  /** Генерирует данные за один день. dayIndex=0 → вчера, 13 → 14 дней назад */
  generateDay: (dayIndex: number) => DayData
}

interface DayData {
  sleep?: { bedTime: string; wakeTime: string; quality: number; interruptions: number }
  mood?:  { moodScore: number; time: string }
  stress: { level: number; time: string }[]
  activity?: { type: string; intensity: string; durationMinutes: number; time: string; caloriesBurned?: number }[]
  water:  { amountMl: number; time: string }[]
  nutrition: { time: string; mealType: string; description: string; calories: number; protein: number; carbs: number; fat: number }[]
}

// ──────────────────────────────────────────────────────────────
// Персонаж 1: Alice — «Образцовый пользователь»
// Все метрики в норме. Ожидаем: все severity "good", нет аномалий,
// стрик 14 дней, ML высокий прогноз.
// ──────────────────────────────────────────────────────────────
const alice: PersonaDef = {
  email: 'alice@test.local',
  firstName: 'Alice',
  lastName: 'Norm',
  profile: { sleepGoalHours: 8, baselineStress: 5, ageRange: '26-35', gender: 'female', chronotype: 'early_bird' },
  generateDay: (_i) => ({
    sleep:    { bedTime: hhmm(23, rnd(0, 30)), wakeTime: hhmm(7, rnd(0, 30)), quality: rnd(7, 9), interruptions: rnd(0, 1) },
    mood:     { moodScore: rnd(7, 9), time: hhmm(8, rnd(0, 30)) },
    stress:   [{ level: rnd(2, 4), time: hhmm(19, 0) }],
    activity: [{ type: 'yoga', intensity: 'light', durationMinutes: rnd(30, 45), time: hhmm(7, 30), caloriesBurned: rnd(120, 180) }],
    water:    [
      { amountMl: 500, time: hhmm(8, 0) },
      { amountMl: 500, time: hhmm(12, 0) },
      { amountMl: 500, time: hhmm(16, 0) },
      { amountMl: rnd(500, 700), time: hhmm(19, 0) },
    ],
    nutrition: [
      { time: hhmm(8, 0),  mealType: 'breakfast', description: 'Овсянка с фруктами', calories: rnd(350, 450), protein: 12, carbs: 60, fat: 8  },
      { time: hhmm(13, 0), mealType: 'lunch',     description: 'Курица с рисом',      calories: rnd(550, 650), protein: 35, carbs: 65, fat: 12 },
      { time: hhmm(18, 30),mealType: 'dinner',    description: 'Рыба с овощами',      calories: rnd(450, 550), protein: 30, carbs: 40, fat: 15 },
    ],
  }),
}

// ──────────────────────────────────────────────────────────────
// Персонаж 2: Bob — «Хронический недосып + стресс»
// Спит 4–5 ч (< 5.5 порог → alert sleep), стресс 7–9 (> 7 → alert),
// настроение 3–5 (avg < 4 → alert mood).
// ──────────────────────────────────────────────────────────────
const bob: PersonaDef = {
  email: 'bob@test.local',
  firstName: 'Bob',
  lastName: 'Sleep',
  profile: { sleepGoalHours: 8, baselineStress: 5, ageRange: '26-35', gender: 'male', chronotype: 'night_owl' },
  generateDay: (_i) => ({
    sleep:    { bedTime: hhmm(1, rnd(0, 30)), wakeTime: hhmm(5, rnd(30, 59)), quality: rnd(3, 5), interruptions: rnd(2, 4) },
    mood:     { moodScore: rnd(3, 5), time: hhmm(6, 0) },
    stress:   [
      { level: rnd(7, 9), time: hhmm(10, 0) },
      { level: rnd(6, 8), time: hhmm(18, 0) },
    ],
    activity: [{ type: 'walk', intensity: 'light', durationMinutes: rnd(5, 15), time: hhmm(12, 0) }],
    water:    [
      { amountMl: rnd(300, 500), time: hhmm(9, 0) },
      { amountMl: rnd(300, 500), time: hhmm(15, 0) },
      { amountMl: rnd(300, 400), time: hhmm(20, 0) },
    ],
    nutrition: [
      { time: hhmm(8, 0),  mealType: 'breakfast', description: 'Кофе и сэндвич',    calories: rnd(300, 400), protein: 12, carbs: 40, fat: 10 },
      { time: hhmm(14, 0), mealType: 'lunch',     description: 'Фастфуд',           calories: rnd(800, 1000), protein: 25, carbs: 90, fat: 35 },
      { time: hhmm(21, 0), mealType: 'dinner',    description: 'Пицца вечером',     calories: rnd(500, 700), protein: 20, carbs: 70, fat: 20 },
    ],
  }),
}

// ──────────────────────────────────────────────────────────────
// Персонаж 3: Carol — «Ночной едок»
// Ужин в 22:30–23:00 с тяжёлой едой. Нерегулярный сон (±2ч).
// Ожидаем: food → attention (late_meal_flag=1), sleep → attention (нерегулярность).
// ──────────────────────────────────────────────────────────────
const carol: PersonaDef = {
  email: 'carol@test.local',
  firstName: 'Carol',
  lastName: 'Latenight',
  profile: { sleepGoalHours: 7.5, baselineStress: 4, ageRange: '18-25', gender: 'female', chronotype: 'night_owl' },
  generateDay: (i) => {
    // Нерегулярность: чётные дни засыпает в 01:00, нечётные — в 03:00
    const bedHour  = i % 2 === 0 ? 1 : 3
    const wakeHour = bedHour + 7
    return {
      sleep:    { bedTime: hhmm(bedHour, rnd(0, 30)), wakeTime: hhmm(wakeHour, rnd(0, 30)), quality: rnd(5, 7), interruptions: rnd(1, 2) },
      mood:     { moodScore: rnd(5, 7), time: hhmm(wakeHour + 1, 0) },
      stress:   [{ level: rnd(4, 6), time: hhmm(20, 0) }],
      activity: [{ type: 'walk', intensity: 'light', durationMinutes: rnd(15, 25), time: hhmm(15, 0) }],
      water:    [
        { amountMl: 400, time: hhmm(10, 0) },
        { amountMl: 500, time: hhmm(15, 0) },
        { amountMl: 400, time: hhmm(20, 0) },
        { amountMl: 300, time: hhmm(22, 0) },
      ],
      nutrition: [
        { time: hhmm(9, 0),  mealType: 'breakfast', description: 'Тосты с авокадо',        calories: rnd(350, 450), protein: 10, carbs: 45, fat: 15 },
        { time: hhmm(14, 0), mealType: 'lunch',     description: 'Паста карбонара',         calories: rnd(600, 700), protein: 22, carbs: 75, fat: 25 },
        // Поздний ужин > 22:00 — критический для late_meal_flag
        { time: hhmm(22, 30),mealType: 'dinner',    description: 'Чизбургер с картошкой',  calories: rnd(800, 1000), protein: 30, carbs: 90, fat: 40 },
      ],
    }
  },
}

// ──────────────────────────────────────────────────────────────
// Персонаж 4: Dave — «Вечерний спортсмен»
// Интенсивные тренировки в 22:00 (vigorous_too_close_to_bed=1).
// Засыпает в 00:30. Ожидаем: activity → attention, sleep → attention.
// ──────────────────────────────────────────────────────────────
const dave: PersonaDef = {
  email: 'dave@test.local',
  firstName: 'Dave',
  lastName: 'Gym',
  profile: { sleepGoalHours: 8, baselineStress: 4, ageRange: '26-35', gender: 'male', chronotype: 'night_owl' },
  generateDay: (_i) => ({
    sleep:    { bedTime: hhmm(0, rnd(20, 40)), wakeTime: hhmm(7, rnd(30, 59)), quality: rnd(5, 7), interruptions: rnd(1, 3) },
    mood:     { moodScore: rnd(6, 8), time: hhmm(8, 0) },
    stress:   [{ level: rnd(5, 7), time: hhmm(21, 0) }],
    activity: [
      // Утренняя пробежка — норм
      { type: 'run',  intensity: 'moderate', durationMinutes: rnd(20, 30), time: hhmm(7, 30), caloriesBurned: rnd(200, 280) },
      // Вечерний зал в 22:00 — vigorous слишком близко ко сну
      { type: 'gym',  intensity: 'vigorous', durationMinutes: rnd(60, 75), time: hhmm(22, 0), caloriesBurned: rnd(400, 500) },
    ],
    water:    [
      { amountMl: 500, time: hhmm(8, 0)  },
      { amountMl: 750, time: hhmm(13, 0) },
      { amountMl: 500, time: hhmm(18, 0) },
      { amountMl: 750, time: hhmm(22, 30)},
    ],
    nutrition: [
      { time: hhmm(8, 30), mealType: 'breakfast', description: 'Протеиновая каша',  calories: rnd(500, 600), protein: 40, carbs: 60, fat: 10 },
      { time: hhmm(13, 0), mealType: 'lunch',     description: 'Рис с курицей',     calories: rnd(700, 800), protein: 50, carbs: 80, fat: 15 },
      { time: hhmm(18, 0), mealType: 'snack',     description: 'Протеиновый шейк',  calories: rnd(300, 400), protein: 35, carbs: 30, fat:  5 },
      { time: hhmm(20, 0), mealType: 'dinner',    description: 'Стейк с овощами',   calories: rnd(600, 700), protein: 55, carbs: 25, fat: 25 },
    ],
  }),
}

// ──────────────────────────────────────────────────────────────
// Персонаж 5: Eve — «Работоголик»
// Стресс 8–9 >> базовый 3 (alert), настроение 3–4 (alert),
// калории 1000–1150 (< 1200 → alert food), вода 800–1000 мл (→ improve).
// ──────────────────────────────────────────────────────────────
const eve: PersonaDef = {
  email: 'eve@test.local',
  firstName: 'Eve',
  lastName: 'Workaholic',
  profile: { sleepGoalHours: 8, baselineStress: 3, ageRange: '36-45', gender: 'female', chronotype: 'early_bird' },
  generateDay: (_i) => ({
    sleep:    { bedTime: hhmm(23, rnd(0, 30)), wakeTime: hhmm(7, rnd(0, 30)), quality: rnd(4, 6), interruptions: rnd(1, 3) },
    mood:     { moodScore: rnd(3, 5), time: hhmm(8, 0) },
    stress:   [
      { level: rnd(8, 9), time: hhmm(11, 0) },
      { level: rnd(7, 9), time: hhmm(17, 0) },
    ],
    activity: [{ type: 'walk', intensity: 'light', durationMinutes: rnd(5, 10), time: hhmm(12, 30) }],
    water:    [
      { amountMl: rnd(200, 300), time: hhmm(9, 0)  },
      { amountMl: rnd(200, 300), time: hhmm(14, 0) },
      { amountMl: rnd(200, 300), time: hhmm(19, 0) },
    ],
    nutrition: [
      // Скромный завтрак — работает за компом
      { time: hhmm(9, 0),  mealType: 'breakfast', description: 'Кофе с крекерами', calories: rnd(200, 300), protein: 5, carbs: 35, fat: 8 },
      // Лёгкий обед — забывает поесть
      { time: hhmm(15, 0), mealType: 'lunch',     description: 'Йогурт и фрукты',  calories: rnd(350, 450), protein: 10, carbs: 55, fat: 5 },
      // Поздний небольшой ужин
      { time: hhmm(20, 30),mealType: 'dinner',    description: 'Лёгкий салат',     calories: rnd(300, 400), protein: 12, carbs: 35, fat: 10 },
    ],
  }),
}

const PERSONAS: PersonaDef[] = [alice, bob, carol, dave, eve]
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
    console.log(`──────────────────────────────────────────`)
    console.log(`👤 ${persona.firstName} ${persona.lastName} (${persona.email})`)

    // 1. Пользователь (upsert по email)
    let user = await userRepo.findOne({ where: { email: persona.email } })
    if (user) {
      console.log(`   ♻️  уже существует (${user.id}) — данные пересоздаются`)
      // Удаляем старые данные этого пользователя
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

    // 2. Профиль (upsert)
    let profile = await profileRepo.findOne({ where: { userId: user.id } })
    if (!profile) {
      profile = profileRepo.create({ userId: user.id })
    }
    profile.sleepGoalHours     = persona.profile.sleepGoalHours
    profile.baselineStress     = persona.profile.baselineStress
    profile.ageRange           = persona.profile.ageRange as any
    profile.gender             = persona.profile.gender as any
    profile.chronotype         = persona.profile.chronotype as any
    profile.goals              = ['sleep', 'stress']
    profile.primaryGoal        = 'stress'
    profile.activityLevel      = 'moderate'
    profile.onboardingCompleted = true
    profile.onboardingCompletedAt = new Date()
    await profileRepo.save(profile)

    // 3. Данные за 14 дней (dayIndex 13..0 → самый старый..вчера)
    for (let i = DAYS - 1; i >= 0; i--) {
      const date = daysAgo(i + 1)  // i=13 → 14 дней назад, i=0 → вчера
      const day  = persona.generateDay(i)

      if (day.sleep) {
        const s = sleepRepo.create({
          userId: user.id, date,
          bedTime:  day.sleep.bedTime,
          wakeTime: day.sleep.wakeTime,
          quality:  day.sleep.quality,
          interruptions: day.sleep.interruptions,
        })
        await sleepRepo.save(s)
      }

      if (day.mood) {
        const m = moodRepo.create({
          userId: user.id, date,
          time: day.mood.time,
          moodScore: day.mood.moodScore,
        })
        await moodRepo.save(m)
      }

      for (const st of day.stress) {
        const s = stressRepo.create({
          userId: user.id, date,
          time: st.time, level: st.level,
        })
        await stressRepo.save(s)
      }

      for (const act of day.activity ?? []) {
        const a = activityRepo.create({
          userId: user.id, date,
          time: act.time,
          type: act.type,
          intensity: act.intensity,
          durationMinutes: act.durationMinutes,
          caloriesBurned: act.caloriesBurned ?? null,
        })
        await activityRepo.save(a)
      }

      for (const w of day.water) {
        const wd = waterRepo.create({
          userId: user.id, date,
          time: w.time, amountMl: w.amountMl,
        })
        await waterRepo.save(wd)
      }

      for (const n of day.nutrition) {
        const nd = nutritionRepo.create({
          userId: user.id, date,
          time: n.time, mealType: n.mealType,
          description: n.description,
          calories: n.calories,
          proteinGrams: n.protein,
          carbsGrams: n.carbs,
          fatGrams: n.fat,
        })
        await nutritionRepo.save(nd)
      }
    }
    console.log(`   📅 14 дней данных вставлено`)
  }

  console.log('\n══════════════════════════════════════════')
  console.log('🎉 Seed завершён!\n')
  printVerificationGuide()

  await ds.destroy()
}

function printVerificationGuide() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           ГАЙД ПО ПРОВЕРКЕ СИСТЕМЫ                          ║
╠══════════════════════════════════════════════════════════════╣
║ Пароль для всех: Test1234!                                   ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  1. alice@test.local — «Образцовый»                         ║
║     Ожидаем: ВСЕ severity = "good"                          ║
║     Нет аномалий, стрик 14 дней, ML прогноз 7+/10           ║
║                                                              ║
║  2. bob@test.local   — «Недосып + стресс»                   ║
║     Ожидаем: sleep=ALERT (сон 4-5ч < 5.5ч порог)            ║
║              stress=ALERT (уровень 7-9 > 7 порог)           ║
║              mood=ALERT   (avg mood 3-5, avg < 4)           ║
║     Аномалии: настроение, возможно сон                       ║
║                                                              ║
║  3. carol@test.local — «Ночной едок»                        ║
║     Ожидаем: food=ATTENTION (ужин в 22:30)                  ║
║              sleep=ATTENTION (нерегулярность ±2ч)           ║
║     LLM должен упомянуть время приёма пищи и кортизол       ║
║                                                              ║
║  4. dave@test.local  — «Вечерний спортсмен»                 ║
║     Ожидаем: activity=ATTENTION (vigorous в 22:00)          ║
║              sleep=ATTENTION (засыпает в 00:30)             ║
║     ML: vigorous_too_close_to_bed=1 → влияет на прогноз     ║
║                                                              ║
║  5. eve@test.local   — «Работоголик»                        ║
║     Ожидаем: stress=ALERT  (8-9 >> базовый 3)               ║
║              mood=ALERT    (avg mood 3-4 < 4 порог)         ║
║              food=ALERT    (калории 850-1150 < 1200 порог)  ║
║     _correctSeverities должен поднять severity              ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║ Что проверить в UI:                                          ║
║  ✓ /insights/me — severity для каждой метрики               ║
║  ✓ /anomalies   — аномалии с правильными единицами          ║
║  ✓ /gamification/me — streaks после 14 дней                 ║
║  ✓ Введи данные за прошлый день → streaks пересчитаются     ║
╚══════════════════════════════════════════════════════════════╝
`)
}

main().catch(err => {
  console.error('❌ Ошибка:', err)
  process.exit(1)
})







