// backend/src/nutrition/food-vision.service.ts
// Фото блюда → OpenAI gpt-4o vision (Structured Outputs) → массив блюд с оценкой граммов.
// Далее контроллер/сервис берёт name_en_query и пробивает через FoodSearchService → точные КБЖУ.

import { Injectable, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import OpenAI from 'openai'

import {
  FOOD_VISION_JSON_SCHEMA,
  FoodVisionItem,
  FoodVisionRaw,
} from './food-vision.schema'

const SYSTEM_PROMPT = `Ты — нутриционист, анализирующий фотографию тарелки с едой.
Для каждого блюда/продукта определи: название, вес порции и пищевую ценность на 100 г.

Правила:
- name_ru — короткое название на русском для UI (например "куриная грудка", "варёный рис", "салат цезарь").
- name_en_query — англ. поисковый запрос для базы продуктов (например "chicken breast grilled", "white rice cooked", "caesar salad"). 1-3 слова, без артиклей.
- grams_estimate — реалистичная оценка веса порции в граммах (куриная грудка ~150г, порция риса ~200г, ломтик хлеба ~30г).
- kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g — средние справочные значения пищевой ценности на 100 г этого блюда в приготовленном виде.
  Примеры ориентиров: варёная куриная грудка ~165 ккал / Б31 / Ж3.6 / У0; варёный белый рис ~130/2.7/0.3/28; овсяная каша на воде ~70/2.5/1.4/12; банан ~90/1.1/0.3/23; салат цезарь с курицей ~190/11/14/5.
  Если блюдо составное (суп, салат с заправкой) — оценивай усреднённо для стандартного рецепта.
- confidence — 0..1: 1 если блюдо видно чётко и объём очевиден, 0.3 если частично закрыто или размер неясен.
- Соусы/гарниры которые меньше 20г — не считай отдельно.
- Если еды на фото нет — верни пустой items и overall_confidence=0.
- overall_confidence=0 также если изображение не еда, слишком тёмное или размытое.`

@Injectable()
export class FoodVisionService {
  private readonly client: OpenAI
  private readonly model: string

  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(FoodVisionService.name)
    private readonly logger: PinoLogger,
  ) {
    this.client = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
      baseURL: this.config.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
    })
    this.model = this.config.get<string>('VISION_MODEL', 'gpt-4o-2024-08-06')
  }

  async analyze(imageBase64: string, mimeType: string): Promise<FoodVisionRaw> {
    if (!imageBase64 || imageBase64.length < 100) {
      throw new BadRequestException('Empty or invalid image')
    }

    const dataUrl = `data:${mimeType};base64,${imageBase64}`

    let completion
    try {
      completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.1,
        max_tokens: 600,
        response_format: {
          type: 'json_schema',
          json_schema: FOOD_VISION_JSON_SCHEMA,
        },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Определи блюда на фото и оцени порции в граммах.' },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
            ],
          },
        ],
      })
    } catch (err) {
      this.logger.error({ err }, 'OpenAI vision call failed')
      throw new BadRequestException('Не удалось распознать фото. Попробуйте снова.')
    }

    const choice = completion.choices[0]
    if (choice?.message?.refusal) {
      this.logger.warn({ refusal: choice.message.refusal }, 'Vision refused')
      return { items: [], overall_confidence: 0 }
    }

    const content = choice?.message?.content
    if (!content) {
      return { items: [], overall_confidence: 0 }
    }

    let parsed: FoodVisionRaw
    try {
      parsed = JSON.parse(content) as FoodVisionRaw
    } catch (err) {
      this.logger.error({ err, content }, 'Vision response not JSON')
      return { items: [], overall_confidence: 0 }
    }

    const items = Array.isArray(parsed.items) ? parsed.items.filter(this._isValidItem) : []
    this.logger.info(
      {
        usage: completion.usage,
        itemCount: items.length,
        overall: parsed.overall_confidence,
      },
      'Vision analyzed photo',
    )

    return {
      items,
      overall_confidence: Number(parsed.overall_confidence) || 0,
    }
  }

  private _isValidItem(item: unknown): item is FoodVisionItem {
    if (!item || typeof item !== 'object') return false
    const it = item as FoodVisionItem
    return (
      typeof it.name_ru === 'string' &&
      it.name_ru.length > 0 &&
      typeof it.name_en_query === 'string' &&
      it.name_en_query.length > 0 &&
      typeof it.grams_estimate === 'number' &&
      it.grams_estimate > 0 &&
      typeof it.confidence === 'number'
    )
  }
}
