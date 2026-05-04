// backend/src/stress/stress.controller.ts

import { Controller, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { healthContract } from '@lowcor/contract';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StressService } from './stress.service';
import { RequestWithUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateStressDto } from './dto/create-stress.dto';
import { UpdateStressDto } from './dto/update-stress.dto';

import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Stress')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Throttle({ medium: { limit: 30, ttl: 60_000 } })
@Controller()
export class StressController {
  constructor(private readonly stressService: StressService) {}

  @TsRestHandler(healthContract.stress)
  async handler(@Request() req: RequestWithUser) {
    const userId = req.user.userId;

    return tsRestHandler(healthContract.stress, {
      // POST /stress
      create: async ({ body }) => {
        const dto: CreateStressDto = {
          date:           body.date,
          time:           (body as any).time || '12:00',
          level:          body.level,
          cause:          (body as any).cause,
          copingStrategy: (body as any).copingStrategy,
        };

        const record = await this.stressService.create(userId, dto);
        return { status: 201, body: record as any };
      },

      // GET /stress?limit=30&offset=0
      list: async ({ query }) => {
        const limit = query.limit ?? 30;
        const offset = query.offset ?? 0;
        const result = await this.stressService.findAll(userId, limit, offset);
        return { status: 200, body: result as any };
      },

      // PATCH /stress/:id
      update: async ({ params, body }) => {
        const dto: UpdateStressDto = {
          time:           (body as any).time,
          level:          body.level,
          cause:          (body as any).cause,
          copingStrategy: (body as any).copingStrategy,
        };

        const record = await this.stressService.update(userId, params.id, dto);
        return { status: 200, body: record as any };
      },

      // DELETE /stress/:id
      delete: async ({ params }) => {
        await this.stressService.remove(userId, params.id);
        return { status: 204, body: undefined };
      },
    });
  }
}