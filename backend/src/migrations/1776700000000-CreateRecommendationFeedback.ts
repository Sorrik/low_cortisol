import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateRecommendationFeedback1776700000000 implements MigrationInterface {
    name = 'CreateRecommendationFeedback1776700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "recommendation_feedback" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "rule_id" character varying(64) NOT NULL,
                "rating" character varying(16) NOT NULL,
                "comment" text,
                "recommendation_snapshot" jsonb,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_recommendation_feedback" PRIMARY KEY ("id"),
                CONSTRAINT "FK_recommendation_feedback_user"
                    FOREIGN KEY ("user_id")
                    REFERENCES "users"("id")
                    ON DELETE CASCADE,
                CONSTRAINT "CHK_feedback_rating"
                    CHECK ("rating" IN ('helpful', 'not_helpful'))
            )
        `)

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_feedback_user_rule"
            ON "recommendation_feedback" ("user_id", "rule_id")
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_feedback_user_created"
            ON "recommendation_feedback" ("user_id", "created_at" DESC)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_feedback_user_created"`)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_feedback_user_rule"`)
        await queryRunner.query(`DROP TABLE IF EXISTS "recommendation_feedback"`)
    }
}
