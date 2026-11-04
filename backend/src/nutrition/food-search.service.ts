// backend/src/nutrition/food-search.service.ts
// Каскадный поиск: Локальная БД → FatSecret → OpenFoodFacts(RU) → Перевод+OpenFoodFacts(EN)

import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import { Food } from './food.entity'
import { FatSecretService, FoodItem } from './fatsecret.service'

@Injectable()
export class FoodSearchService {
  private readonly openai: OpenAI

  constructor(
    @InjectRepository(Food)
    private readonly foodRepo: Repository<Food>,
    private readonly fatSecret: FatSecretService,
    private readonly config: ConfigService,
  ) {
    this.openai = new OpenAI({ apiKey: this.config.get<string>('OPENAI_API_KEY') })
  }

  async search(query: string): Promise<FoodItem[]> {
    // 1. Локальная БД
    const local = await this._searchLocal(query)
    if (local.length >= 3) return local

    // 2. FatSecret
    const fatsecret = await this.fatSecret.search(query, 10)
    if (fatsecret.length >= 3) {
      await this._cacheResults(fatsecret)
      return fatsecret
    }

    // 3. OpenFoodFacts с русским языком
    const offRu = await this._searchOpenFoodFacts(query, 'ru')
    if (offRu.length >= 3) {
      await this._cacheResults(offRu)
      return offRu
    }

    // 4. Перевод запроса на английский → OpenFoodFacts EN
    const queryEn = await this._translateToEnglish(query)
    if (queryEn) {
      const offEn = await this._searchOpenFoodFacts(queryEn, 'en')
      if (offEn.length > 0) {
        await this._cacheResults(offEn)
        return offEn
      }
    }

    // Возвращаем всё что нашли на предыдущих шагах
    return [...local, ...fatsecret, ...offRu]
  }

  // ── Приватные методы ─────────────────────────────────────────

  private async _searchLocal(query: string): Promise<FoodItem[]> {
    const rows = await this.foodRepo
      .createQueryBuilder('f')
      .where('f.name_ru ILIKE :q', { q: `%${query}%` })
      .orWhere('f.name_en ILIKE :q', { q: `%${query}%` })
      .orderBy(`CASE WHEN f.name_ru ILIKE :exact THEN 0 ELSE 1 END`, 'ASC')
      .setParameter('exact', `${query}%`)
      .limit(10)
      .getMany()

    return rows.map(f => ({
      food_id: String(f.id),
      name:    f.nameRu,
      per100g: {
        kcal:    f.kcal,
        protein: Number(f.protein),
        fat:     Number(f.fat),
        carbs:   Number(f.carbs),
      },
    }))
  }

  private async _searchOpenFoodFacts(query: string, lang: string): Promise<FoodItem[]> {
    try {
      const params = new URLSearchParams({
        search_terms:  query,
        search_simple: '1',
        action:        'process',
        json:          '1',
        lc:            lang,
        page_size:     '10',
        fields:        'product_name,product_name_ru,brands,nutriments',
      })
      const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`)
      if (!res.ok) return []

      const data     = await res.json()
      const products = data?.products ?? []

      return (products as any[])
        .map((p): FoodItem | null => {
          const n = p.nutriments
          if (!n) return null
          const kcal = Math.round(
            n['energy-kcal_100g'] != null
              ? n['energy-kcal_100g']
              : n['energy_100g'] != null
                ? n['energy_100g'] / 4.184
                : 0,
          )
          if (kcal === 0) return null
          return {
            food_id: `off_${p.id ?? query}`,
            name:    p.product_name_ru || p.product_name || query,
            brand:   p.brands ?? undefined,
            per100g: {
              kcal,
              protein: Math.round((n['proteins_100g']     ?? 0) * 10) / 10,
              fat:     Math.round((n['fat_100g']           ?? 0) * 10) / 10,
              carbs:   Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
            },
          }
        })
        .filter((x): x is FoodItem => x !== null)
    } catch {
      return []
    }
  }

  private async _translateToEnglish(query: string): Promise<string | null> {
    try {
      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role:    'system',
            content: 'Translate the food or dish name from Russian to English for food database search. Return only the English translation, 1-3 words, no articles, no explanation.',
          },
          { role: 'user', content: query },
        ],
        max_tokens:  20,
        temperature: 0,
      })
      return res.choices[0]?.message?.content?.trim() ?? null
    } catch {
      return null
    }
  }

  // Кешируем до 3 новых результатов в локальную БД
  private async _cacheResults(items: FoodItem[]): Promise<void> {
    for (const item of items.slice(0, 3)) {
      try {
        const exists = await this.foodRepo.findOne({ where: { nameRu: item.name } })
        if (!exists && item.per100g.kcal > 0) {
          await this.foodRepo.save({
            nameRu:   item.name,
            category: 'Найдено',
            kcal:     item.per100g.kcal,
            protein:  item.per100g.protein,
            fat:      item.per100g.fat,
            carbs:    item.per100g.carbs,
          } as any)
        }
      } catch { /* ошибки кеша не критичны */ }
    }
  }

  async searchByBarcode(barcode: string): Promise<FoodItem | null> {
    // Сначала проверяем свою БД
    const local = await this.foodRepo.findOne({ where: { barcode } })
    if (local) {
      return {
        food_id: String(local.id),
        name:    local.nameRu,
        per100g: {
          kcal:    local.kcal,
          protein: Number(local.protein),
          fat:     Number(local.fat),
          carbs:   Number(local.carbs),
        },
      }
    }

    // OpenFoodFacts по штрихкоду
    try {
      const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
      const data = await res.json()

      if (data.status !== 1) return null

      const p = data.product
      const n = p.nutriments

const item: FoodItem = {
  food_id: barcode,
  name:    p.product_name_ru ?? p.product_name ?? barcode,
  brand:   p.brands,
  per100g: {
    kcal: Math.round(
      n['energy-kcal_100g'] != null
        ? n['energy-kcal_100g']
        : n['energy_100g'] != null
          ? n['energy_100g'] / 4.184
          : 0
    ),
    protein: Math.round((n['proteins_100g']      ?? 0) * 10) / 10,
    fat:     Math.round((n['fat_100g']            ?? 0) * 10) / 10,
    carbs:   Math.round((n['carbohydrates_100g']  ?? 0) * 10) / 10,
  },
};

      // Кэшируем в свою БД чтобы следующий раз нашло быстро
      await this.foodRepo.save({
        nameRu:   item.name,
        nameEn:   p.product_name,
        category: 'Штрихкод',
        kcal:     item.per100g.kcal,
        protein:  item.per100g.protein,
        fat:      item.per100g.fat,
        carbs:    item.per100g.carbs,
        barcode,
      } as any)

      return item
    } catch {
      return null
    }
  }
}