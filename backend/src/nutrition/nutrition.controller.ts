// backend/src/nutrition/nutrition.controller.ts

import { Controller, UseGuards, Request, Get, Query } from '@nestjs/common'
import { TsRestHandler, tsRestHandler }               from '@ts-rest/nest'
import { healthContract }                             from '@lowcor/contract'
import { JwtAuthGuard }                               from '../auth/jwt-auth.guard'
import { NutritionService }                           from './nutrition.service'
import { FoodSearchService }                          from './food-search.service'
import { RequestWithUser }                            from '../auth/interfaces/jwt-payload.interface'
import { CreateNutritionDto }                         from './dto/create-nutrition.dto'
import { UpdateNutritionDto }                         from './dto/update-nutrition.dto'
import { ApiTags, ApiBearerAuth }                     from '@nestjs/swagger'

@ApiTags('Nutrition')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class NutritionController {
  constructor(
    private readonly nutritionService: NutritionService,
    private readonly foodSearch:       FoodSearchService,
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