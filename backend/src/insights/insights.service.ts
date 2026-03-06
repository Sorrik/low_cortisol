// backend/src/insights/insights.service.ts

import { Injectable, Logger, Inject } from '@nestjs/common'
import { CACHE_MANAGER }              from '@nestjs/cache-manager'
import { Cache }                      from 'cache-manager'
import { InjectRepository }           from '@nestjs/typeorm'
import { Repository, MoreThanOrEqual } from 'typeorm'

import { MlService }            from '../ml/ml.service'
import { LlmService, RecommendationsResult, ArticleSource } from '../llm/llm.service'
import { MlPredictResponseDto, RecommendationDto } from '../ml/dto/ml-response.dto'

import { SleepData }     from '../sleep/sleep.entity'
import { MoodData }      from '../mood/mood.entity'
import { StressData }    from '../stress/stress.entity'
import { ActivityData }  from '../activity/activity.entity'
import { WaterData }     from '../water/water.entity'
import { NutritionData } from '../nutrition/nutrition.entity'

// ── Расширяем ответ — добавляем sources ───────────────────────
export interface InsightsResponseDto extends MlPredictResponseDto {
  sources?: ArticleSource[]
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name)

  private readonly WINDOW_DAYS = 60
  private readonly PREDICT_TTL = 60 * 60         // 1 час
  private readonly TRAIN_TTL   = 60 * 60 * 24    // 24 часа
  private readonly LLM_TTL     = 60 * 60 * 3     // 3 часа

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,

    private readonly mlService:  MlService,
    private readonly llmService: LlmService,

    @InjectRepository(SleepData)
    private readonly sleepRepo: Repository<SleepData>,

    @InjectRepository(MoodData)
    private readonly moodRepo: Repository<MoodData>,

    @InjectRepository(StressData)
    private readonly stressRepo: Repository<StressData>,

    @InjectRepository(ActivityData)
    private readonly activityRepo: Repository<ActivityData>,

    @InjectRepository(WaterData)
    private readonly waterRepo: Repository<WaterData>,

    @InjectRepository(NutritionData)
    private readonly nutritionRepo: Repository<NutritionData>,
  ) {}

  // ── Public ────────────────────────────────────────────────

  async getInsights(userId: string): Promise<InsightsResponseDto> {
    this.logger.log(`[getInsights] userId=${userId}`)

    const predictCacheKey = `predict:${userId}`
    const cached = await this.cache.get<InsightsResponseDto>(predictCacheKey)

    if (cached) {
      this.logger.log(`[getInsights] cache HIT → userId=${userId}`)
      return cached
    }

    this.logger.log(`[getInsights] cache MISS → загружаем данные из БД`)
    const healthData = await this._buildHealthData(userId)

    // ── ML: train если нужно ──────────────────
    const trainCacheKey   = `train:${userId}`
    const trainedRecently = await this.cache.get(trainCacheKey)

    if (!trainedRecently) {
      try {
        const trainResult = await this.mlService.train({
          user_id:     userId,
          health_data: healthData,
        })
        this.logger.log(
          `[getInsights] trained → status=${trainResult.status}, version=${trainResult.model_version}`,
        )
        await this.cache.set(trainCacheKey, true, this.TRAIN_TTL)
      } catch (err) {
        this.logger.warn(`[getInsights] train failed (non-fatal): ${err}`)
      }
    }

    // ── ML: predict ───────────────────────────
    const prediction = await this.mlService.predict({
      user_id:     userId,
      health_data: healthData,
    })

    // ── LLM: рекомендации с fallback на ML ───
    const llmResult = await this._getLlmRecommendations(
      userId,
      healthData,
      prediction.recommendations,
    )

    // Собираем финальный ответ с sources
    const result: InsightsResponseDto = {
      ...prediction,
      recommendations: llmResult.recommendations,
      sources:         llmResult.sources,
    }

    await this.cache.set(predictCacheKey, result, this.PREDICT_TTL)
    this.logger.log(`[getInsights] закэшировано на 1 час`)

    return result
  }

  async invalidateCache(userId: string): Promise<void> {
    await this.cache.del(`predict:${userId}`)
    await this.cache.del(`train:${userId}`)
    await this.cache.del(`llm:${userId}`)
    this.logger.log(`[invalidateCache] кэш сброшен → userId=${userId}`)
  }

  // ── LLM с fallback ────────────────────────────────────────

  private async _getLlmRecommendations(
    userId:     string,
    healthData: any,
    mlFallback: RecommendationDto[],
  ): Promise<RecommendationsResult> {

    const llmCacheKey = `llm:${userId}`
    const cached = await this.cache.get<RecommendationsResult>(llmCacheKey)

    if (cached) {
      this.logger.log(`[_getLlmRecommendations] LLM cache HIT`)
      return cached
    }

    try {
      this.logger.log(`[_getLlmRecommendations] вызываем LLM`)
      const result = await this.llmService.getRecommendations(healthData)

      if (result.recommendations.length === 0) {
        this.logger.warn(`[_getLlmRecommendations] LLM вернул 0 рекомендаций → fallback на ML`)
        return { recommendations: mlFallback, sources: [] }
      }

      await this.cache.set(llmCacheKey, result, this.LLM_TTL)
      this.logger.log(
        `[_getLlmRecommendations] LLM OK → ${result.recommendations.length} рекомендаций, ` +
        `${result.sources.length} источников, закэшировано на 3ч`
      )
      return result

    } catch (err) {
      this.logger.error(`[_getLlmRecommendations] LLM недоступен → fallback на ML: ${err}`)
      return { recommendations: mlFallback, sources: [] }
    }
  }

  // ── Сборка healthData из БД ───────────────────────────────

  private async _buildHealthData(userId: string) {
    const sinceStr = this._sinceDate(this.WINDOW_DAYS)

    const [sleep, mood, stress, activity, water, nutrition] = await Promise.all([

      this.sleepRepo.find({
        where: { userId, date: MoreThanOrEqual(sinceStr) },
        order: { date: 'ASC' },
      }),

      this.moodRepo.find({
        where: { userId, date: MoreThanOrEqual(sinceStr) },
        order: { date: 'ASC' },
      }),

      this.stressRepo.find({
        where: { userId, date: MoreThanOrEqual(sinceStr) },
        order: { date: 'ASC' },
      }),

      this.activityRepo
        .createQueryBuilder('a')
        .select('a.date',                    'date')
        .addSelect('SUM(a.durationMinutes)', 'totalminutes')
        .addSelect('SUM(a.caloriesBurned)',  'totalcalories')
        .addSelect(`
          CASE
            WHEN MAX(CASE a.intensity
              WHEN 'vigorous' THEN 3
              WHEN 'moderate' THEN 2
              ELSE 1 END) = 3 THEN 'vigorous'
            WHEN MAX(CASE a.intensity
              WHEN 'vigorous' THEN 3
              WHEN 'moderate' THEN 2
              ELSE 1 END) = 2 THEN 'moderate'
            ELSE 'light'
          END
        `, 'intensity')
        .where('a.userId = :userId', { userId })
        .andWhere('a.date >= :since', { since: sinceStr })
        .groupBy('a.date')
        .orderBy('a.date', 'ASC')
        .getRawMany(),

      this.waterRepo
        .createQueryBuilder('w')
        .select('w.date',             'date')
        .addSelect('SUM(w.amountMl)', 'totalml')
        .where('w.userId = :userId', { userId })
        .andWhere('w.date >= :since', { since: sinceStr })
        .groupBy('w.date')
        .orderBy('w.date', 'ASC')
        .getRawMany(),

      this.nutritionRepo
        .createQueryBuilder('n')
        .select('n.date',                 'date')
        .addSelect('SUM(n.calories)',      'totalcalories')
        .addSelect('SUM(n.proteinGrams)',  'totalprotein')
        .addSelect('SUM(n.carbsGrams)',    'totalcarbs')
        .addSelect('SUM(n.fatGrams)',      'totalfat')
        .where('n.userId = :userId', { userId })
        .andWhere('n.date >= :since', { since: sinceStr })
        .groupBy('n.date')
        .orderBy('n.date', 'ASC')
        .getRawMany(),
    ])

    this.logger.log(
      `[_buildHealthData] userId=${userId}: ` +
      `sleep=${sleep.length}, mood=${mood.length}, stress=${stress.length}, ` +
      `activity=${activity.length}, water=${water.length}, nutrition=${nutrition.length}`,
    )

    return {
      user_id: userId,
      sleep: sleep.map((r) => ({
        date:           r.date,
        duration_hours: Number(r.durationHours ?? 7.0),
        quality:        r.quality,
        interruptions:  r.interruptions ?? 0,
      })),
      mood: mood.map((r) => ({
        date:       r.date,
        mood_score: r.moodScore,
      })),
      stress: stress.map((r) => ({
        date:  r.date,
        level: r.level,
      })),
      activity: activity.map((r) => ({
        date:             this._toDateStr(r.date),
        duration_minutes: Number(r.totalminutes),
        intensity:        r.intensity,
        calories_burned:  Number(r.totalcalories ?? 0),
      })),
      water: water.map((r) => ({
        date:      this._toDateStr(r.date),
        amount_ml: Number(r.totalml),
      })),
      nutrition: nutrition.map((r) => ({
        date:          this._toDateStr(r.date),
        calories:      Number(r.totalcalories),
        protein_grams: Number(r.totalprotein),
        carbs_grams:   Number(r.totalcarbs   ?? 0),
        fat_grams:     Number(r.totalfat     ?? 0),
      })),
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  private _toDateStr(val: unknown): string {
    if (val instanceof Date) return val.toISOString().split('T')[0]
    return String(val).split('T')[0]
  }

  private _sinceDate(days: number): string {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString().split('T')[0]
  }
}