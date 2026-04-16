// backend/src/gamification/gamification.controller.ts

import { Controller, Get, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard }        from '../auth/jwt-auth.guard'
import { GamificationService } from './gamification.service'

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private readonly svc: GamificationService) {}

  @Get()
  getStats(@Request() req: any) {
    return this.svc.getStats(req.user.userId)
  }
}