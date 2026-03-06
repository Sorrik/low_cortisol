import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WaterController } from './water.controller';
import { WaterService }    from './water.service';
import { WaterData }       from './water.entity';
import { InsightsModule }  from '../insights/insights.module';  // ← добавить

@Module({
  imports: [
    TypeOrmModule.forFeature([WaterData]),
    InsightsModule,   // ← добавить
  ],
  controllers: [WaterController],
  providers: [WaterService],
})
export class WaterModule {}
