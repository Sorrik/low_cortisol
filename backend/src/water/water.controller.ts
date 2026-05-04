// backend/src/water/water.controller.ts

import { Controller, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { healthContract } from '@lowcor/contract';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WaterService } from './water.service';
import { RequestWithUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateWaterDto } from './dto/create-water.dto';
import { UpdateWaterDto } from './dto/update-water.dto';

import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Water')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Throttle({ medium: { limit: 30, ttl: 60_000 } })
@Controller()
export class WaterController {
  constructor(private readonly waterService: WaterService) {}

  @TsRestHandler(healthContract.water)
  async handler(@Request() req: RequestWithUser) {
    const userId = req.user.userId;

    return tsRestHandler(healthContract.water, {
      // POST /water
      create: async ({ body }) => {
        const dto: CreateWaterDto = {
          date:     body.date,
          time:     (body as any).time ?? '12:00',           // безопасно, т.к. time может отсутствовать в схеме
          amountMl: body.amountMl ?? ((body as any).glasses || 0) * 250,
        };

        const record = await this.waterService.create(userId, dto);
        return { status: 201, body: record as any };
      },

      // GET /water?limit=30&offset=0
      list: async ({ query }) => {
        const limit = query.limit ?? 30;
        const offset = query.offset ?? 0;
        const result = await this.waterService.findAll(userId, limit, offset);
        return { status: 200, body: result as any };
      },

      // PATCH /water/:id
      update: async ({ params, body }) => {
        const dto: UpdateWaterDto = {
          time:     (body as any).time,
          amountMl: body.amountMl ?? ((body as any).glasses || 0) * 250,
        };

        const record = await this.waterService.update(userId, params.id, dto);
        return { status: 200, body: record as any };
      },

      // DELETE /water/:id
      delete: async ({ params }) => {
        await this.waterService.remove(userId, params.id);
        return { status: 204, body: undefined };
      },
    });
  }
}