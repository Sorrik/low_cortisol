// backend/src/nutrition/food-vision.schema.ts
// JSON Schema для Structured Outputs: gpt-4o vision возвращает блюда на фото.

export const FOOD_VISION_JSON_SCHEMA = {
  name: 'FoodVisionResult',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['items', 'overall_confidence'],
    properties: {
      items: {
        type: 'array',
        minItems: 0,
        maxItems: 10,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'name_ru', 'name_en_query', 'grams_estimate', 'confidence',
            'kcal_per_100g', 'protein_per_100g', 'fat_per_100g', 'carbs_per_100g',
          ],
          properties: {
            name_ru: {
              type: 'string',
              description: 'Название блюда на русском для отображения пользователю',
            },
            name_en_query: {
              type: 'string',
              description: 'Англ. поисковый запрос для FatSecret (короткий, без артиклей)',
            },
            grams_estimate: {
              type: 'number',
              minimum: 1,
              maximum: 2000,
              description: 'Оценка веса порции в граммах',
            },
            kcal_per_100g: {
              type: 'number',
              minimum: 0,
              maximum: 900,
              description: 'Калорийность на 100 г в ккал (средняя для этого блюда)',
            },
            protein_per_100g: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Белки на 100 г в граммах',
            },
            fat_per_100g: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Жиры на 100 г в граммах',
            },
            carbs_per_100g: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Углеводы на 100 г в граммах',
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: '0..1 — уверенность в распознавании и объёме',
            },
          },
        },
      },
      overall_confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Общая уверенность: 0 = не видно еды, 1 = уверенно',
      },
    },
  },
} as const

export interface FoodVisionItem {
  name_ru: string
  name_en_query: string
  grams_estimate: number
  kcal_per_100g: number
  protein_per_100g: number
  fat_per_100g: number
  carbs_per_100g: number
  confidence: number
}

export interface FoodVisionRaw {
  items: FoodVisionItem[]
  overall_confidence: number
}
