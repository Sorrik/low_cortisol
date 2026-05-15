// backend/src/insights/insights.service.ts

import { createHash } from 'node:crypto'

import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Cache } from 'cache-manager'
import { MoreThanOrEqual, Repository } from 'typeorm'

import { LlmService, RecommendationsResult, ArticleSource } from '../llm/llm.service'
import { MlPrediction, UserFeedbackSummary } from '../llm/prompt-builder'
import { MlPredictResponseDto, ModelMetaDto, RecommendationDto } from '../ml/dto/ml-response.dto'
import { MlService } from '../ml/ml.service'
import { UserProfileService } from '../user-profile/user-profile.service'
import { ActivityData } from '../activity/activity.entity'
import { MoodData } from '../mood/mood.entity'
import { NutritionData } from '../nutrition/nutrition.entity'
import { SleepData } from '../sleep/sleep.entity'
import { StressData } from '../stress/stress.entity'
import { WaterData } from '../water/water.entity'
import { CreateFeedbackDto, FeedbackResponseDto } from './dto/feedback.dto'
import { RecommendationFeedback } from './recommendation-feedback.entity'
import { AnomalyDetectionService, AnomalyReport } from './anomaly-detection.service'
import { CacheInvalidationService } from './cache-invalidation.service'
import { CalorieThresholdsService } from './calorie-thresholds.service'
import { CausalChainService } from './causal-chain.service'
import { CausalChain, CausalChainSummary, toChainSummary } from './causal-chain.types'
import { ConsistencyService, ConsistencySnapshot } from './consistency.service'
import { MetricsAdapter } from './metrics-adapter'
import { RecommendationRulesService, RuleResult } from './recommendation-rules.service'

export interface InsightsResponseDto extends MlPredictResponseDto {
  sources?: ArticleSource[]
  ruleRecommendations: RuleResult[]
  hasCriticalAlerts: boolean
  anomalyReport?: AnomalyReport
  mlRecommendations?: RecommendationDto[]
  /** Расхождения между субъективными и объективными метриками (consistency.service). */
  consistencyFlags?: ConsistencySnapshot['flags']
  /** Обнаруженные причинно-следственные цепочки между метриками (см. CausalChainService). */
  causalChains?: CausalChain[]
  /** Юридический disclaimer — клиент должен показать рядом с рекомендациями. */
  disclaimer?: string
}

/**
 * Disclaimer обязателен для health-сервиса: рекомендации не являются
 * медицинским советом. Хранится здесь, потому что текст один и относится
 * ко всему ответу, а не к конкретной рекомендации.
 */
