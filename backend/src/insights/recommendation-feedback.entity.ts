// backend/src/insights/recommendation-feedback.entity.ts
//
// Хранит обратную связь пользователя по конкретным правилам/рекомендациям.
// Используется для:
//   • анализа точности правил (сколько helpful vs not_helpful по rule_id),
//   • дообучения LLM-промпта на негативных кейсах,
//   • расследования инцидентов (какая рекомендация была выдана и оценена).
//
// Текст рекомендации не дублируется в каждой записи — вместо этого хранится
// snapshot (jsonb) с минимально необходимыми полями: ruleId, severity,
// metricValue, threshold, заголовок. Это даёт reproducibility без излишнего
// разрастания таблицы.

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { User } from '../users/user.entity'

export type FeedbackRating = 'helpful' | 'not_helpful'

@Entity('recommendation_feedback')
@Index('idx_feedback_user_rule', ['userId', 'ruleId'])
@Index('idx_feedback_user_created', ['userId', 'createdAt'])
export class RecommendationFeedback {

  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id' })
  userId!: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User

  /**
   * Стабильный идентификатор правила или LLM-рекомендации:
   *   • правила: 'nutrition.calorie_deficit', 'sleep.short_sleep' и т.п.
   *   • LLM:    'llm.<hash>' — короткий идентификатор сгенерированного текста.
   */
  @Column({ name: 'rule_id', type: 'varchar', length: 64 })
  ruleId!: string

  @Column({ type: 'varchar', length: 16 })
  rating!: FeedbackRating

  @Column({ type: 'text', nullable: true })
  comment!: string | null

  /**
   * Снимок рекомендации в момент оценки. Тип intentionally any —
   * UI шлёт DTO рекомендации как есть, схема может эволюционировать.
   */
  @Column({ name: 'recommendation_snapshot', type: 'jsonb', nullable: true })
  recommendationSnapshot!: Record<string, unknown> | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
