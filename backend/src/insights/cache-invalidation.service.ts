import { Injectable, Logger, Inject } from '@nestjs/common'
import { InjectRepository }           from '@nestjs/typeorm'
import { CACHE_MANAGER }              from '@nestjs/cache-manager'
import { Cache }                      from 'cache-manager'
import { Repository }                 from 'typeorm'

import { GamificationService }        from '../gamification/gamification.service'
import { SleepData }                  from '../sleep/sleep.entity'
import { StressData }                 from '../stress/stress.entity'
import { MoodData }                   from '../mood/mood.entity'
import { ActivityData }               from '../activity/activity.entity'
import { WaterData }                  from '../water/water.entity'
import { NutritionData }              from '../nutrition/nutrition.entity'

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name)

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
    private readonly gamification: GamificationService,
    @InjectRepository(SleepData)     private readonly sleepRepo:     Repository<SleepData>,
    @InjectRepository(StressData)    private readonly stressRepo:    Repository<StressData>,
    @InjectRepository(MoodData)      private readonly moodRepo:      Repository<MoodData>,
    @InjectRepository(ActivityData)  private readonly activityRepo:  Repository<ActivityData>,
    @InjectRepository(WaterData)     private readonly waterRepo:     Repository<WaterData>,
    @InjectRepository(NutritionData) private readonly nutritionRepo: Repository<NutritionData>,
  ) {}

  // Вызывается из update() и remove() — только кэш, без геймификации
  async invalidate(userId: string): Promise<void> {
    await this.cache.del(`predict:${userId}`)
    await this.cache.del(`train:${userId}`)
    this.logger.log(`[cache] сброшен → ${userId}`)
  }

  // Вызывается только из create() — кэш + геймификация
  async invalidateWithMetric(userId: string, date: string): Promise<void> {
    await this.invalidate(userId)
    try {
      const snap = await this.buildSnapshot(userId, date)
      const result = await this.gamification.processDay(userId, snap)
      if (result.newBadges.length > 0)
        this.logger.log(`[gamification] новые бейджи: ${result.newBadges.join(', ')}`)
    } catch (err) {
      this.logger.warn(`[gamification] processDay failed (non-fatal): ${err}`)
    }
  }

  private async buildSnapshot(userId: string, date: string) {
    const [sleep, stresses, mood, activities, waters, nutritions] = await Promise.all([
      this.sleepRepo.findOne({ where: { userId, date } }),
      this.stressRepo.find({ where: { userId, date } }),
      this.moodRepo.findOne({ where: { userId, date } }),
      this.activityRepo.find({ where: { userId, date } }),
      this.waterRepo.find({ where: { userId, date } }),
      this.nutritionRepo.find({ where: { userId, date } }),
    ])

    const avgStress     = stresses.length
      ? stresses.reduce((s, r) => s + r.level, 0) / stresses.length
      : undefined
    const totalActivity = activities.reduce((s, a) => s + a.durationMinutes, 0)
    const totalWater    = waters.reduce((s, w) => s + w.amountMl, 0)

    return {
      date,
      hasSleep:        !!sleep,
      hasStress:       stresses.length > 0,
      hasMood:         !!mood,
      hasActivity:     activities.length > 0,
      hasWater:        waters.length > 0,
      hasNutrition:    nutritions.length > 0,
      sleepHours:      sleep?.durationHours ?? undefined,
      sleepQuality:    sleep?.quality,
      stressLevel:     avgStress,
      moodScore:       mood?.moodScore,
      activityMinutes: totalActivity || undefined,
      waterMl:         totalWater || undefined,
    }
  }
}