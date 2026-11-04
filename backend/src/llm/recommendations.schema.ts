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
export const VALID_CHAIN_STRENGTHS = ['weak', 'moderate', 'strong'] as const

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
          required: ['metric', 'severity', 'title', 'description', 'causal_chain'],
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
            // Опциональная ссылка на причинно-следственную цепочку из контекста.
            // OpenAI strict требует все поля в required и не поддерживает
            // optional через отсутствие в JSON. Реализуем nullable через
            // type: [object, null].
            causal_chain: {
              type: ['object', 'null'],
              additionalProperties: false,
              required: ['chain_id', 'trigger', 'mediator', 'outcome', 'lag', 'strength'],
              description: 'Если рекомендация построена вокруг причинно-следственной цепочки — указать её id и компоненты. Иначе null.',
              properties: {
                chain_id: {
                  type: 'string',
                  description: 'Идентификатор цепочки из контекста (A1, B2, …, F2)',
                },
                trigger: {
                  type: 'string',
                  description: 'Описание триггера с датой и значением (например: «вчера в 22:30 ужин 650 ккал, 30г жира»)',
                },
                mediator: {
                  type: ['string', 'null'],
                  description: 'Опциональное промежуточное звено (например: «фрагментированный REM ночью»). null если нет.',
                },
                outcome: {
                  type: 'string',
                  description: 'Описание исхода с датой и значением (например: «сегодня сон 4.5ч, качество 4/10»)',
                },
                lag: {
                  type: 'string',
                  description: 'Временной лаг между триггером и исходом: same-day | вчера → сегодня | за 7 дней | 3 дня → сегодня',
                },
                strength: {
                  type: 'string',
                  enum: [...VALID_CHAIN_STRENGTHS],
                  description: 'Сила цепочки: weak/moderate/strong (берётся из ПРИЧИННО-СЛЕДСТВЕННЫХ ЦЕПОЧЕК)',
                },
              },
            },
          },
        },
      },
    },
  },
} as const
