import { Controller, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { healthContract } from '@lowcor/contract';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SleepService } from './sleep.service';
import { RequestWithUser } from '../auth/interfaces/jwt-payload.interface';

import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Sleep')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Throttle({ medium: { limit: 30, ttl: 60_000 } })
@Controller()
export class SleepController {
  constructor(private readonly sleepService: SleepService) {}

  @TsRestHandler(healthContract.sleep)
  async handler(@Request() req: RequestWithUser) {
    const userId = req.user.userId;

    return tsRestHandler(healthContract.sleep, {
      create: async ({ body }) => ({ status: 201, body: await this.sleepService.create(userId, body) as any }),
      list:   async ({ query }) => {
        const limit = query.limit ?? 30;
        const offset = query.offset ?? 0;
        const result = await this.sleepService.findAll(userId, limit, offset);
        return { status: 200, body: result as any };
      },
      update: async ({ params, body }) => ({ status: 200, body: await this.sleepService.update(userId, params.id, body) as any }),
      delete: async ({ params }) => {
        await this.sleepService.remove(userId, params.id);
        return { status: 204, body: undefined };
      },
    });
  }
}