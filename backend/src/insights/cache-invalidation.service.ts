import { Injectable, Logger, Inject } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { Repository } from 'typeorm'

import { DailyHealthSnapshot, GamificationService } from '../gamification/gamification.service'
import { SleepData } from '../sleep/sleep.entity'
import { StressData } from '../stress/stress.entity'
import { MoodData } from '../mood/mood.entity'
import { ActivityData } from '../activity/activity.entity'
import { WaterData } from '../water/water.entity'
import { NutritionData } from '../nutrition/nutrition.entity'

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name)

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
    private readonly gamification: GamificationService,
    @InjectRepository(SleepData) private readonly sleepRepo: Repository<SleepData>,
    @InjectRepository(StressData) private readonly stressRepo: Repository<StressData>,
    @InjectRepository(MoodData) private readonly moodRepo: Repository<MoodData>,
    @InjectRepository(ActivityData) private readonly activityRepo: Repository<ActivityData>,
    @InjectRepository(WaterData) private readonly waterRepo: Repository<WaterData>,
    @InjectRepository(NutritionData) private readonly nutritionRepo: Repository<NutritionData>,
  ) {}

  /** TTL для timestamp'а последней инвалидации — должен пережить LLM_TTL (6ч)
   *  и быть достаточно большим, чтобы значение не «исчезло» из кэша
   *  раньше, чем мы успеем построить с ним новый hash. */
  private readonly METRIC_UPDATED_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 дней

  async invalidate(userId: string): Promise<void> {
    await this.cache.del(`predict:${userId}`)
    await this.cache.del(`train:${userId}`)

    // LLM-кэш `llm:${userId}:${stateHash}` нельзя удалить wildcard'ом
    // (cache-manager этого не умеет на in-memory store), поэтому вместо
    // удаления мы перезаписываем «версию» пользователя — она входит в
    // stateHash, поэтому новый запрос построит новый ключ, а старые
    // ключи естественно истекут по LLM_TTL.
    await this.cache.set(
      `metric_updated_at:${userId}`,
      Date.now(),
      this.METRIC_UPDATED_TTL_SECONDS * 1000,
    )

    this.logger.log(`[cache] cleared -> ${userId} (predict+train, llm rotated)`)
  }

  /** Вспомогательный геттер для InsightsService, чтобы вкладывать
   *  «версию метрик» в LLM stateHash. */
  async getMetricUpdatedAt(userId: string): Promise<number> {
    const value = await this.cache.get<number>(`metric_updated_at:${userId}`)
    return typeof value === 'number' ? value : 0
  }

  async invalidateWithMetric(userId: string, date: string): Promise<void> {
    await this.invalidate(userId)

    try {
      const today = new Date().toISOString().split('T')[0]
      if (date < today) {
        const snapshots = await this.buildSnapshotsForUser(userId)
        await this.gamification.recalculateStreaks(userId, snapshots)
        this.logger.log(
          `[gamification] streaks recalculated for ${userId} (past entry: ${date}, snapshots=${snapshots.length})`,
        )
        return
      }

      const snap = await this.buildSnapshot(userId, date)
      const result = await this.gamification.processDay(userId, snap)
      if (result.newBadges.length > 0) {
        this.logger.log(`[gamification] new badges: ${result.newBadges.join(', ')}`)
      }
    } catch (err) {
      this.logger.warn(`[gamification] failed (non-fatal): ${err}`)
    }
  }

  private async buildSnapshot(userId: string, date: string): Promise<DailyHealthSnapshot> {
    const [sleep, stresses, mood, activities, waters, nutritions] = await Promise.all([
      this.sleepRepo.findOne({ where: { userId, date } }),
      this.stressRepo.find({ where: { userId, date } }),
      this.moodRepo.findOne({ where: { userId, date } }),
      this.activityRepo.find({ where: { userId, date } }),
      this.waterRepo.find({ where: { userId, date } }),
      this.nutritionRepo.find({ where: { userId, date } }),
    ])

    const avgStress = stresses.length
      ? stresses.reduce((sum, row) => sum + row.level, 0) / stresses.length
      : undefined
    const totalActivity = activities.reduce((sum, row) => sum + row.durationMinutes, 0)
    const totalWater = waters.reduce((sum, row) => sum + row.amountMl, 0)

    return {
      date,
      hasSleep: !!sleep,
      hasStress: stresses.length > 0,
      hasMood: !!mood,
      hasActivity: activities.length > 0,
      hasWater: waters.length > 0,
      hasNutrition: nutritions.length > 0,
      sleepHours: sleep?.durationHours ?? undefined,
      sleepQuality: sleep?.quality,
      stressLevel: avgStress,
      moodScore: mood?.moodScore,
      activityMinutes: totalActivity || undefined,
      waterMl: totalWater || undefined,
    }
  }

  private async buildSnapshotsForUser(userId: string): Promise<DailyHealthSnapshot[]> {
    const [sleep, stresses, mood, activities, waters, nutritions] = await Promise.all([
      this.sleepRepo.find({
        where: { userId },
        select: ['date', 'durationHours', 'quality'],
        order: { date: 'ASC' },
      }),
      this.stressRepo.find({
        where: { userId },
        select: ['date', 'level'],
        order: { date: 'ASC' },
      }),
      this.moodRepo.find({
        where: { userId },
        select: ['date', 'moodScore'],
        order: { date: 'ASC' },
      }),
      this.activityRepo.find({
        where: { userId },
        select: ['date', 'durationMinutes'],
        order: { date: 'ASC' },
      }),
      this.waterRepo.find({
        where: { userId },
        select: ['date', 'amountMl'],
        order: { date: 'ASC' },
      }),
      this.nutritionRepo.find({
        where: { userId },
        select: ['date'],
        order: { date: 'ASC' },
      }),
    ])

    type SnapshotAccumulator = {
      date: string
      hasSleep: boolean
      hasStress: boolean
      hasMood: boolean
      hasActivity: boolean
      hasWater: boolean
      hasNutrition: boolean
      sleepHours?: number
      sleepQuality?: number
      stressTotal: number
      stressCount: number
      moodScore?: number
      activityMinutes?: number
      waterMl?: number
    }

    const snapshotsByDate = new Map<string, SnapshotAccumulator>()

    const ensure = (date: string): SnapshotAccumulator => {
      let snapshot = snapshotsByDate.get(date)
      if (!snapshot) {
        snapshot = {
          date,
          hasSleep: false,
          hasStress: false,
          hasMood: false,
          hasActivity: false,
          hasWater: false,
          hasNutrition: false,
          stressTotal: 0,
          stressCount: 0,
        }
        snapshotsByDate.set(date, snapshot)
      }
      return snapshot
    }

    for (const row of sleep) {
      const snapshot = ensure(row.date)
      snapshot.hasSleep = true
      snapshot.sleepHours = row.durationHours ?? undefined
      snapshot.sleepQuality = row.quality
    }

    for (const row of stresses) {
      const snapshot = ensure(row.date)
      snapshot.hasStress = true
      snapshot.stressTotal += row.level
      snapshot.stressCount += 1
    }

    for (const row of mood) {
      const snapshot = ensure(row.date)
      snapshot.hasMood = true
      snapshot.moodScore = row.moodScore
    }

    for (const row of activities) {
      const snapshot = ensure(row.date)
      snapshot.hasActivity = true
      snapshot.activityMinutes = (snapshot.activityMinutes ?? 0) + row.durationMinutes
    }

    for (const row of waters) {
      const snapshot = ensure(row.date)
      snapshot.hasWater = true
      snapshot.waterMl = (snapshot.waterMl ?? 0) + row.amountMl
    }

    for (const row of nutritions) {
      const snapshot = ensure(row.date)
      snapshot.hasNutrition = true
    }

    return [...snapshotsByDate.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(snapshot => ({
        date: snapshot.date,
        hasSleep: snapshot.hasSleep,
        hasStress: snapshot.hasStress,
        hasMood: snapshot.hasMood,
        hasActivity: snapshot.hasActivity,
        hasWater: snapshot.hasWater,
        hasNutrition: snapshot.hasNutrition,
        sleepHours: snapshot.sleepHours,
        sleepQuality: snapshot.sleepQuality,
        stressLevel: snapshot.stressCount > 0
          ? snapshot.stressTotal / snapshot.stressCount
          : undefined,
        moodScore: snapshot.moodScore,
        activityMinutes: snapshot.activityMinutes,
        waterMl: snapshot.waterMl,
      }))
  }
}
