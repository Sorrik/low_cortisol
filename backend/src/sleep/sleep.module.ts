import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SleepService }    from './sleep.service';
import { SleepController } from './sleep.controller';
import { SleepData }       from './sleep.entity';
import { InsightsModule }  from '../insights/insights.module';  // ← добавить

@Module({
  imports: [
    TypeOrmModule.forFeature([SleepData]),
    InsightsModule,   // ← даёт доступ к CacheInvalidationService
  ],
  controllers: [SleepController],
  providers: [SleepService],
})
export class SleepModule {}
