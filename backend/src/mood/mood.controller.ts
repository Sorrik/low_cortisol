// backend/src/mood/mood.controller.ts

import { Controller, UseGuards, Request } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { healthContract } from '@lowcor/contract';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MoodService } from './mood.service';
import { RequestWithUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateMoodDto } from './dto/create-mood.dto';
import { UpdateMoodDto } from './dto/update-mood.dto';

import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Mood')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()   // ← ОБЯЗАТЕЛЬНО пустой!
export class MoodController {
  constructor(private readonly moodService: MoodService) {}

  @TsRestHandler(healthContract.mood)
  async handler(@Request() req: RequestWithUser) {
    const userId = req.user.userId;

    return tsRestHandler(healthContract.mood, {
      // POST /mood
      create: async ({ body }) => {
        const dto: CreateMoodDto = {
          date:      body.date,
          time:      (body as any).time ?? '12:00',
          moodScore: body.moodScore,           // ← только moodScore
          emotions:  (body as any).emotions ?? '',
          triggers:  (body as any).triggers ?? '',
          notes:     body.notes ?? '',
        };

        const record = await this.moodService.create(userId, dto);
        return { status: 201, body: record as any };
      },

      // GET /mood?limit=30&offset=0
      list: async ({ query }) => {
        const limit = query.limit ?? 30;
        const offset = query.offset ?? 0;
        const result = await this.moodService.findAll(userId, limit, offset);
        return { status: 200, body: result as any };
      },

      // PATCH /mood/:id
      update: async ({ params, body }) => {
        const dto: UpdateMoodDto = {
          time:      (body as any).time,
          moodScore: body.moodScore,           // ← только moodScore
          emotions:  (body as any).emotions,
          triggers:  (body as any).triggers,
          notes:     body.notes,
        };

        const record = await this.moodService.update(userId, params.id, dto);
        return { status: 200, body: record as any };
      },

      // DELETE /mood/:id
      delete: async ({ params }) => {
        await this.moodService.remove(userId, params.id);
        return { status: 204, body: undefined };
      },
    });
  }
}