// packages/contract/src/schemas/insights.schema.ts
import { z } from 'zod';

/**
 * trigger_signal — структурированное «почему именно эта рекомендация».
 * Все поля кроме source опциональные: легаси-правила без разметки несут
 * только source='fallback'/'llm', свежие dual-axis правила и SHAP-канал
 * заполняют current_value/personal_baseline/z_score/confidence.
 */
export const TriggerSignalSchema = z.object({
  source:            z.enum(['rule', 'ml_shap', 'llm', 'consistency', 'fallback']),
  metric:            z.enum(['sleep', 'food', 'mood', 'stress', 'activity', 'water']).nullish(),
  current_value:     z.number().nullish(),
  personal_baseline: z.number().nullish(),
  z_score:           z.number().nullish(),
  delta_7d:          z.number().nullish(),
  shap_contribution: z.number().nullish(),
  confidence:        z.enum(['low', 'medium', 'high']).nullish(),
});

export const RecommendationSchema = z.object({
  id:             z.string().optional(),
  metric:         z.enum(['sleep', 'food', 'mood', 'stress', 'activity', 'water']),
  severity:       z.enum(['good', 'attention', 'alert']),
  title:          z.string(),
  description:    z.string(),
  rule_id:        z.string().nullish(),
  trigger_signal: TriggerSignalSchema.nullish(),
});

/**
 * model_meta — метаинформация о модели, на которой основано предсказание.
 * Идёт рядом с InsightsSchema.predicted_mood, чтобы клиент мог показать
 * пользователю «модель ещё калибруется» при недостатке данных, и чтобы
 * комиссия видела честные числа (cv_status, baseline_mae, improvement).
 */
export const ModelMetaSchema = z.object({
  version:             z.string().nullish(),
  samples_used:        z.number().nullish(),
  cv_status:           z.enum(['ok', 'insufficient_data']).nullish(),
  cv_mae:              z.number().nullish(),
  cv_r2:               z.number().nullish(),
  baseline_mae:        z.number().nullish(),
  baseline_r2:         z.number().nullish(),
  improvement_mae_pct: z.number().nullish(),
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
  model_meta:        ModelMetaSchema.nullish(),
  /** Юридический disclaimer — клиент обязан показать рядом с рекомендациями. */
  disclaimer:        z.string().nullish(),
  data_completeness: z.object({
    sleep:     z.number(),
    mood:      z.number(),
    stress:    z.number(),
    activity:  z.number(),
    nutrition: z.number(),
    water:     z.number(),
  }),
});
