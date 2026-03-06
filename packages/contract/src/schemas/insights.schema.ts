// packages/contract/src/schemas/insights.schema.ts
import { z } from 'zod';

export const RecommendationSchema = z.object({
  metric:      z.enum(['sleep', 'food', 'mood', 'stress', 'activity', 'water']),
  severity:    z.enum(['good', 'attention', 'alert']),
  title:       z.string(),
  description: z.string(),
});

export const InsightsSchema = z.object({
  user_id:           z.string(),
  phase:             z.object({
    mode:             z.enum(['cold_start', 'learning', 'personal']),
    total_records:    z.number(),
    records_needed:   z.number(),
    accuracy_percent: z.number(),
    message:          z.string(),
  }),
  predicted_mood:    z.number().nullable(),
  confidence_lower:  z.number().nullable(),
  confidence_upper:  z.number().nullable(),
  top_influencers:   z.array(z.object({
    factor:        z.string(),
    impact:        z.number(),
    raw_shap:      z.number().nullable(),
    direction:     z.enum(['positive', 'negative']),
    description:   z.string(),
    feature_value: z.number().nullable(),
  })),
  recommendations:   z.array(RecommendationSchema),
  model_version:     z.string(),
  data_completeness: z.object({
    sleep:     z.number(),
    mood:      z.number(),
    stress:    z.number(),
    activity:  z.number(),
    nutrition: z.number(),
    water:     z.number(),
  }),
});