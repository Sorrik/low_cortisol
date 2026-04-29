// backend/src/ai/voice-parse.schema.ts
// 4 JSON-схемы (Structured Outputs) — под каждый контекст голосового ввода.
// LLM возвращает только поля, которые услышал; всё optional на уровне данных,
// но schema полей зафиксированных required для strict-mode OpenAI.

export const MOOD_VOICE_SCHEMA = {
  name: 'MoodVoiceResult',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['mood_score', 'stress_level', 'notes', 'confidence'],
    properties: {
      mood_score: {
        type: ['integer', 'null'],
        description: '1..10 (1 ужасно, 10 отлично). null если не сказано.',
      },
      stress_level: {
        type: ['string', 'null'],
        enum: ['low', 'medium', 'high', null],
        description: 'Уровень стресса. null если не сказано.',
      },
      notes: {
        type: 'string',
        description: 'Свободный текст/заметки из сказанного (может быть пустым).',
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
  },
} as const

export const SLEEP_VOICE_SCHEMA = {
  name: 'SleepVoiceResult',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['bed_time', 'wake_time', 'duration_hours', 'quality', 'interruptions', 'notes', 'confidence'],
    properties: {
      bed_time: {
        type: ['string', 'null'],
        description: 'Время укладывания в формате HH:MM (24h). null если не сказано.',
      },
      wake_time: {
        type: ['string', 'null'],
        description: 'Время пробуждения в формате HH:MM. null если не сказано.',
      },
      duration_hours: {
        type: ['number', 'null'],
        description: 'Длительность сна в часах (если сказано "спал 7 часов").',
      },
      quality: {
        type: ['integer', 'null'],
        description: 'Качество сна 1..10. null если не сказано.',
      },
      interruptions: {
        type: ['integer', 'null'],
        description: 'Сколько раз просыпался. null если не сказано.',
      },
      notes: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
  },
} as const

export const FOOD_VOICE_SCHEMA = {
  name: 'FoodVoiceResult',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['meal_type', 'items', 'notes', 'confidence'],
    properties: {
      meal_type: {
        type: ['string', 'null'],
        enum: ['breakfast', 'lunch', 'dinner', 'snack', null],
      },
      items: {
        type: 'array',
        minItems: 0,
        maxItems: 10,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'name_ru', 'name_en_query', 'grams_estimate',
            'kcal_per_100g', 'protein_per_100g', 'fat_per_100g', 'carbs_per_100g',
          ],
          properties: {
            name_ru: { type: 'string' },
            name_en_query: { type: 'string' },
            grams_estimate: { type: 'number', minimum: 1, maximum: 2000 },
            kcal_per_100g:    { type: 'number', minimum: 0, maximum: 900 },
            protein_per_100g: { type: 'number', minimum: 0, maximum: 100 },
            fat_per_100g:     { type: 'number', minimum: 0, maximum: 100 },
            carbs_per_100g:   { type: 'number', minimum: 0, maximum: 100 },
          },
        },
      },
      notes: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
  },
} as const

export const WATER_VOICE_SCHEMA = {
  name: 'WaterVoiceResult',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['amount_ml', 'notes', 'confidence'],
    properties: {
      amount_ml: {
        type: ['integer', 'null'],
        description: 'Выпитый объём в миллилитрах. 1 стакан ≈ 250, 1 бутылка 0.5 ≈ 500.',
      },
      notes: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
  },
} as const

export const VOICE_CONTEXTS = ['mood', 'sleep', 'food', 'water'] as const
export type VoiceContext = (typeof VOICE_CONTEXTS)[number]

export const SCHEMAS_BY_CONTEXT = {
  mood: MOOD_VOICE_SCHEMA,
  sleep: SLEEP_VOICE_SCHEMA,
  food: FOOD_VOICE_SCHEMA,
  water: WATER_VOICE_SCHEMA,
} as const

export const SYSTEM_PROMPTS: Record<VoiceContext, string> = {
  mood: `Ты извлекаешь настроение и стресс из голосовой заметки на русском.
- mood_score: 1..10 (юзер может сказать "семь из десяти", "нормально"≈6, "плохо"≈3, "отлично"≈9).
- stress_level: low/medium/high (слова "спокойно"→low, "напряжение"→medium, "сильный стресс/выгорание"→high).
- notes: оставь всё дополнительное (что случилось, контекст).
- confidence: 0.9 если всё явно, 0.5 если угадываешь, 0.2 если неясно.`,
  sleep: `Ты извлекаешь данные о сне из голосовой заметки на русском.
- bed_time/wake_time в HH:MM (24h). "Лёг в одиннадцать" = "23:00". "Встал в семь утра" = "07:00".
- duration_hours — число, если юзер сказал длительность ("спал восемь часов" = 8).
- quality: 1..10 ("хорошо"≈7, "плохо"≈3, "отлично"≈9).
- interruptions: число пробуждений если сказано.
- notes: контекст (снилось, просыпался из-за…).`,
  food: `Ты извлекаешь блюда и их вес из голосовой заметки на русском.
- meal_type: breakfast/lunch/dinner/snack (утро→breakfast, день→lunch, вечер→dinner, "перекус"→snack).
- items: каждому блюду name_ru (рус. название), name_en_query (англ. 1-3 слова для FatSecret, без артиклей), grams_estimate (граммы),
  а также средние справочные КБЖУ на 100 г: kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g.
  Ориентиры: варёная куриная грудка ~165/31/3.6/0; варёный рис ~130/2.7/0.3/28; овсянка на воде ~70/2.5/1.4/12; банан ~90/1.1/0.3/23;
  гречка варёная ~110/4/1/21; яйцо варёное ~155/13/11/1; хлеб белый ~265/8/3/50.
  "курица 200 грамм" = { name_ru: "курица", name_en_query: "chicken breast", grams_estimate: 200, kcal_per_100g: 165, protein_per_100g: 31, fat_per_100g: 3.6, carbs_per_100g: 0 }.
  Если юзер не сказал граммы — оцени типичную порцию.
- notes: дополнительно.`,
  water: `Ты извлекаешь объём воды из голосовой заметки на русском.
- amount_ml: целое число мл. "стакан" = 250, "большой стакан" = 300, "маленькая бутылка 0.5" = 500, "литр" = 1000, "два стакана" = 500.
- Если сказана литраж ("0.33") — переведи в мл (330).
- notes: контекст.`,
}
