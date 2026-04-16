// backend/src/nutrition/nutrition.module.ts

import { Module }        from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { NutritionController } from './nutrition.controller'
import { NutritionService }    from './nutrition.service'
import { FatSecretService }    from './fatsecret.service'
import { Food }                from './food.entity'
import { FoodSearchService }   from './food-search.service'
import { NutritionData }       from './nutrition.entity'
import { InsightsModule }      from '../insights/insights.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([NutritionData, Food]),
    InsightsModule,
  ],
  controllers: [NutritionController],
  providers:   [NutritionService, FatSecretService, FoodSearchService],
})
export class NutritionModule {}