import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Расширение профиля пользователя для точного расчёта индивидуальных
 * порогов калорий по формуле Mifflin-St Jeor:
 *
 *   - age (INT)            — точный возраст (заменяет приближённый ageRange).
 *   - weight_kg (NUMERIC)  — вес для BMR.
 *   - height_cm (INT)      — рост для BMR.
 *   - nutrition_goal       — направление: дефицит / поддержание / набор массы.
 *
 * Также сужается gender до 'male' | 'female' — значения 'other' и
 * 'prefer_not_to_say' переводятся в NULL, чтобы CHECK-ограничение
 * прошло. Само поле остаётся nullable (пользователь может не указать).
 *
 * Поле age_range НЕ удаляется — оно осталось у старых записей и
 * используется backend-кодом как fallback при отсутствии точного age.
 */
export class ExtendUserProfileBodyMetrics1776800000000 implements MigrationInterface {
    name = 'ExtendUserProfileBodyMetrics1776800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "user_profiles"
                ADD COLUMN IF NOT EXISTS "age"            INTEGER,
                ADD COLUMN IF NOT EXISTS "weight_kg"      NUMERIC(5,2),
                ADD COLUMN IF NOT EXISTS "height_cm"      INTEGER,
                ADD COLUMN IF NOT EXISTS "nutrition_goal" VARCHAR(16)
        `)

        // Перевод старых значений gender в null для подготовки к сужению enum.
        await queryRunner.query(`
            UPDATE "user_profiles"
            SET "gender" = NULL
            WHERE "gender" IN ('other', 'prefer_not_to_say')
        `)

        // Разумные диапазоны для всех новых полей.
        await queryRunner.query(`
            ALTER TABLE "user_profiles"
                ADD CONSTRAINT "CHK_user_profiles_age"
                    CHECK ("age" IS NULL OR ("age" >= 13 AND "age" <= 120))
        `)
        await queryRunner.query(`
            ALTER TABLE "user_profiles"
                ADD CONSTRAINT "CHK_user_profiles_weight_kg"
                    CHECK ("weight_kg" IS NULL OR ("weight_kg" >= 30 AND "weight_kg" <= 300))
        `)
        await queryRunner.query(`
            ALTER TABLE "user_profiles"
                ADD CONSTRAINT "CHK_user_profiles_height_cm"
                    CHECK ("height_cm" IS NULL OR ("height_cm" >= 100 AND "height_cm" <= 250))
        `)
        await queryRunner.query(`
            ALTER TABLE "user_profiles"
                ADD CONSTRAINT "CHK_user_profiles_nutrition_goal"
                    CHECK ("nutrition_goal" IS NULL OR "nutrition_goal" IN ('lose_weight', 'maintain', 'muscle_gain'))
        `)
        await queryRunner.query(`
            ALTER TABLE "user_profiles"
                ADD CONSTRAINT "CHK_user_profiles_gender"
                    CHECK ("gender" IS NULL OR "gender" IN ('male', 'female'))
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP CONSTRAINT IF EXISTS "CHK_user_profiles_gender"`)
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP CONSTRAINT IF EXISTS "CHK_user_profiles_nutrition_goal"`)
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP CONSTRAINT IF EXISTS "CHK_user_profiles_height_cm"`)
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP CONSTRAINT IF EXISTS "CHK_user_profiles_weight_kg"`)
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP CONSTRAINT IF EXISTS "CHK_user_profiles_age"`)
        await queryRunner.query(`
            ALTER TABLE "user_profiles"
                DROP COLUMN IF EXISTS "nutrition_goal",
                DROP COLUMN IF EXISTS "height_cm",
                DROP COLUMN IF EXISTS "weight_kg",
                DROP COLUMN IF EXISTS "age"
        `)
    }
}
