import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StressController } from './stress.controller';
import { StressService }    from './stress.service';
import { StressData }       from './stress.entity';
import { InsightsModule }   from '../insights/insights.module';  // ← добавить

@Module({
  imports: [
    TypeOrmModule.forFeature([StressData]),
    InsightsModule,   // ← добавить
  ],
  controllers: [StressController],
  providers: [StressService],
})
export class StressModule {}
