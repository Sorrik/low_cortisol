import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActivityController } from './activity.controller';
import { ActivityService }    from './activity.service';
import { ActivityData }       from './activity.entity';
import { InsightsModule }     from '../insights/insights.module';  // ← добавить

@Module({
  imports: [
    TypeOrmModule.forFeature([ActivityData]),
    InsightsModule,   // ← добавить
  ],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
