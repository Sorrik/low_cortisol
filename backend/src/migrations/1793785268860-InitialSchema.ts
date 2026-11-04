import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1793785268860 implements MigrationInterface {
    name = 'InitialSchema1793785268860'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "first_name" character varying NOT NULL, "last_name" character varying NOT NULL, "date_of_birth" date, "is_active" boolean NOT NULL DEFAULT true, "refresh_token_hash" character varying(100), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "waterdata" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userid" uuid NOT NULL, "date" date NOT NULL, "time" TIME NOT NULL, "amountMl" integer NOT NULL, "createdat" TIMESTAMP NOT NULL DEFAULT now(), "updatedat" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6afab6f49cc6fefba29e300bfd5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_water_user_date" ON "waterdata" ("userid", "date") `);
        await queryRunner.query(`CREATE TABLE "stressdata" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userid" uuid NOT NULL, "date" date NOT NULL, "time" TIME NOT NULL, "level" integer NOT NULL, "cause" character varying(500), "copingStrategy" character varying(500), "createdat" TIMESTAMP NOT NULL DEFAULT now(), "updatedat" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b4f087fa249b603c5a4807a10b4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_stress_user_date" ON "stressdata" ("userid", "date") `);
        await queryRunner.query(`CREATE TABLE "user_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "age" integer, "weight_kg" numeric(5,2), "height_cm" integer, "age_range" character varying, "gender" character varying, "name" character varying, "nutrition_goal" character varying, "goals" text, "primary_goal" character varying, "chronotype" character varying, "sleep_goal_hours" double precision DEFAULT '8', "activity_level" character varying, "sport_types" text, "workouts_per_week" integer, "avg_workout_duration_min" integer, "sport_goal" character varying, "baseline_stress" integer, "onboarding_completed" boolean NOT NULL DEFAULT false, "onboarding_completed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6ca9503d77ae39b4b5a6cc3ba88" UNIQUE ("user_id"), CONSTRAINT "REL_6ca9503d77ae39b4b5a6cc3ba8" UNIQUE ("user_id"), CONSTRAINT "PK_1ec6662219f4605723f1e41b6cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sleepdata" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userid" uuid NOT NULL, "date" date NOT NULL, "bedtime" TIME NOT NULL, "waketime" TIME NOT NULL, "durationhours" numeric(4,2), "quality" integer NOT NULL, "interruptions" integer NOT NULL DEFAULT '0', "notes" text, "createdat" TIMESTAMP NOT NULL DEFAULT now(), "updatedat" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uq_sleep_user_date" UNIQUE ("userid", "date"), CONSTRAINT "PK_f37d9ade81b8f0affe67fd60971" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_sleep_user_date" ON "sleepdata" ("userid", "date") `);
        await queryRunner.query(`CREATE TABLE "nutritiondata" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userid" uuid NOT NULL, "date" date NOT NULL, "time" TIME NOT NULL, "mealType" character varying NOT NULL, "description" character varying NOT NULL, "calories" integer NOT NULL, "proteinGrams" numeric(10,2) NOT NULL, "carbsGrams" numeric(10,2) NOT NULL, "fatGrams" numeric(10,2) NOT NULL, "createdat" TIMESTAMP NOT NULL DEFAULT now(), "updatedat" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_52782d885bc1b2f788ac317bfc5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_nutrition_user_date" ON "nutritiondata" ("userid", "date") `);
        await queryRunner.query(`CREATE TABLE "foods" ("id" SERIAL NOT NULL, "name_ru" character varying NOT NULL, "name_en" character varying, "category" character varying NOT NULL, "kcal" integer NOT NULL, "protein" numeric(10,1) NOT NULL, "fat" numeric(10,1) NOT NULL, "carbs" numeric(10,1) NOT NULL, "barcode" character varying, CONSTRAINT "PK_0cc83421325632f61fa27a52b59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e7f3c1609f0f32675bc9dbbe1a" ON "foods" ("name_ru") `);
        await queryRunner.query(`CREATE TABLE "mooddata" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userid" uuid NOT NULL, "date" date NOT NULL, "time" TIME NOT NULL, "moodScore" integer NOT NULL, "emotions" text, "triggers" text, "notes" text, "createdat" TIMESTAMP NOT NULL DEFAULT now(), "updatedat" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uq_mood_user_date" UNIQUE ("userid", "date"), CONSTRAINT "PK_68c5d640439d0f54ac09cd4e29a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_mood_user_date" ON "mooddata" ("userid", "date") `);
        await queryRunner.query(`CREATE TABLE "recommendation_feedback" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "rule_id" character varying(64) NOT NULL, "rating" character varying(16) NOT NULL, "comment" text, "recommendation_snapshot" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8b0066e79db890dcd464a7f4a31" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_feedback_user_created" ON "recommendation_feedback" ("user_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_feedback_user_rule" ON "recommendation_feedback" ("user_id", "rule_id") `);
        await queryRunner.query(`CREATE TABLE "user_gamification" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "streak_any_current" integer NOT NULL DEFAULT '0', "streak_any_longest" integer NOT NULL DEFAULT '0', "streak_full_current" integer NOT NULL DEFAULT '0', "streak_full_longest" integer NOT NULL DEFAULT '0', "streak_norm_current" integer NOT NULL DEFAULT '0', "streak_norm_longest" integer NOT NULL DEFAULT '0', "last_entry_date" date, "last_full_date" date, "last_norm_date" date, "streak_freeze_used" boolean NOT NULL DEFAULT false, "total_points" integer NOT NULL DEFAULT '0', "level" integer NOT NULL DEFAULT '1', "level_name" character varying NOT NULL DEFAULT 'Новичок', "badges" text NOT NULL DEFAULT '[]', "badge_dates" text NOT NULL DEFAULT '{}', "total_entries" integer NOT NULL DEFAULT '0', "calm_days_streak" integer NOT NULL DEFAULT '0', "good_sleep_streak" integer NOT NULL DEFAULT '0', "mood_rising_days" integer NOT NULL DEFAULT '0', "hydration_days_streak" integer NOT NULL DEFAULT '0', "anomalies_survived" integer NOT NULL DEFAULT '0', "prev_avg_sleep" double precision, "prev_avg_mood" double precision, "prev_avg_activity" double precision, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_dbbacb32749a0f1b1639e1f6c1d" UNIQUE ("user_id"), CONSTRAINT "REL_dbbacb32749a0f1b1639e1f6c1" UNIQUE ("user_id"), CONSTRAINT "PK_db92d24015cda11113d1a3cad80" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dbbacb32749a0f1b1639e1f6c1" ON "user_gamification" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "activitydata" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userid" uuid NOT NULL, "date" date NOT NULL, "time" TIME, "type" character varying(20) NOT NULL, "durationMinutes" integer NOT NULL, "intensity" character varying(20) NOT NULL, "caloriesBurned" integer, "steps" integer, "notes" text, "createdat" TIMESTAMP NOT NULL DEFAULT now(), "updatedat" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fef5a2cfa1e46e919d1af63704b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_activity_user_date" ON "activitydata" ("userid", "date") `);
        await queryRunner.query(`ALTER TABLE "waterdata" ADD CONSTRAINT "FK_0c7b2e0397289f4994ddaf9b660" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stressdata" ADD CONSTRAINT "FK_7b6a267ba49649ee534f6c502e2" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_profiles" ADD CONSTRAINT "FK_6ca9503d77ae39b4b5a6cc3ba88" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sleepdata" ADD CONSTRAINT "FK_ff5728899ceb233f85562681a90" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "nutritiondata" ADD CONSTRAINT "FK_24c99f673ba6db2e28305f2af43" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mooddata" ADD CONSTRAINT "FK_7daa5c62cfb2deab41151dca390" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "FK_805cda9788ff43c54bcd0013c99" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_gamification" ADD CONSTRAINT "FK_dbbacb32749a0f1b1639e1f6c1d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "activitydata" ADD CONSTRAINT "FK_60411d813d8979d7e4d4e3b6ae1" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "activitydata" DROP CONSTRAINT "FK_60411d813d8979d7e4d4e3b6ae1"`);
        await queryRunner.query(`ALTER TABLE "user_gamification" DROP CONSTRAINT "FK_dbbacb32749a0f1b1639e1f6c1d"`);
        await queryRunner.query(`ALTER TABLE "recommendation_feedback" DROP CONSTRAINT "FK_805cda9788ff43c54bcd0013c99"`);
        await queryRunner.query(`ALTER TABLE "mooddata" DROP CONSTRAINT "FK_7daa5c62cfb2deab41151dca390"`);
        await queryRunner.query(`ALTER TABLE "nutritiondata" DROP CONSTRAINT "FK_24c99f673ba6db2e28305f2af43"`);
        await queryRunner.query(`ALTER TABLE "sleepdata" DROP CONSTRAINT "FK_ff5728899ceb233f85562681a90"`);
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP CONSTRAINT "FK_6ca9503d77ae39b4b5a6cc3ba88"`);
        await queryRunner.query(`ALTER TABLE "stressdata" DROP CONSTRAINT "FK_7b6a267ba49649ee534f6c502e2"`);
        await queryRunner.query(`ALTER TABLE "waterdata" DROP CONSTRAINT "FK_0c7b2e0397289f4994ddaf9b660"`);
        await queryRunner.query(`DROP INDEX "public"."idx_activity_user_date"`);
        await queryRunner.query(`DROP TABLE "activitydata"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dbbacb32749a0f1b1639e1f6c1"`);
        await queryRunner.query(`DROP TABLE "user_gamification"`);
        await queryRunner.query(`DROP INDEX "public"."idx_feedback_user_rule"`);
        await queryRunner.query(`DROP INDEX "public"."idx_feedback_user_created"`);
        await queryRunner.query(`DROP TABLE "recommendation_feedback"`);
        await queryRunner.query(`DROP INDEX "public"."idx_mood_user_date"`);
        await queryRunner.query(`DROP TABLE "mooddata"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e7f3c1609f0f32675bc9dbbe1a"`);
        await queryRunner.query(`DROP TABLE "foods"`);
        await queryRunner.query(`DROP INDEX "public"."idx_nutrition_user_date"`);
        await queryRunner.query(`DROP TABLE "nutritiondata"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sleep_user_date"`);
        await queryRunner.query(`DROP TABLE "sleepdata"`);
        await queryRunner.query(`DROP TABLE "user_profiles"`);
        await queryRunner.query(`DROP INDEX "public"."idx_stress_user_date"`);
        await queryRunner.query(`DROP TABLE "stressdata"`);
        await queryRunner.query(`DROP INDEX "public"."idx_water_user_date"`);
        await queryRunner.query(`DROP TABLE "waterdata"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
