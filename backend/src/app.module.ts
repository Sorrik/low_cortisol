import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

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
import { GamificationModule } from './gamification/gamification.module'
import { CacheInvalidationModule } from './insights/cache-invalidation.module'

import { User }          from './users/user.entity';
import { SleepData }     from './sleep/sleep.entity';
import { MoodData }      from './mood/mood.entity';
import { NutritionData } from './nutrition/nutrition.entity';
import { ActivityData }  from './activity/activity.entity';
import { WaterData }     from './water/water.entity';
import { StressData }    from './stress/stress.entity';
import { UserProfileModule } from './user-profile/user-profile.module'
import { AiModule } from './ai/ai.module'
@Module({
  imports: [
    // ── 1. Config — первым, все остальные модули читают .env
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // ── 1b. Pino logger — структурированный JSON в prod, pretty в dev.
    //       Прокидывает correlation id (x-request-id или сгенерированный)
    //       во все лог-события внутри запроса.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        genReqId: (req: IncomingMessage, res: ServerResponse) => {
          const existing = req.headers['x-request-id'];
          const id = (Array.isArray(existing) ? existing[0] : existing) || randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        customProps: (req: IncomingMessage) => ({
          requestId: (req as IncomingMessage & { id?: string }).id,
        }),
        autoLogging: {
          ignore: (req: IncomingMessage) => req.url === '/health' || req.url === '/favicon.ico',
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.refresh_token',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTED]',
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' } }
            : undefined,
      },
    }),

    // ── 2. Cache — глобальный, доступен везде
    CacheModule.register({
      isGlobal: true,
      ttl: 60 * 60,   // 1 час по умолчанию
      max: 500,        // максимум 500 записей в памяти
    }),

    // ── 2b. Rate limiting — защита от brute-force на /auth/* и от спама API
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },     // 10 req / 1s burst
      { name: 'medium', ttl: 60_000, limit: 120 },  // 120 req / 1min
      { name: 'long', ttl: 3_600_000, limit: 2000 },// 2000 req / 1h
    ]),

    // ── 3. Database
    // Схема создаётся миграциями при старте, поэтому новая БД готова без ручных шагов.
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
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      migrationsRun: true,
      synchronize: false,
      autoLoadEntities: true,
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
    UserProfileModule,
    GamificationModule,
    CacheInvalidationModule,

    // ── 5. ML + Insights
    MlModule,
    InsightsModule,

    // ── 6. AI (voice → form, food vision)
    AiModule,
  ],
  providers: [
    { provide: APP_GUARD,  useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
