/**
 * backend/src/seed/seed-gamification.ts
 *
 * Бэкафилл геймификации по УЖЕ существующим данным в БД.
 *
 * Зачем: основной seed (seed-test-users.ts) и любые прямые вставки в БД
 * пишут метрики напрямую, минуя POST-хуки, которые вызывают
 * GamificationService.processDay(). Поэтому у засеянных пользователей
 * остаётся дефолт (Новичок, 0 очков, без бейджей). Этот скрипт
 * восстанавливает геймификацию: читает данные по дням и прогоняет
 * processDay() в хронологическом порядке — ровно как если бы пользователь
 * вносил данные каждый день руками.
 *
 * Идемпотентен: перед обработкой пользователя его UserGamification-строка
 * удаляется и пересоздаётся с нуля. Можно запускать повторно.
 *
 * Запуск через docker-compose:
 *   docker compose exec backend npx ts-node -T src/seed/seed-gamification.ts
 *
 * Только для одного пользователя (по email):
 *   docker compose exec -e GAMIFY_EMAIL=masha@test.local backend \
 *     npx ts-node -T src/seed/seed-gamification.ts
 */

import 'reflect-metadata'
import { DataSource } from 'typeorm'

import { User }            from '../users/user.entity'
import { UserProfile }     from '../user-profile/user-profile.entity'
import { SleepData }       from '../sleep/sleep.entity'
import { MoodData }        from '../mood/mood.entity'
import { StressData }      from '../stress/stress.entity'
import { ActivityData }    from '../activity/activity.entity'
import { WaterData }       from '../water/water.entity'
import { NutritionData }   from '../nutrition/nutrition.entity'
import { UserGamification } from '../gamification/gamification.entity'
import { GamificationService, DailyHealthSnapshot } from '../gamification/gamification.service'

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/low_cortisol',
  entities: [User, UserProfile, SleepData, MoodData, StressData,
             ActivityData, WaterData, NutritionData, UserGamification],
  synchronize: false,
  logging: false,
})

function toDateStr(val: unknown): string {
  if (val instanceof Date) return val.toISOString().split('T')[0]
  return String(val).split('T')[0]
}

const avg = (xs: number[]): number | undefined =>
  xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined

interface DayAgg {
  date: string
  sleepHours?: number
  sleepQuality?: number
  stress: number[]
  mood: number[]
  activityMin: number
  waterMl: number
  hasSleep: boolean
  hasStress: boolean
  hasMood: boolean
  hasActivity: boolean
  hasWater: boolean
  hasNutrition: boolean
}

async function backfillUser(
  gamSvc: GamificationService,
  user: User,
  profile: UserProfile | null,
): Promise<{ days: number; points: number; badges: number; level: string } | null> {
  const userId = user.id

  const [sleep, mood, stress, activity, water, nutrition] = await Promise.all([
    ds.getRepository(SleepData).find({ where: { userId } }),
    ds.getRepository(MoodData).find({ where: { userId } }),
    ds.getRepository(StressData).find({ where: { userId } }),
    ds.getRepository(ActivityData).find({ where: { userId } }),
    ds.getRepository(WaterData).find({ where: { userId } }),
    ds.getRepository(NutritionData).find({ where: { userId } }),
  ])

  const byDate = new Map<string, DayAgg>()
  const ensure = (d: unknown): DayAgg => {
    const key = toDateStr(d)
    if (!byDate.has(key)) {
      byDate.set(key, {
        date: key, stress: [], mood: [], activityMin: 0, waterMl: 0,
        hasSleep: false, hasStress: false, hasMood: false,
        hasActivity: false, hasWater: false, hasNutrition: false,
      })
    }
    return byDate.get(key)!
  }

  for (const r of sleep) {
    const a = ensure(r.date)
    a.hasSleep = true
    a.sleepHours = r.durationHours ?? a.sleepHours
    a.sleepQuality = r.quality ?? a.sleepQuality
  }
  for (const r of mood)    { const a = ensure(r.date); a.hasMood = true; a.mood.push(r.moodScore) }
  for (const r of stress)  { const a = ensure(r.date); a.hasStress = true; a.stress.push(r.level) }
  for (const r of activity){ const a = ensure(r.date); a.hasActivity = true; a.activityMin += r.durationMinutes ?? 0 }
  for (const r of water)   { const a = ensure(r.date); a.hasWater = true; a.waterMl += r.amountMl ?? 0 }
  for (const r of nutrition){ const a = ensure(r.date); a.hasNutrition = true }

  const days = [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date))
  if (days.length === 0) return null

  // Идемпотентность: сбрасываем геймификацию пользователя в дефолт.
  await ds.getRepository(UserGamification).delete({ userId })

  // Скользящие средние (для improver-бейджей): берём до 14 предыдущих
  // дней, где значение присутствует.
  const sleepHist: number[] = []
  const moodHist: number[] = []
  const actHist: number[] = []

  for (const d of days) {
    const moodScore = avg(d.mood)
    const stressLevel = avg(d.stress)

    const snap: DailyHealthSnapshot = {
      date: d.date,
      hasSleep: d.hasSleep,
      hasStress: d.hasStress,
      hasMood: d.hasMood,
      hasActivity: d.hasActivity,
      hasWater: d.hasWater,
      hasNutrition: d.hasNutrition,
      sleepHours: d.sleepHours,
      sleepQuality: d.sleepQuality,
      stressLevel,
      moodScore,
      activityMinutes: d.hasActivity ? d.activityMin : undefined,
      waterMl: d.hasWater ? d.waterMl : undefined,
      sleepGoalHours: profile?.sleepGoalHours ?? undefined,
      baselineStress: profile?.baselineStress ?? undefined,
      prevAvgSleep: avg(sleepHist.slice(-14)),
      prevAvgMood: avg(moodHist.slice(-14)),
      prevAvgActivity: avg(actHist.slice(-14)),
    }

    await gamSvc.processDay(userId, snap)

    if (d.sleepHours != null) sleepHist.push(d.sleepHours)
    if (moodScore != null) moodHist.push(moodScore)
    if (d.hasActivity) actHist.push(d.activityMin)
  }

  const stats = await gamSvc.getStats(userId)
  return { days: days.length, points: stats.totalPoints, badges: stats.badges.length, level: stats.levelName }
}

async function run() {
  await ds.initialize()
  const gamSvc = new GamificationService(ds.getRepository(UserGamification))

  const onlyEmail = process.env.GAMIFY_EMAIL?.trim()
  const users = onlyEmail
    ? await ds.getRepository(User).find({ where: { email: onlyEmail } })
    : await ds.getRepository(User).find()

  console.log(`[gamify-backfill] пользователей к обработке: ${users.length}`)

  for (const user of users) {
    const profile = await ds.getRepository(UserProfile).findOne({ where: { userId: user.id } })
    const res = await backfillUser(gamSvc, user, profile)
    if (res) {
      console.log(
        `  ✓ ${user.email.padEnd(34)} дней=${res.days}  очки=${res.points}  ` +
        `бейджи=${res.badges}  уровень=${res.level}`,
      )
    }
  }

  console.log('[gamify-backfill] готово')
  await ds.destroy()
}

run().catch((err) => {
  console.error('[gamify-backfill] FAIL:', err)
  process.exit(1)
})
