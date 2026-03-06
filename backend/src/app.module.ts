import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager'; 

import { AuthModule }      from './auth/auth.module';
import { UsersModule }     from './users/users.module';
import { SleepModule }     from './sleep/sleep.module';
import { MoodModule }      from './mood/mood.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { ActivityModule }  from './activity/activity.module';
import { WaterModule }     from './water/water.module';
import { StressModule }    from './stress/stress.module';
import { MlModule }        from './ml/ml.module';
import { InsightsModule }  from './insights/insights.module'; 

import { User }          from './users/user.entity';
import { SleepData }     from './sleep/sleep.entity';
import { MoodData }      from './mood/mood.entity';
import { NutritionData } from './nutrition/nutrition.entity';
import { ActivityData }  from './activity/activity.entity';
import { WaterData }     from './water/water.entity';
import { StressData }    from './stress/stress.entity';

@Module({
  imports: [
    // ── 1. Config — первым, все остальные модули читают .env
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // ── 2. Cache — глобальный, доступен везде
    CacheModule.register({
      isGlobal: true,
      ttl: 60 * 60,   // 1 час по умолчанию
      max: 500,        // максимум 500 записей в памяти
    }),

    // ── 3. Database
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [
        User,
        SleepData,
        MoodData,
        NutritionData,
        ActivityData,
        WaterData,
        StressData,
      ],
      synchronize: true,
    }),

    // ── 4. Feature modules
    AuthModule,
    UsersModule,
    SleepModule,
    MoodModule,
    NutritionModule,
    ActivityModule,
    WaterModule,
    StressModule,

    // ── 5. ML + Insights
    MlModule,
    InsightsModule,
  ],
})
export class AppModule {}
