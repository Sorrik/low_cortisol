// packages/contract/src/schemas/insights.schema.ts
import { z } from 'zod';

export const RecommendationSchema = z.object({
  metric:      z.enum(['sleep', 'food', 'mood', 'stress', 'activity', 'water']),
  severity:    z.enum(['good', 'attention', 'alert']),
  title:       z.string(),
  description: z.string(),
});

export const ArticleSourceSchema = z.object({
  index: z.number(),
  pmid:  z.string(),
  title: z.string(),
  year:  z.string(),
  url:   z.string(),
});

export const AnomalySchema = z.object({
  metric:       z.enum(['sleep', 'stress', 'mood', 'activity', 'water', 'nutrition']),
  type:         z.enum(['spike', 'drop', 'trend', 'gap']),
  severity:     z.enum(['warning', 'critical']),
  value:        z.number().nullable(),
  norm:         z.number().nullable(),
  deviation:    z.number().nullable(),
  message:      z.string(),
  date:         z.string(),
  daysAffected: z.number().optional(),
});

export const AnomalyReportSchema = z.object({
  hasAnomalies: z.boolean(),
  hasCritical:  z.boolean(),
  anomalies:    z.array(AnomalySchema),
  gapDays:      z.number(),
  dataQuality:  z.number(),
  message:      z.string().nullable(),
});

export const RuleRecommendationSchema = z.object({
  ruleId:        z.string(),
  category:      z.enum(['nutrition', 'sleep', 'activity', 'stress', 'mood']),
  severity:      z.enum(['critical', 'warning', 'info']),
  title:         z.string(),
  shortReason:   z.string(),
  suggestion:    z.string(),
  priority:      z.number(),
  metricValue:   z.number(),
  threshold:     z.number(),
  deltaFromNorm: z.number(),
  tags:          z.array(z.string()),
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
  mlRecommendations: z.array(RecommendationSchema).optional(),
  sources:           z.array(ArticleSourceSchema).optional(),
  ruleRecommendations: z.array(RuleRecommendationSchema),
  hasCriticalAlerts: z.boolean(),
  anomalyReport:     AnomalyReportSchema.optional(),
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
