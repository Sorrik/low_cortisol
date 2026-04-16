// backend/src/insights/insights.service.ts

import { Injectable, Logger, Inject } from '@nestjs/common'
import { CACHE_MANAGER }              from '@nestjs/cache-manager'
import { Cache }                      from 'cache-manager'
import { InjectRepository }           from '@nestjs/typeorm'
import { Repository, MoreThanOrEqual } from 'typeorm'

import { MlService }                  from '../ml/ml.service'
import { LlmService, RecommendationsResult, ArticleSource } from '../llm/llm.service'
import { MlPrediction }               from '../llm/prompt-builder'
import { MlPredictResponseDto, RecommendationDto } from '../ml/dto/ml-response.dto'
import { UserProfileService }         from '../user-profile/user-profile.service'
import { AnomalyDetectionService, AnomalyReport } from './anomaly-detection.service'

import { SleepData }     from '../sleep/sleep.entity'
import { MoodData }      from '../mood/mood.entity'
import { StressData }    from '../stress/stress.entity'
import { ActivityData }  from '../activity/activity.entity'
import { WaterData }     from '../water/water.entity'
import { NutritionData } from '../nutrition/nutrition.entity'

import { RecommendationRulesService, RuleResult } from './recommendation-rules.service'
import { MetricsAdapter }                          from './metrics-adapter'

