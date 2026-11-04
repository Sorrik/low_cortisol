import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MoodController } from './mood.controller';
import { MoodService }    from './mood.service';
import { MoodData }       from './mood.entity';
import { InsightsModule } from '../insights/insights.module';  // ← добавить

@Module({
  imports: [
    TypeOrmModule.forFeature([MoodData]),
    InsightsModule,   // ← добавить
  ],
  controllers: [MoodController],
  providers: [MoodService],
})
export class MoodModule {}
