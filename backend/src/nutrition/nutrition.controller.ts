// backend/src/nutrition/nutrition.controller.ts

import { Controller, UseGuards, Request, Get, Post, Body, Query } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler';
import { TsRestHandler, tsRestHandler }               from '@ts-rest/nest'
import { healthContract }                             from '@lowcor/contract'
import { JwtAuthGuard }                               from '../auth/jwt-auth.guard'
import { NutritionService }                           from './nutrition.service'
import { FoodSearchService }                          from './food-search.service'
import { FoodVisionService }                          from './food-vision.service'
import { RequestWithUser }                            from '../auth/interfaces/jwt-payload.interface'
import { CreateNutritionDto }                         from './dto/create-nutrition.dto'
import { UpdateNutritionDto }                         from './dto/update-nutrition.dto'
import { AnalyzePhotoDto }                            from './dto/analyze-photo.dto'
import { ApiTags, ApiBearerAuth, ApiOperation }       from '@nestjs/swagger'

@ApiTags('Nutrition')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Throttle({ medium: { limit: 30, ttl: 60_000 } })
@Controller()
export class NutritionController {
  constructor(
    private readonly nutritionService: NutritionService,
    private readonly foodSearch:       FoodSearchService,
    private readonly foodVision:       FoodVisionService,
  ) {}

  // ── GET /nutrition/food-search?q=... ────────────────────────
  @Get('nutrition/food-search')
  async foodSearchEndpoint(@Query('q') q: string) {
    if (!q || q.trim().length < 2) return { foods: [] }
    return { foods: await this.foodSearch.search(q.trim()) }
  }

  // ── GET /nutrition/food-barcode?code=... ────────────────────
  @Get('nutrition/food-barcode')
  async foodBarcode(@Query('code') code: string) {
    if (!code) return { food: null }
    const food = await this.foodSearch.searchByBarcode(code.trim())
    return { food }
  }

  // ── POST /nutrition/analyze-photo ───────────────────────────
  // Фото → gpt-4o vision → массив блюд → для каждого FatSecret lookup →
  // возвращаем draft для предзаполнения формы на клиенте.
  @Post('nutrition/analyze-photo')
  @ApiOperation({ summary: 'Распознать блюда на фото и оценить КБЖУ через FatSecret' })
  async analyzePhoto(@Body() dto: AnalyzePhotoDto) {
    const vision = await this.foodVision.analyze(dto.imageBase64, dto.mimeType)

    if (vision.items.length === 0 || vision.overall_confidence < 0.3) {
      return {
        items: [],
        overall_confidence: vision.overall_confidence,
        message: 'Не удалось распознать еду на фото. Попробуйте другой ракурс или введите вручную.',
      }
    }

    // КБЖУ оцениваем самим LLM (он знает справочные значения для стандартных блюд).
    // FatSecret как fallback/уточнение, если найдётся точный матч в базе.
    const items = await Promise.all(
      vision.items.map(async (item) => {
        const scale = item.grams_estimate / 100
        let kcalPer100    = item.kcal_per_100g
        let proteinPer100 = item.protein_per_100g
        let fatPer100     = item.fat_per_100g
        let carbsPer100   = item.carbs_per_100g
        let matchedName: string | undefined

        try {
          const results = await this.foodSearch.search(item.name_en_query)
          const match = results[0]
          if (match && match.per100g.kcal > 0) {
            kcalPer100    = match.per100g.kcal
            proteinPer100 = match.per100g.protein
            fatPer100     = match.per100g.fat
            carbsPer100   = match.per100g.carbs
            matchedName   = match.name
          }
        } catch {
          // FatSecret упал — остаёмся на LLM-оценке
        }

        return {
          name: item.name_ru,
          matchedFoodName: matchedName,
          grams: Math.round(item.grams_estimate),
          confidence: item.confidence,
          matched: true as const,
          calories:     Math.round(kcalPer100    * scale),
          proteinGrams: Math.round(proteinPer100 * scale * 10) / 10,
          carbsGrams:   Math.round(carbsPer100   * scale * 10) / 10,
          fatGrams:     Math.round(fatPer100     * scale * 10) / 10,
        }
      }),
    )

    return { items, overall_confidence: vision.overall_confidence }
  }

  // ── ts-rest handlers (без изменений) ────────────────────────
  @TsRestHandler(healthContract.nutrition)
  async handler(@Request() req: RequestWithUser) {
    const userId = req.user.userId

    return tsRestHandler(healthContract.nutrition, {
      create: async ({ body }) => {
        const dto: CreateNutritionDto = {
          date:         body.date,
          time:         (body as any).time     ?? '00:00',
          mealType:     (body as any).mealType ?? 'snack',
          description:  (body as any).mealName ?? body.description ?? '',
          calories:     body.calories          ?? 0,
          proteinGrams: body.proteinGrams      ?? 0,
          carbsGrams:   body.carbsGrams        ?? 0,
          fatGrams:     body.fatGrams          ?? 0,
        }
        const record = await this.nutritionService.create(userId, dto)
        return { status: 201, body: record as any }
      },

      list: async ({ query }) => {
        const result = await this.nutritionService.findAll(
          userId,
          query.limit  ?? 30,
          query.offset ?? 0,
        )
        return { status: 200, body: result as any }
      },

      update: async ({ params, body }) => {
        const dto: UpdateNutritionDto = {
          time:         (body as any).time,
          mealType:     (body as any).mealType,
          description:  (body as any).mealName ?? body.description,
          calories:     body.calories,
          proteinGrams: body.proteinGrams,
          carbsGrams:   body.carbsGrams,
          fatGrams:     body.fatGrams,
        }
        const record = await this.nutritionService.update(userId, params.id, dto)
        return { status: 200, body: record as any }
      },

      delete: async ({ params }) => {
        await this.nutritionService.remove(userId, params.id)
        return { status: 204, body: undefined }
      },
    })
  }
}