export interface InsightsResponseDto extends MlPredictResponseDto {
  sources?:            ArticleSource[]
  ruleRecommendations: RuleResult[]
  hasCriticalAlerts:   boolean
  anomalyReport?:      AnomalyReport
  mlRecommendations?:  RecommendationDto[]
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name)

  private readonly WINDOW_DAYS = 35
  private readonly PREDICT_TTL = 60 * 60
  private readonly TRAIN_TTL   = 60 * 60 * 24
  private readonly LLM_TTL     = 60 * 60 * 6

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,

    private readonly mlService:          MlService,
    private readonly llmService:         LlmService,
    private readonly rulesService:       RecommendationRulesService,
    private readonly userProfileService: UserProfileService,
    private readonly anomalyService:     AnomalyDetectionService,

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

  async getInsights(userId: string): Promise<InsightsResponseDto> {
    this.logger.log(`[getInsights] userId=${userId}`)

    const [healthData, userProfile] = await Promise.all([
      this._buildHealthData(userId),
      this.userProfileService.getProfileForMl(userId),
    ])

    this.logger.log(
      `[getInsights] profile → goal=${userProfile.primaryGoal}, ` +
      `sleep_goal=${userProfile.sleepGoalHours}h, ` +
      `stress_baseline=${userProfile.baselineStress}, ` +
      `training=${userProfile.weeklyTrainingMinutes}min/week`,
    )

    const anomalyReport = this.anomalyService.detect(healthData)

    if (anomalyReport.hasAnomalies) {
      this.logger.log(
        `[anomaly] count=${anomalyReport.anomalies.length}, ` +
        `critical=${anomalyReport.hasCritical}, ` +
        `gap=${anomalyReport.gapDays}d, ` +
        `quality=${anomalyReport.dataQuality}%`,
      )
    }

    const metrics = MetricsAdapter.fromInsightsData(
      healthData.sleep.map(s => ({
        hours:   s.duration_hours,
        quality: s.quality,
        date:    s.date,
      })),
      healthData.nutrition.map(n => ({
        calories:     n.calories,
        proteinGrams: n.protein_grams,
        carbsGrams:   n.carbs_grams,
        fatGrams:     n.fat_grams,
        date:         n.date,
      })),
      healthData.activity.map(a => ({
        durationMinutes: a.duration_minutes,
        date:            a.date,
      })),
      [
        ...healthData.mood.map(m => ({ score: m.mood_score, date: m.date })),
        ...healthData.stress.map(s => ({ stressLevel: s.level, date: s.date })),
      ],
    )

    const ruleResults       = this.rulesService.topN(metrics, 4)
    const hasCriticalAlerts = ruleResults.some(r => r.severity === 'critical')
                           || anomalyReport.hasCritical
    const stateHash         = this.rulesService.stateHash(metrics)

    const predictCacheKey = `predict:${userId}`
    const cached = await this.cache.get<InsightsResponseDto>(predictCacheKey)

    if (cached) {
      this.logger.log(`[getInsights] cache HIT`)
      return {
        ...cached,
        ruleRecommendations: ruleResults,
        hasCriticalAlerts,
        anomalyReport,
      }
    }

    this.logger.log(`[getInsights] cache MISS → ML + LLM`)

    const trainCacheKey   = `train:${userId}`
    const trainedRecently = await this.cache.get(trainCacheKey)

    if (!trainedRecently) {
      try {
        const trainResult = await this.mlService.train({
          user_id:      userId,
          health_data:  healthData,
          user_profile: userProfile,
        })
        this.logger.log(`[getInsights] trained → ${trainResult.status}`)
        await this.cache.set(trainCacheKey, true, this.TRAIN_TTL)
      } catch (err) {
        this.logger.warn(`[getInsights] train failed (non-fatal): ${err}`)
      }
    }

    const prediction = await this.mlService.predict({
      user_id:      userId,
      health_data:  healthData,
      user_profile: userProfile,
    })

    const pythonRecommendations: RecommendationDto[] = prediction.recommendations ?? []

    this.logger.log(
      `[getInsights] ML → mood=${prediction.predicted_mood}, ` +
      `phase=${prediction.phase?.mode}, ` +
      `python_recs=${pythonRecommendations.length}`,
    )

    const mlPrediction: MlPrediction | null = prediction.predicted_mood != null
      ? {
          predicted_mood:   prediction.predicted_mood,
          confidence_lower: prediction.confidence_lower  ?? null,
          confidence_upper: prediction.confidence_upper  ?? null,
          top_influencers:  (prediction.top_influencers  ?? []).map(inf => ({
            factor:        inf.factor,
            impact:        inf.impact,
            raw_shap:      inf.raw_shap      ?? 0,
            direction:     inf.direction as 'positive' | 'negative',
            description:   inf.description,
            feature_value: inf.feature_value ?? 0,
          })),
          phase_mode:    prediction.phase?.mode   ?? 'learning',
          model_version: prediction.model_version ?? 'v1',
        }
      : null

    const llmResult = await this._getLlmRecommendations(
      userId, stateHash, healthData, metrics,
      ruleResults, pythonRecommendations, mlPrediction, userProfile,
    )

    const result: InsightsResponseDto = {
      ...prediction,
      recommendations:     llmResult.recommendations,
      mlRecommendations:   pythonRecommendations,
      sources:             llmResult.sources,
      ruleRecommendations: ruleResults,
      hasCriticalAlerts,
      anomalyReport,
    }

    await this.cache.set(predictCacheKey, result, this.PREDICT_TTL)
    return result
  }

  async invalidateCache(userId: string): Promise<void> {
    await this.cache.del(`predict:${userId}`)
    await this.cache.del(`train:${userId}`)
    this.logger.log(`[invalidateCache] кэш сброшен → userId=${userId}`)
  }

  // ── LLM ───────────────────────────────────────────────────

  private async _getLlmRecommendations(
    userId:         string,
    stateHash:      string,
    healthData:     any,
    metrics:        ReturnType<typeof MetricsAdapter.fromInsightsData>,
    rules:          RuleResult[],
    pythonFallback: RecommendationDto[],
    mlPrediction:   MlPrediction | null,
    userProfile:    Awaited<ReturnType<UserProfileService['getProfileForMl']>>,
  ): Promise<RecommendationsResult> {

    const llmCacheKey = `llm:${userId}:${stateHash}`
    const cached = await this.cache.get<RecommendationsResult>(llmCacheKey)

    if (cached) {
      this.logger.log(`[LLM] cache HIT (hash=${stateHash})`)
      return cached
    }

    this.logger.log(`[LLM] cache MISS → GPT`)

    try {
      const enrichedData = {
        ...healthData,
        _user_profile: {
          primary_goal:        userProfile.primaryGoal,
          sleep_goal_hours:    userProfile.sleepGoalHours,
          chronotype:          userProfile.chronotype,
          activity_level:      userProfile.activityLevel,
          baseline_stress:     userProfile.baselineStress,
          weekly_training_min: userProfile.weeklyTrainingMinutes,
          sport_goal:          userProfile.sportGoal,
        },
        _rules_context: {
          triggered_rules: rules.map(r => ({
            ruleId:      r.ruleId,
            title:       r.title,
            shortReason: r.shortReason,
            severity:    r.severity,
            suggestion:  r.suggestion,
          })),
          key_metrics: {
            avg_sleep_hours:   +metrics.avgSleepHours.toFixed(1),
            avg_calories:      Math.round(metrics.avgCalories),
            avg_protein_grams: Math.round(metrics.avgProteinGrams),
            avg_activity_mins: Math.round(metrics.avgActivityMins),
            avg_stress_level:  +metrics.avgStressLevel.toFixed(1),
            avg_mood_score:    +metrics.avgMoodScore.toFixed(1),
            nutrition_days:    metrics.nutritionDays,
            active_days:       metrics.activeDays,
          },
        },
      }

      const result = await this.llmService.getRecommendations(enrichedData, mlPrediction)

      if (result.recommendations.length === 0) {
        this.logger.warn(`[LLM] 0 рекомендаций → Python fallback (${pythonFallback.length} шт.)`)
        return { recommendations: pythonFallback, sources: [] }
      }

      await this.cache.set(llmCacheKey, result, this.LLM_TTL)
      this.logger.log(
        `[LLM] OK → ${result.recommendations.length} рек., ` +
        `sources=${result.sources?.length ?? 0}, кэш 6ч`,
      )
      return result

    } catch (err) {
      this.logger.error(`[LLM] недоступен → Python fallback (${pythonFallback.length} шт.): ${err}`)
      return { recommendations: pythonFallback, sources: [] }
    }
  }

  // ── _buildHealthData ──────────────────────────────────────

  private async _buildHealthData(userId: string) {
    const sinceStr = this._sinceDate(this.WINDOW_DAYS)

    const [sleep, mood, stress, activityRaw, waterRaw, nutritionRaw] = await Promise.all([
      // Sleep — простой find, нужны bedTime и wakeTime
      this.sleepRepo.find({
        where: { userId, date: MoreThanOrEqual(sinceStr) },
        order: { date: 'ASC' },
      }),

      // Mood
      this.moodRepo.find({
        where: { userId, date: MoreThanOrEqual(sinceStr) },
        order: { date: 'ASC' },
      }),

      // Stress
      this.stressRepo.find({
        where: { userId, date: MoreThanOrEqual(sinceStr) },
        order: { date: 'ASC' },
      }),

      // Activity — агрегируем по дню (time в БД нет, используем createdat)
      this.activityRepo
        .createQueryBuilder('a')
        .select('a.date',                    'date')
        .addSelect('SUM(a.durationMinutes)', 'totalminutes')
        .addSelect('SUM(a.caloriesBurned)',  'totalcalories')
        // Время последней тренировки за день из createdat
        // Используется как приближение пока нет поля time
        .addSelect('MAX(a.createdAt)',        'lastactivitytime')
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

      // Water — агрегируем по дню
      this.waterRepo
        .createQueryBuilder('w')
        .select('w.date',             'date')
        .addSelect('SUM(w.amountMl)', 'totalml')
        .where('w.userId = :userId', { userId })
        .andWhere('w.date >= :since', { since: sinceStr })
        .groupBy('w.date')
        .orderBy('w.date', 'ASC')
        .getRawMany(),

      // Nutrition — НЕ агрегируем, нужно поле time для каждой записи
      this.nutritionRepo.find({
        where: { userId, date: MoreThanOrEqual(sinceStr) },
        order: { date: 'ASC', time: 'ASC' },
      }),
    ])

    return {
      user_id: userId,

      // Sleep — прокидываем bedTime и wakeTime для циркадных фичей
      sleep: sleep.map(r => ({
        date:           r.date,
        duration_hours: Number(r.durationHours ?? 7.0),
        quality:        r.quality,
        interruptions:  r.interruptions ?? 0,
        bed_time:       r.bedTime  ?? null,   // "23:30" → feature_engineering парсит
        wake_time:      r.wakeTime ?? null,   // "07:00"
      })),

      mood:   mood.map(r => ({ date: r.date, mood_score: r.moodScore })),
      stress: stress.map(r => ({ date: r.date, level: r.level })),

      // Activity — используем createdAt как приближение времени тренировки
      // После добавления поля time в БД заменить на r.time
      activity: activityRaw.map(r => ({
        date:             this._toDateStr(r.date),
        duration_minutes: Number(r.totalminutes),
        intensity:        r.intensity,
        calories_burned:  Number(r.totalcalories ?? 0),
        // createdAt как временное решение — час создания записи
        // Не идеально, но лучше чем ничего пока нет поля time
        time:             r.lastactivitytime
                            ? this._timestampToTimeStr(r.lastactivitytime)
                            : null,
      })),

      water: waterRaw.map(r => ({
        date:      this._toDateStr(r.date),
        amount_ml: Number(r.totalml),
      })),

      // Nutrition — отдельные записи с полем time
      nutrition: nutritionRaw.map(r => ({
        date:          r.date,
        time:          r.time ?? null,             // "21:30" — для late_meal_flag
        calories:      r.calories,
        protein_grams: Number(r.proteinGrams),
        carbs_grams:   Number(r.carbsGrams),
        fat_grams:     Number(r.fatGrams),
      })),
    }
  }

  private _toDateStr(val: unknown): string {
    if (val instanceof Date) return val.toISOString().split('T')[0]
    return String(val).split('T')[0]
  }

  // Извлекает "HH:MM" из timestamp — используется для activity.createdAt
  private _timestampToTimeStr(val: unknown): string | null {
    try {
      const d = val instanceof Date ? val : new Date(String(val))
      if (isNaN(d.getTime())) return null
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      return `${h}:${m}`
    } catch {
      return null
    }
  }

  private _sinceDate(days: number): string {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString().split('T')[0]
  }
}