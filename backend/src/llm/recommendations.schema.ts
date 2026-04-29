// backend/src/llm/recommendations.schema.ts
//
// JSON Schema для OpenAI Structured Outputs (gpt-4o-2024-08-06+).
// Модель гарантированно вернёт JSON, соответствующий этой схеме —
// ручной markdown-stripping больше не нужен.
//
// Правила OpenAI strict:true:
//   - все поля обязательны (required = список всех properties)
//   - additionalProperties: false везде
//   - enum-ы поддерживаются

export const VALID_METRICS    = ['sleep', 'mood', 'stress', 'activity', 'water', 'food'] as const
export const VALID_SEVERITIES = ['good', 'attention', 'alert'] as const

export const RECOMMENDATIONS_JSON_SCHEMA = {
  name:   'Recommendations',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['recommendations'],
    properties: {
      recommendations: {
        type:     'array',
        minItems: 1,
        maxItems: 6,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['metric', 'severity', 'title', 'description'],
          properties: {
            metric: {
              type: 'string',
              enum: [...VALID_METRICS],
              description: 'Область здоровья, к которой относится рекомендация',
            },
            severity: {
              type: 'string',
              enum: [...VALID_SEVERITIES],
              description: 'Приоритет: good — норма, attention — стоит следить, alert — требует действий',
            },
            title: {
              type: 'string',
              description: 'Короткий заголовок рекомендации, 3-8 слов',
            },
            description: {
              type: 'string',
              description: 'Развёрнутое объяснение с конкретным действием, 1-3 предложения',
            },
          },
        },
      },
    },
  },
} as const
