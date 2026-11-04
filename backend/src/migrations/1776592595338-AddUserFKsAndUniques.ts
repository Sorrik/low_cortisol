import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserFKsAndUniques1776592595338 implements MigrationInterface {
    name = 'AddUserFKsAndUniques1776592595338'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1) users: добавляем refresh_token_hash (nullable, без бэкофиллинга — сессии обновятся при следующем логине)
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refresh_token_hash" character varying(100)`);

        // 2) Снять старый FK у user_profiles, чтобы пересоздать с ON DELETE CASCADE
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP CONSTRAINT IF EXISTS "FK_6ca9503d77ae39b4b5a6cc3ba88"`);

        // 3) Поменять тип userid/user_id с varchar на uuid, сохраняя данные через USING ::uuid.
        //    Все существующие значения обязаны быть валидными UUID — раньше это просто varchar с uuid-ами внутри.
        const metricTables: Array<[string, string]> = [
            ['sleepdata',    'userid'],
            ['mooddata',     'userid'],
            ['stressdata',   'userid'],
            ['activitydata', 'userid'],
            ['waterdata',    'userid'],
            ['nutritiondata','userid'],
        ];
        for (const [tbl, col] of metricTables) {
            await queryRunner.query(
                `ALTER TABLE "${tbl}" ALTER COLUMN "${col}" TYPE uuid USING "${col}"::uuid`
            );
            await queryRunner.query(`ALTER TABLE "${tbl}" ALTER COLUMN "${col}" SET NOT NULL`);
        }
        await queryRunner.query(
            `ALTER TABLE "user_gamification" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid`
        );
        await queryRunner.query(`ALTER TABLE "user_gamification" ALTER COLUMN "user_id" SET NOT NULL`);

        // 4) Индексы (idempotent)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sleep_user_date"     ON "sleepdata"     ("userid", "date")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_mood_user_date"      ON "mooddata"      ("userid", "date")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_stress_user_date"    ON "stressdata"    ("userid", "date")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_activity_user_date"  ON "activitydata"  ("userid", "date")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_water_user_date"     ON "waterdata"     ("userid", "date")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_nutrition_user_date" ON "nutritiondata" ("userid", "date")`);

        // 5) Unique constraints — требует отсутствия дублей. Если дубли есть, миграция упадёт:
        //    в этом случае руками: DELETE FROM mooddata a USING mooddata b WHERE a.id > b.id AND a.userid = b.userid AND a.date = b.date;
        await queryRunner.query(`ALTER TABLE "sleepdata" ADD CONSTRAINT "uq_sleep_user_date" UNIQUE ("userid", "date")`);
        await queryRunner.query(`ALTER TABLE "mooddata"  ADD CONSTRAINT "uq_mood_user_date"  UNIQUE ("userid", "date")`);

        // 6) FK с ON DELETE CASCADE
        await queryRunner.query(`ALTER TABLE "user_profiles"    ADD CONSTRAINT "FK_user_profiles_user_id"    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_gamification" ADD CONSTRAINT "FK_user_gamification_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sleepdata"     ADD CONSTRAINT "FK_sleepdata_userid"     FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mooddata"      ADD CONSTRAINT "FK_mooddata_userid"      FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stressdata"    ADD CONSTRAINT "FK_stressdata_userid"    FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "activitydata"  ADD CONSTRAINT "FK_activitydata_userid"  FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "waterdata"     ADD CONSTRAINT "FK_waterdata_userid"     FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "nutritiondata" ADD CONSTRAINT "FK_nutritiondata_userid" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "nutritiondata" DROP CONSTRAINT IF EXISTS "FK_nutritiondata_userid"`);
        await queryRunner.query(`ALTER TABLE "waterdata"     DROP CONSTRAINT IF EXISTS "FK_waterdata_userid"`);
        await queryRunner.query(`ALTER TABLE "activitydata"  DROP CONSTRAINT IF EXISTS "FK_activitydata_userid"`);
        await queryRunner.query(`ALTER TABLE "stressdata"    DROP CONSTRAINT IF EXISTS "FK_stressdata_userid"`);
        await queryRunner.query(`ALTER TABLE "mooddata"      DROP CONSTRAINT IF EXISTS "FK_mooddata_userid"`);
        await queryRunner.query(`ALTER TABLE "sleepdata"     DROP CONSTRAINT IF EXISTS "FK_sleepdata_userid"`);
        await queryRunner.query(`ALTER TABLE "user_gamification" DROP CONSTRAINT IF EXISTS "FK_user_gamification_user_id"`);
        await queryRunner.query(`ALTER TABLE "user_profiles"    DROP CONSTRAINT IF EXISTS "FK_user_profiles_user_id"`);

        await queryRunner.query(`ALTER TABLE "mooddata"  DROP CONSTRAINT IF EXISTS "uq_mood_user_date"`);
        await queryRunner.query(`ALTER TABLE "sleepdata" DROP CONSTRAINT IF EXISTS "uq_sleep_user_date"`);

        const metricTables: Array<[string, string]> = [
            ['nutritiondata','userid'],
            ['waterdata',    'userid'],
            ['activitydata', 'userid'],
            ['stressdata',   'userid'],
            ['mooddata',     'userid'],
            ['sleepdata',    'userid'],
        ];
        for (const [tbl, col] of metricTables) {
            await queryRunner.query(`ALTER TABLE "${tbl}" ALTER COLUMN "${col}" TYPE character varying USING "${col}"::text`);
        }
        await queryRunner.query(`ALTER TABLE "user_gamification" ALTER COLUMN "user_id" TYPE character varying USING "user_id"::text`);

        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "refresh_token_hash"`);

        // Восстанавливаем старый FK без CASCADE
        await queryRunner.query(`ALTER TABLE "user_profiles" ADD CONSTRAINT "FK_6ca9503d77ae39b4b5a6cc3ba88" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }
}
