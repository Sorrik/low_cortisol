// backend/src/insights/insights.controller.ts

import { Controller, UseGuards, Request, Delete, HttpCode } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { healthContract } from '@lowcor/contract';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InsightsService } from './insights.service';
import { RequestWithUser } from '../auth/interfaces/jwt-payload.interface';
import { randomUUID } from 'crypto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Insights')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

    // DELETE /insights/cache — сброс кэша вручную
  @Delete('insights/cache')
  @HttpCode(204)
  async clearCache(@Request() req: RequestWithUser) {
    await this.insightsService.invalidateCache(req.user.userId);
  }

  @TsRestHandler(healthContract.insights)
  async handler(@Request() req: RequestWithUser) {
    const userId = req.user.userId;

    return tsRestHandler(healthContract.insights, {
      // GET /insights/me
      me: async () => {
        const data = await this.insightsService.getInsights(userId);
        return { status: 200, body: data as any };
      },

      // GET /insights/recommendations
      recommendations: async () => {
        const { recommendations } = await this.insightsService.getInsights(userId);
        const data = recommendations.map((r: any) => ({
          id: randomUUID(),
          ...r,
        }));
        return { status: 200, body: { data } };
      },
    });
  }
}