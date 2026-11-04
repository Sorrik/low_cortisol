// backend/src/insights/insights.module.ts

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { InsightsService }          from './insights.service'
import { InsightsController }       from './insights.controller'
import { CacheInvalidationService } from './cache-invalidation.service'
import { CalorieThresholdsService } from './calorie-thresholds.service'
import { CausalChainService }       from './causal-chain.service'
import { RecommendationRulesService } from './recommendation-rules.service'
import { AnomalyDetectionService } from './anomaly-detection.service'
import { ConsistencyService }      from './consistency.service'
import { MlModule }                 from '../ml/ml.module'
import { LlmModule }                from '../llm/llm.module'

import { SleepData }     from '../sleep/sleep.entity'
import { MoodData }      from '../mood/mood.entity'
import { StressData }    from '../stress/stress.entity'
import { ActivityData }  from '../activity/activity.entity'
import { WaterData }     from '../water/water.entity'
import { NutritionData } from '../nutrition/nutrition.entity'
import { RecommendationFeedback } from './recommendation-feedback.entity'
import { UserProfileModule } from '../user-profile/user-profile.module'
import { GamificationModule } from '../gamification/gamification.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SleepData, MoodData, StressData,
      ActivityData, WaterData, NutritionData,
      RecommendationFeedback,
    ]),
    MlModule,
    LlmModule,
    UserProfileModule,
    GamificationModule,
  ],
  controllers: [InsightsController],
  providers:   [InsightsService, RecommendationRulesService, AnomalyDetectionService, ConsistencyService, CacheInvalidationService, CalorieThresholdsService, CausalChainService],
  exports:    [CacheInvalidationService],
})
export class InsightsModule {}