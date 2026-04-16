// backend/src/nutrition/food-search.service.ts
// Поиск: сначала своя БД → если мало результатов → FatSecret fallback

import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Food } from './food.entity'
import { FatSecretService, FoodItem } from './fatsecret.service'

@Injectable()
export class FoodSearchService {
  constructor(
    @InjectRepository(Food)
    private readonly foodRepo: Repository<Food>,

    private readonly fatSecret: FatSecretService,
  ) {}

  async search(query: string): Promise<FoodItem[]> {
    // 1. Ищем в своей БД
    const local = await this.foodRepo
      .createQueryBuilder('f')
      .where('f.name_ru ILIKE :q', { q: `%${query}%` })
      .orWhere('f.name_en ILIKE :q', { q: `%${query}%` })
      .orderBy(`CASE WHEN f.name_ru ILIKE :exact THEN 0 ELSE 1 END`, 'ASC', )
      .setParameter('exact', `${query}%`)
      .limit(10)
      .getMany()

    if (local.length >= 3) {
      // Достаточно результатов — возвращаем из своей БД
      return local.map(f => ({
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

    // 2. Fallback на FatSecret если нашли мало
    return await this.fatSecret.search(query, 10)
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