const HEALTH_DISCLAIMER =
  'Рекомендации сформированы автоматически по введённым данным и не являются ' +
  'медицинским советом. При жалобах на здоровье, длительно сниженном настроении ' +
  'или хроническом стрессе обратитесь к специалисту (терапевт, психолог).'

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name)

  private readonly WINDOW_DAYS = 35
  private readonly RULES_WINDOW_DAYS = 7
  private readonly PREDICT_TTL = 60 * 60
  private readonly TRAIN_TTL = 60 * 60 * 24
  private readonly LLM_TTL = 60 * 60 * 6

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
    private readonly mlService: MlService,
    private readonly llmService: LlmService,
    private readonly rulesService: RecommendationRulesService,
    private readonly userProfileService: UserProfileService,
    private readonly anomalyService: AnomalyDetectionService,
    private readonly consistencyService: ConsistencyService,
    private readonly cacheInvalidationService: CacheInvalidationService,
    private readonly calorieThresholdsService: CalorieThresholdsService,
    private readonly causalChainService: CausalChainService,
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
    @InjectRepository(RecommendationFeedback)
    private readonly feedbackRepo: Repository<RecommendationFeedback>,
  ) {}

  /**
   * Сохраняет оценку пользователя по конкретной рекомендации.
   * Дубли по (user_id, rule_id) допускаются — пользователь может
   * передумать и оценить ту же рекомендацию по-другому при повторном
   * показе. История сохраняется полностью для аналитики.
   */
  async recordFeedback(
    userId: string,
    dto: CreateFeedbackDto,
  ): Promise<FeedbackResponseDto> {
    const entity = this.feedbackRepo.create({
      userId,
      ruleId: dto.ruleId,
      rating: dto.rating,
      comment: dto.comment ?? null,
      recommendationSnapshot: dto.recommendationSnapshot ?? null,
    })
    const saved = await this.feedbackRepo.save(entity)
    this.logger.log(
      `[feedback] user=${userId} rule=${dto.ruleId} rating=${dto.rating}`,
    )
    return { id: saved.id, createdAt: saved.createdAt.toISOString() }
  }

  /**
   * Сводка оценок пользователя за последние 30 дней. Передаётся в LLM-prompt
   * как сигнал «какие категории / шаблоны рекомендаций сработали хорошо,
   * а какие пользователь явно отверг» — см. правило 12 system prompt.
   *
   * Категория извлекается из rule_id по схеме «{category}.{rule_name}»
   * (например, sleep.short_sleep → sleep). Для llm-сгенерированных
   * советов rule_id вида llm.{hash} категория = 'llm'.
   */
  private async _getFeedbackSummary(userId: string): Promise<UserFeedbackSummary> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const rows = await this.feedbackRepo.find({
      where: { userId, createdAt: MoreThanOrEqual(since) },
      select: ['ruleId', 'rating'],
    })

    const empty: UserFeedbackSummary = {
      totalCount: 0,
      byCategoryHelpful: {},
      byCategoryNotHelpful: {},
      topNotHelpfulRuleIds: [],
      topHelpfulRuleIds: [],
    }
    if (rows.length === 0) return empty

    const categoryOf = (ruleId: string): string => {
      const dot = ruleId.indexOf('.')
      return dot > 0 ? ruleId.slice(0, dot) : ruleId
    }

    const ruleHelpful    = new Map<string, number>()
    const ruleNotHelpful = new Map<string, number>()
    const catHelpful     = new Map<string, number>()
    const catNotHelpful  = new Map<string, number>()

    for (const r of rows) {
      const cat = categoryOf(r.ruleId)
      const map = r.rating === 'helpful' ? ruleHelpful : ruleNotHelpful
      const cmap = r.rating === 'helpful' ? catHelpful : catNotHelpful
      map.set(r.ruleId, (map.get(r.ruleId) ?? 0) + 1)
      cmap.set(cat, (cmap.get(cat) ?? 0) + 1)
    }

    const topN = (m: Map<string, number>, n: number) =>
      [...m.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([ruleId, count]) => ({ ruleId, count }))

    return {
      totalCount: rows.length,
      byCategoryHelpful:    Object.fromEntries(catHelpful),
      byCategoryNotHelpful: Object.fromEntries(catNotHelpful),
      topHelpfulRuleIds:    topN(ruleHelpful, 3),
      topNotHelpfulRuleIds: topN(ruleNotHelpful, 3),
    }
  }

  async getInsights(userId: string): Promise<InsightsResponseDto> {
    this.logger.log(`[getInsights] userId=${userId}`)

    const [healthData, userProfile] = await Promise.all([
      this._buildHealthData(userId),
      this.userProfileService.getProfileForMl(userId),
    ])

    this.logger.log(
      `[getInsights] profile -> goal=${userProfile.primaryGoal}, ` +
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

    // ── Cross-validation субъективных vs объективных метрик ──
    // Если sleep_quality=8, а проспал 4 часа — confidence='low' для
    // рекомендации по сну. Не цензурируем, но помечаем для UI и LLM.
    const consistencyDays = this._buildConsistencyDays(healthData)
    const consistency     = this.consistencyService.evaluate(consistencyDays)

    // ── Причинно-следственные цепочки между метриками ──
    // Сервис ищет в данных пользователя 16 паттернов (A1..F2) вида
    // «вчера X → сегодня Y» и передаёт их в LLM-prompt как факты, на
    // основе которых строится текст совета. Это разрывает старый паттерн
    // «среднее значение по метрике Y». См. CausalChainService.
    const causalChainsResult = this.causalChainService.detect(
      healthData,
      {
        sleepGoalHours: userProfile.sleepGoalHours,
        baselineStress: userProfile.baselineStress,
      },
      { consistencyFlags: consistency.flags, topN: 5 },
    )
    if (causalChainsResult.chains.length > 0) {
      this.logger.log(
        `[causal] chains=${causalChainsResult.chains.length}: ` +
        causalChainsResult.chains
          .map(c => `${c.chainId}/${c.strength}`).join(', '),
      )
    }

    // Индивидуальные пороги калорий (Mifflin-St Jeor по данным профиля).
    // Точные age/weightKg/heightCm имеют приоритет; при их отсутствии
    // используется ageRange и популяционные средние по полу как fallback.
    // nutritionGoal (lose_weight | maintain | muscle_gain) сдвигает
    // targetCalories относительно TDEE.
    const calorieThresholds = this.calorieThresholdsService.compute({
      gender:        userProfile.gender,
      age:           userProfile.age,
      weightKg:      userProfile.weightKg,
      heightCm:      userProfile.heightCm,
      ageRange:      userProfile.ageRange,
      activityLevel: userProfile.activityLevel,
      nutritionGoal: userProfile.nutritionGoal,
    })
    this.logger.log(
      `[calories] BMR=${calorieThresholds.bmr}, TDEE=${calorieThresholds.tdee}, ` +
      `min=${calorieThresholds.minCalories}, max=${calorieThresholds.maxCalories}`,
    )

    const rulesData = this._sliceHealthDataWindow(healthData, this.RULES_WINDOW_DAYS)
    const metrics = MetricsAdapter.fromInsightsData(
      rulesData.sleep.map(s => ({
        hours: s.duration_hours,
        quality: s.quality,
        date: s.date,
      })),
      rulesData.nutrition.map(n => ({
        calories: n.calories,
        proteinGrams: n.protein_grams,
        carbsGrams: n.carbs_grams,
        fatGrams: n.fat_grams,
        date: n.date,
      })),
      rulesData.activity.map(a => ({
        durationMinutes: a.duration_minutes,
        date: a.date,
      })),
      [
        ...rulesData.mood.map(m => ({ score: m.mood_score, date: m.date })),
        ...rulesData.stress.map(s => ({ stressLevel: s.level, date: s.date })),
      ],
      {
        totalDataDays: this._countUniqueDays(healthData),
        goalCalories:  calorieThresholds.targetCalories,
        minCalories:   calorieThresholds.minCalories,
        maxCalories:   calorieThresholds.maxCalories,
      },
    )

    const ruleResults = this.rulesService.topN(metrics, 4)
    const ruleFallback = this._buildRuleFallbackRecommendations(ruleResults)
    const hasCriticalAlerts = ruleResults.some(r => r.severity === 'critical') || anomalyReport.hasCritical

    const predictCacheKey = `predict:${userId}`
    const cached = await this.cache.get<InsightsResponseDto>(predictCacheKey)
    if (cached) {
      this.logger.log('[getInsights] cache HIT')
      return {
        ...cached,
        ruleRecommendations: ruleResults,
        hasCriticalAlerts,
        anomalyReport,
      }
    }

    this.logger.log('[getInsights] cache MISS -> ML + LLM')

    const trainCacheKey = `train:${userId}`
    const trainedRecently = await this.cache.get(trainCacheKey)

    if (!trainedRecently) {
      try {
        const trainResult = await this.mlService.train({
          user_id: userId,
          health_data: healthData,
          user_profile: userProfile,
        })
        this.logger.log(`[getInsights] trained -> ${trainResult.status}`)
        await this.cache.set(trainCacheKey, true, this.TRAIN_TTL)
      } catch (err) {
        this.logger.warn(`[getInsights] train failed (non-fatal): ${err}`)
      }
    }

    let prediction: MlPredictResponseDto
    try {
      prediction = await this.mlService.predict({
        user_id: userId,
        health_data: healthData,
        user_profile: userProfile,
      })
    } catch (err) {
      this.logger.warn(`[getInsights] predict failed -> rule fallback: ${err}`)
      prediction = this._buildFallbackPrediction(userId, healthData)
    }

    const pythonRecommendations: RecommendationDto[] = prediction.recommendations ?? []

    this.logger.log(
      `[getInsights] ML -> mood=${prediction.predicted_mood}, ` +
      `phase=${prediction.phase?.mode}, ` +
      `python_recs=${pythonRecommendations.length}`,
    )

    const mlPrediction: MlPrediction | null = prediction.predicted_mood != null
      ? {
          predicted_mood: prediction.predicted_mood,
          confidence_lower: prediction.confidence_lower ?? null,
          confidence_upper: prediction.confidence_upper ?? null,
          top_influencers: (prediction.top_influencers ?? []).map(inf => ({
            factor: inf.factor,
            impact: inf.impact,
            raw_shap: inf.raw_shap ?? 0,
            direction: inf.direction as 'positive' | 'negative',
            description: inf.description,
            feature_value: inf.feature_value ?? 0,
          })),
          phase_mode: prediction.phase?.mode ?? 'learning',
          model_version: prediction.model_version ?? 'v1',
        }
      : null

    // metric_updated_at — timestamp последнего POST/PATCH/DELETE метрики
    // (см. CacheInvalidationService.invalidate). Включаем в hash, чтобы
    // после изменения метрики llm-кэш не возвращал устаревший ответ.
    const metricUpdatedAt = await this.cacheInvalidationService.getMetricUpdatedAt(userId)

    const feedbackSummary = await this._getFeedbackSummary(userId)

    const llmStateHash = this._buildLlmStateHash(
      metrics,
      ruleResults,
      userProfile,
      mlPrediction,
      anomalyReport,
      metricUpdatedAt,
      causalChainsResult.chains,
      feedbackSummary,
    )

    const llmResult = await this._getLlmRecommendations(
      userId,
      llmStateHash,
      healthData,
      metrics,
      ruleResults,
      pythonRecommendations.length > 0 ? pythonRecommendations : ruleFallback,
      mlPrediction,
      userProfile,
      causalChainsResult.chains,
      feedbackSummary,
    )

    // ── Финальная сборка: consistency + ids + model_meta + structured-trace ──
    const today = new Date().toISOString().slice(0, 10)
    const finalRecs = this._assignRecommendationIds(
      this._applyConsistency(llmResult.recommendations, consistency),
      today,
    )
    const finalMlRecs = this._assignRecommendationIds(
      this._applyConsistency(pythonRecommendations, consistency),
      today,
    )
    const modelMeta = this._extractModelMeta(prediction)

    this._logRecommendationTrace(userId, {
      phase: prediction.phase?.mode,
      ml: {
        predicted_mood: prediction.predicted_mood,
        model_meta: modelMeta,
        top_factors: (prediction.top_influencers ?? []).slice(0, 3).map(i => ({
          factor: i.factor, impact: i.impact, direction: i.direction,
        })),
      },
      consistency_flags: consistency.flags,
      rules_triggered: ruleResults.map(r => r.ruleId),
      ml_rule_ids: pythonRecommendations.map(r => r.rule_id).filter(Boolean),
      final_count: finalRecs.length,
    })

    const result: InsightsResponseDto = {
      ...prediction,
      recommendations: finalRecs,
      mlRecommendations: finalMlRecs,
      sources: llmResult.sources,
      ruleRecommendations: ruleResults,
      hasCriticalAlerts,
      anomalyReport,
      consistencyFlags: consistency.flags,
      causalChains: causalChainsResult.chains,
      model_meta: modelMeta,
      disclaimer: HEALTH_DISCLAIMER,
    }

    await this.cache.set(predictCacheKey, result, this.PREDICT_TTL)
    return result
  }

  /**
   * Structured trace одной записью: позволяет пост-фактум объяснить
   * любую конкретную рекомендацию — какие правила сработали, что дала
   * модель, какие consistency-флаги, итоговое количество. Пишется одной
   * строкой JSON-метаданных, чтобы её можно было собирать в логах
   * без парсинга свободного текста.
   */
  private _logRecommendationTrace(userId: string, trace: object): void {
    try {
      this.logger.log(`[trace] user=${userId} ${JSON.stringify(trace)}`)
    } catch {
      // не фатально — обрезанный лог лучше падения
      this.logger.log(`[trace] user=${userId} <serialize-failed>`)
    }
  }

  async invalidateCache(userId: string): Promise<void> {
    await this.cache.del(`predict:${userId}`)
    await this.cache.del(`train:${userId}`)
    this.logger.log(`[invalidateCache] cache cleared -> userId=${userId}`)
  }

  private async _getLlmRecommendations(
    userId: string,
    stateHash: string,
    healthData: any,
    metrics: ReturnType<typeof MetricsAdapter.fromInsightsData>,
    rules: RuleResult[],
    pythonFallback: RecommendationDto[],
    mlPrediction: MlPrediction | null,
    userProfile: Awaited<ReturnType<UserProfileService['getProfileForMl']>>,
    causalChains: CausalChain[],
    feedbackSummary: UserFeedbackSummary,
  ): Promise<RecommendationsResult> {
    const llmCacheKey = `llm:${userId}:${stateHash}`
    const cached = await this.cache.get<RecommendationsResult>(llmCacheKey)

    if (cached) {
      this.logger.log(`[LLM] cache HIT (hash=${stateHash})`)
      return cached
    }

    this.logger.log('[LLM] cache MISS -> GPT')

    try {
      const enrichedData = {
        ...healthData,
        _user_profile: {
          primary_goal: userProfile.primaryGoal,
          sleep_goal_hours: userProfile.sleepGoalHours,
          chronotype: userProfile.chronotype,
          activity_level: userProfile.activityLevel,
          baseline_stress: userProfile.baselineStress,
          weekly_training_min: userProfile.weeklyTrainingMinutes,
          sport_goal: userProfile.sportGoal,
        },
        _causal_chains: causalChains.map(toChainSummary) as CausalChainSummary[],
        _user_feedback: feedbackSummary.totalCount > 0 ? feedbackSummary : undefined,
        _rules_context: {
          triggered_rules: rules.map(r => ({
            ruleId: r.ruleId,
            title: r.title,
            shortReason: r.shortReason,
            severity: r.severity,
            suggestion: r.suggestion,
          })),
          key_metrics: {
            avg_sleep_hours: +metrics.avgSleepHours.toFixed(1),
            avg_calories: Math.round(metrics.avgCalories),
            avg_protein_grams: Math.round(metrics.avgProteinGrams),
            avg_activity_mins: Math.round(metrics.avgActivityMins),
            avg_stress_level: +metrics.avgStressLevel.toFixed(1),
            avg_mood_score: +metrics.avgMoodScore.toFixed(1),
            nutrition_days: metrics.nutritionDays,
            active_days: metrics.activeDays,
          },
        },
      }

      const result = await this.llmService.getRecommendations(enrichedData, mlPrediction)
      if (result.recommendations.length === 0) {
        this.logger.warn(`[LLM] 0 recommendations -> Python fallback (${pythonFallback.length})`)
        return { recommendations: pythonFallback, sources: [] }
      }

      await this.cache.set(llmCacheKey, result, this.LLM_TTL)
      this.logger.log(
        `[LLM] OK -> ${result.recommendations.length} recs, ` +
        `sources=${result.sources?.length ?? 0}, cache=6h`,
      )
      return result
    } catch (err) {
      this.logger.error(`[LLM] unavailable -> Python fallback (${pythonFallback.length}): ${err}`)
      return { recommendations: pythonFallback, sources: [] }
    }
  }

  private _buildLlmStateHash(
    metrics: ReturnType<typeof MetricsAdapter.fromInsightsData>,
    rules: RuleResult[],
    userProfile: Awaited<ReturnType<UserProfileService['getProfileForMl']>>,
    mlPrediction: MlPrediction | null,
    anomalyReport: AnomalyReport,
    metricUpdatedAt: number,
    causalChains: CausalChain[],
    feedbackSummary: UserFeedbackSummary,
  ): string {
    const snapshot = {
      // Версия данных пользователя — каждое POST/PATCH/DELETE метрики
      // обновляет timestamp в CacheInvalidationService, что меняет hash и
      // отделяет старый llm-кэш от свежего без wildcard-удаления ключей.
      metricUpdatedAt,
      // Идентификаторы обнаруженных причинно-следственных цепочек —
      // если набор меняется между запросами (например, появилась новая
      // запись метрики, на которой сработал A1), кэш-хеш меняется и LLM
      // получает обновлённый промпт с новыми фактами.
      chainIds: causalChains
        .map(c => `${c.chainId}:${c.strength}`)
        .sort()
        .join('|'),
      // Сводка по feedback: включаем total + топ-3 негативных rule_id.
      // Так кэш инвалидируется при новых оценках пользователя, и
      // следующая генерация уже учтёт его предпочтения.
      feedback: {
        total: feedbackSummary.totalCount,
        notHelpful: feedbackSummary.topNotHelpfulRuleIds
          .map(r => `${r.ruleId}:${r.count}`)
          .join('|'),
      },
      metrics: {
        avgSleepHours: +metrics.avgSleepHours.toFixed(2),
        avgCalories: Math.round(metrics.avgCalories),
        avgProteinGrams: Math.round(metrics.avgProteinGrams),
        avgActivityMins: Math.round(metrics.avgActivityMins),
        avgStressLevel: +metrics.avgStressLevel.toFixed(2),
        avgMoodScore: +metrics.avgMoodScore.toFixed(2),
        nutritionDays: metrics.nutritionDays,
        activeDays: metrics.activeDays,
        totalDataDays: metrics.totalDataDays,
      },
      rules: rules.map(r => ({
        ruleId: r.ruleId,
        severity: r.severity,
        priority: r.priority,
        metricValue: Number.isFinite(r.metricValue) ? +r.metricValue.toFixed(2) : r.metricValue,
      })),
      userProfile: {
        primaryGoal: userProfile.primaryGoal,
        sleepGoalHours: userProfile.sleepGoalHours,
        chronotype: userProfile.chronotype,
        activityLevel: userProfile.activityLevel,
        baselineStress: userProfile.baselineStress,
        weeklyTrainingMinutes: userProfile.weeklyTrainingMinutes,
        sportGoal: userProfile.sportGoal,
      },
      mlPrediction: mlPrediction
        ? {
            predictedMood: mlPrediction.predicted_mood,
            confidenceLower: mlPrediction.confidence_lower,
            confidenceUpper: mlPrediction.confidence_upper,
            phaseMode: mlPrediction.phase_mode,
            modelVersion: mlPrediction.model_version,
            topInfluencers: mlPrediction.top_influencers.slice(0, 5).map(inf => ({
              factor: inf.factor,
              impact: +inf.impact.toFixed(3),
              direction: inf.direction,
              featureValue: inf.feature_value,
            })),
          }
        : null,
      anomalyReport: {
        hasCritical: anomalyReport.hasCritical,
        gapDays: anomalyReport.gapDays,
        dataQuality: anomalyReport.dataQuality,
        anomalies: anomalyReport.anomalies.slice(0, 5).map(a => ({
          metric: a.metric,
          type: a.type,
          severity: a.severity,
          date: a.date,
        })),
      },
    }

    return createHash('sha256')
      .update(JSON.stringify(snapshot))
      .digest('hex')
      .slice(0, 20)
  }

  private _sliceHealthDataWindow(healthData: any, days: number) {
    const since = this._sinceDate(days - 1)
    const filterRecords = <T extends { date: string }>(records: T[] = []) =>
      records.filter(record => record.date >= since)

    return {
      ...healthData,
      sleep: filterRecords(healthData.sleep),
      mood: filterRecords(healthData.mood),
      stress: filterRecords(healthData.stress),
      activity: filterRecords(healthData.activity),
      water: filterRecords(healthData.water),
      nutrition: filterRecords(healthData.nutrition),
    }
  }

  private _countUniqueDays(healthData: any): number {
    const dates = new Set<string>()
    const collect = <T extends { date: string }>(records: T[] = []) => {
      for (const record of records) {
        if (record?.date) dates.add(String(record.date).slice(0, 10))
      }
    }

    collect(healthData.sleep)
    collect(healthData.mood)
    collect(healthData.stress)
    collect(healthData.activity)
    collect(healthData.water)
    collect(healthData.nutrition)

    return dates.size
  }

  /**
   * Собирает массив дней (последние ≤7) с парами субъективные/объективные
   * метрики для consistency.evaluate(). Сводит несколько источников в одну
   * запись по дате.
   */
  private _buildConsistencyDays(healthData: any) {
    const byDate = new Map<string, {
      date: string
      sleepHours?: number | null
      sleepQuality?: number | null
      interruptions?: number | null
      mood?: number | null
      stress?: number | null
      activityMinutes?: number | null
    }>()

    const ensure = (date: string) => {
      const key = String(date).slice(0, 10)
      if (!byDate.has(key)) byDate.set(key, { date: key })
      return byDate.get(key)!
    }

    for (const s of healthData.sleep ?? []) {
      const d = ensure(s.date)
      d.sleepHours    = s.duration_hours ?? null
      d.sleepQuality  = s.quality ?? null
      d.interruptions = s.interruptions ?? null
    }
    for (const m of healthData.mood ?? []) {
      const d = ensure(m.date)
      d.mood = m.mood_score ?? null
    }
    for (const s of healthData.stress ?? []) {
      const d = ensure(s.date)
      d.stress = s.level ?? null
    }
    for (const a of healthData.activity ?? []) {
      const d = ensure(a.date)
      d.activityMinutes = (d.activityMinutes ?? 0) + (a.duration_minutes ?? 0)
    }

    return [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date)).slice(-7)
  }

  /**
   * Понижает confidence в trigger_signal у рекомендации, если consistency.service
   * пометил её метрику расхождением с объективными данными. Понижение происходит
   * до уровня 'low' — выше уже проставлен (например, по samples baseline'а).
   */
  private _applyConsistency(
    recommendations: RecommendationDto[],
    consistency: ConsistencySnapshot,
  ): RecommendationDto[] {
    if (!recommendations?.length) return recommendations
    const flags = consistency.flags
    if (!flags || Object.keys(flags).length === 0) return recommendations

    return recommendations.map(rec => {
      // Метрика 'sleep' покрывает обе субъективные подметрики (duration+quality);
      // mood и stress 1:1.
      const flagKey =
        rec.metric === 'sleep' ? 'sleep' :
        rec.metric === 'mood'  ? 'mood'  :
        rec.metric === 'stress'? 'stress': null
      if (!flagKey) return rec

      const flag = flags[flagKey]
      if (!flag) return rec

      const ts = rec.trigger_signal ?? { source: 'rule' as const, metric: rec.metric }
      return {
        ...rec,
        trigger_signal: {
          ...ts,
          // Если в самой метрике есть расхождение с объективкой — снижаем confidence.
          confidence: 'low' as const,
        },
        // Дополнение к описанию, чтобы пользователь видел причину снижения доверия.
        description: rec.description
          + ` (Замечено расхождение в данных: ${flag.reason}.)`,
      }
    })
  }

  /**
   * Присваивает рекомендации стабильный id вида rule_id-YYYY-MM-DD.
   * Для рекомендаций без rule_id — хеш от title+metric (короткий).
   * id нужен для feedback endpoint'а в Wave 4 и для structured-trace.
   */
  private _assignRecommendationIds(
    recommendations: RecommendationDto[],
    today: string,
  ): RecommendationDto[] {
    return recommendations.map(rec => {
      if (rec.id) return rec
      const base = rec.rule_id
        ? `${rec.rule_id}-${today}`
        : `${rec.metric}-${createHash('sha1')
            .update(rec.title + '|' + rec.description.slice(0, 80))
            .digest('hex').slice(0, 10)}-${today}`
      return { ...rec, id: base }
    })
  }

  /**
   * Достаёт metadata-поля модели из ответа ml-service.
   * Если их нет (ml-service ещё не обновлён или fallback) — возвращает null.
   */
  private _extractModelMeta(prediction: MlPredictResponseDto): ModelMetaDto | null {
    const m = (prediction as any)?.model_meta
    if (!m) return null
    return {
      version:             m.version ?? prediction.model_version ?? null,
      samples_used:        m.samples_used ?? null,
      cv_status:           m.cv_status ?? null,
      cv_mae:              m.cv_mae ?? null,
      cv_r2:               m.cv_r2 ?? null,
      baseline_mae:        m.baseline_mae ?? null,
      baseline_r2:         m.baseline_r2 ?? null,
      improvement_mae_pct: m.improvement_mae_pct ?? null,
    }
  }

  private _buildRuleFallbackRecommendations(ruleResults: RuleResult[]): RecommendationDto[] {
    return ruleResults.map(rule => ({
      metric: this._mapRuleCategory(rule.category),
      severity: this._mapRuleSeverity(rule.severity),
      title: rule.title,
      description: `${rule.shortReason} ${rule.suggestion}`.trim(),
    }))
  }

  private _buildFallbackPrediction(userId: string, healthData: any): MlPredictResponseDto {
    const moodRecords = Array.isArray(healthData?.mood) ? healthData.mood.length : 0
    const phase = moodRecords < 14
      ? {
          mode: 'cold_start' as const,
          total_records: moodRecords,
          records_needed: Math.max(0, 14 - moodRecords),
          accuracy_percent: 0,
          message: `Need ${Math.max(0, 14 - moodRecords)} more mood days before model training can start`,
        }
      : moodRecords < 50
        ? {
            mode: 'learning' as const,
            total_records: moodRecords,
            records_needed: Math.max(0, 50 - moodRecords),
            accuracy_percent: 0,
            message: 'ML service temporarily unavailable, using rule-based recommendations',
          }
        : {
            mode: 'personal' as const,
            total_records: moodRecords,
            records_needed: 0,
            accuracy_percent: 0,
            message: 'ML service temporarily unavailable, using rule-based recommendations',
          }

    return {
      user_id: userId,
      phase,
      predicted_mood: null,
      confidence_lower: null,
      confidence_upper: null,
      top_influencers: [],
      recommendations: [],
      model_version: 'rule_based_fallback',
      data_completeness: this._calculateDataCompleteness(healthData, 14),
    }
  }

  private _calculateDataCompleteness(healthData: any, windowDays: number) {
    const since = this._sinceDate(windowDays - 1)
    const percentage = (records: Array<{ date: string }> = []) => {
      const days = new Set(
        records
          .filter(record => record?.date && record.date >= since)
          .map(record => String(record.date).slice(0, 10)),
      )
      return Math.min(100, Math.round((days.size / windowDays) * 100))
    }

    return {
      sleep: percentage(healthData?.sleep),
      mood: percentage(healthData?.mood),
      stress: percentage(healthData?.stress),
      activity: percentage(healthData?.activity),
      nutrition: percentage(healthData?.nutrition),
      water: percentage(healthData?.water),
    }
  }

  private _mapRuleCategory(category: RuleResult['category']): RecommendationDto['metric'] {
    switch (category) {
      case 'nutrition':
        return 'food'
      case 'sleep':
        return 'sleep'
      case 'activity':
        return 'activity'
      case 'stress':
        return 'stress'
      case 'mood':
      default:
        return 'mood'
    }
  }

  private _mapRuleSeverity(severity: RuleResult['severity']): RecommendationDto['severity'] {
    switch (severity) {
      case 'critical':
        return 'alert'
      case 'warning':
        return 'attention'
      case 'info':
      default:
        return 'good'
    }
  }

  private async _buildHealthData(userId: string) {
    const sinceStr = this._sinceDate(this.WINDOW_DAYS)

    const [sleep, mood, stress, activityRaw, waterRaw, nutritionRaw] = await Promise.all([
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
        .select('a.date', 'date')
        // COALESCE: PostgreSQL SUM() возвращает NULL при пустом наборе
        // строк в группе (из-за фильтра caloriesBurned IS NULL и т.п.).
        // Без этого NULL прорастает в metrics-adapter и ломает _nanmean.
        .addSelect('COALESCE(SUM(a.durationMinutes), 0)', 'totalminutes')
        .addSelect('COALESCE(SUM(a.caloriesBurned), 0)', 'totalcalories')
        .addSelect('MAX(a.time)', 'lastactivitytime')
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
        .select('w.date', 'date')
        .addSelect('COALESCE(SUM(w.amountMl), 0)', 'totalml')
        .where('w.userId = :userId', { userId })
        .andWhere('w.date >= :since', { since: sinceStr })
        .groupBy('w.date')
        .orderBy('w.date', 'ASC')
        .getRawMany(),
      this.nutritionRepo.find({
        where: { userId, date: MoreThanOrEqual(sinceStr) },
        order: { date: 'ASC', time: 'ASC' },
      }),
    ])

    return {
      user_id: userId,
      sleep: sleep.map(r => ({
        date: r.date,
        duration_hours: (() => {
          if (r.durationHours != null) return Number(r.durationHours)
          if (r.bedTime && r.wakeTime) {
            const [bh, bm] = r.bedTime.split(':').map(Number)
            const [wh, wm] = r.wakeTime.split(':').map(Number)
            let mins = (wh * 60 + wm) - (bh * 60 + bm)
            if (mins < 0) mins += 24 * 60
            return Math.round((mins / 60) * 10) / 10
          }
          return 7.0
        })(),
        quality: r.quality,
        interruptions: r.interruptions ?? 0,
        bed_time: r.bedTime ?? null,
        wake_time: r.wakeTime ?? null,
      })),
      mood: mood.map(r => ({ date: r.date, mood_score: r.moodScore })),
      stress: stress.map(r => ({ date: r.date, level: r.level })),
      activity: activityRaw.map(r => ({
        date: this._toDateStr(r.date),
        duration_minutes: Number(r.totalminutes),
        intensity: r.intensity,
        calories_burned: Number(r.totalcalories ?? 0),
        time: r.lastactivitytime ?? null,
      })),
      water: waterRaw.map(r => ({
        date: this._toDateStr(r.date),
        amount_ml: Number(r.totalml),
      })),
      nutrition: nutritionRaw.map(r => ({
        date: r.date,
        time: r.time ?? null,
        calories: r.calories,
        protein_grams: Number(r.proteinGrams),
        carbs_grams: Number(r.carbsGrams),
        fat_grams: Number(r.fatGrams),
      })),
    }
  }

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
