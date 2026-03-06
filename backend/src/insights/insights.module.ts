// backend/src/insights/insights.module.ts

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { InsightsService }          from './insights.service'
import { InsightsController }       from './insights.controller'
import { CacheInvalidationService } from './cache-invalidation.service'
import { MlModule }                 from '../ml/ml.module'
import { LlmModule }                from '../llm/llm.module'   // ← новый

import { SleepData }     from '../sleep/sleep.entity'
import { MoodData }      from '../mood/mood.entity'
import { StressData }    from '../stress/stress.entity'
import { ActivityData }  from '../activity/activity.entity'
import { WaterData }     from '../water/water.entity'
import { NutritionData } from '../nutrition/nutrition.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SleepData,
      MoodData,
      StressData,
      ActivityData,
      WaterData,
      NutritionData,
    ]),
    MlModule,
    LlmModule,  // ← добавили
  ],
  controllers: [InsightsController],
  providers:   [InsightsService, CacheInvalidationService],
  exports:     [CacheInvalidationService],
})
export class InsightsModule {}