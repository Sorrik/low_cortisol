// backend/src/activity/activity.controller.ts
import { Controller, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { healthContract } from '@lowcor/contract';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActivityService } from './activity.service';
import { RequestWithUser } from '../auth/interfaces/jwt-payload.interface';

import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Activity')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Throttle({ medium: { limit: 30, ttl: 60_000 } })
@Controller()
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @TsRestHandler(healthContract.activity)
  async handler(@Request() req: RequestWithUser) {
    const userId = req.user.userId;

    return tsRestHandler(healthContract.activity, {
      create: async ({ body }) => {
        const record = await this.activityService.create(userId, body);
        return { status: 201, body: record as any };   // ← as any решает проблему с entity
      },

      list: async ({ query }) => {
        const limit = query.limit ?? 30;
        const offset = query.offset ?? 0;

        const result = await this.activityService.findAll(userId, limit, offset);
        return { status: 200, body: result as any };   // ← as any
      },

      update: async ({ params, body }) => {
        const record = await this.activityService.update(userId, params.id, body);
        return { status: 200, body: record as any };   // ← as any
      },

      delete: async ({ params }) => {
        await this.activityService.remove(userId, params.id);
        return { status: 204, body: undefined };
      },
    });
  }
}