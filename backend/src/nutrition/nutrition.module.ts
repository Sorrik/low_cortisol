import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NutritionController } from './nutrition.controller';
import { NutritionService }    from './nutrition.service';
import { NutritionData }       from './nutrition.entity';
import { InsightsModule }      from '../insights/insights.module';  // ← добавить

@Module({
  imports: [
    TypeOrmModule.forFeature([NutritionData]),
    InsightsModule,   // ← добавить
  ],
  controllers: [NutritionController],
  providers: [NutritionService],
})
export class NutritionModule {}
