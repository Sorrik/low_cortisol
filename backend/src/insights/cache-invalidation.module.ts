import { Global, Module }    from '@nestjs/common'
import { TypeOrmModule }     from '@nestjs/typeorm'
import { GamificationModule } from '../gamification/gamification.module'
import { CacheInvalidationService } from './cache-invalidation.service'
import { SleepData }     from '../sleep/sleep.entity'
import { StressData }    from '../stress/stress.entity'
import { MoodData }      from '../mood/mood.entity'
import { ActivityData }  from '../activity/activity.entity'
import { WaterData }     from '../water/water.entity'
import { NutritionData } from '../nutrition/nutrition.entity'

@Global()
@Module({
  imports: [
    GamificationModule,
    TypeOrmModule.forFeature([
      SleepData, StressData, MoodData,
      ActivityData, WaterData, NutritionData,
    ]),
  ],
  providers: [CacheInvalidationService],
  exports:   [CacheInvalidationService],
})
export class CacheInvalidationModule {}