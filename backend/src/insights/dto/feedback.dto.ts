// backend/src/insights/dto/feedback.dto.ts

import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

import type { FeedbackRating } from '../recommendation-feedback.entity'

export class CreateFeedbackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  ruleId!: string

  @IsString()
  @IsIn(['helpful', 'not_helpful'])
  rating!: FeedbackRating

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string

  /**
   * Снимок DTO рекомендации, которую оценивали — тот же объект, что
   * приходит на UI в ruleRecommendations[]. Используется для аналитики.
   * Без строгой схемы: UI может эволюционировать быстрее, чем backend.
   */
  @IsOptional()
  @IsObject()
  recommendationSnapshot?: Record<string, unknown>
}

export interface FeedbackResponseDto {
  id: string
  createdAt: string
}
