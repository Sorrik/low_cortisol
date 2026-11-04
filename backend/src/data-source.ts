// backend/src/data-source.ts
// DataSource для typeorm-ts-node-commonjs CLI (migration:generate / migration:run).
// Рантайм Nest использует свой TypeOrmModule.forRoot() в app.module.ts;
// здесь — только CLI.

import 'reflect-metadata';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import { User }            from './users/user.entity';
import { UserProfile }     from './user-profile/user-profile.entity';
import { UserGamification } from './gamification/gamification.entity';
import { SleepData }       from './sleep/sleep.entity';
import { MoodData }        from './mood/mood.entity';
import { StressData }      from './stress/stress.entity';
import { ActivityData }    from './activity/activity.entity';
import { WaterData }       from './water/water.entity';
import { NutritionData }   from './nutrition/nutrition.entity';

// CLI может запускаться из разных CWD (корень монорепо, backend/).
// Пробуем backend/.env, затем корневой .env, затем полагаемся на process.env.
const backendDir = path.resolve(__dirname, '..');
const repoRoot   = path.resolve(backendDir, '..');
loadEnv({ path: path.join(backendDir, '.env') });
loadEnv({ path: path.join(repoRoot, '.env') });

// Если DATABASE_URL не задан явно — собираем из DB_USER/DB_PASSWORD/DB_NAME
// (как это делает docker-compose.yml). CLI работает локально → host=localhost.
const databaseUrl =
  process.env.DATABASE_URL ??
  (process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME
    ? `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? '5432'}/${process.env.DB_NAME}`
    : null);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required (or DB_USER + DB_PASSWORD + DB_NAME). ' +
      'Set them in backend/.env or root .env.',
  );
}

// Debug line — полезно для первичной настройки миграций.
// Маскируем пароль.
// eslint-disable-next-line no-console
console.log('[data-source] connecting to:', databaseUrl.replace(/:([^:@]+)@/, ':***@'));

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  synchronize: false,
  logging: false,
  entities: [
    User,
    UserProfile,
    UserGamification,
    SleepData,
    MoodData,
    StressData,
    ActivityData,
    WaterData,
    NutritionData,
  ],
  migrations: ['src/migrations/*.ts'],
});
