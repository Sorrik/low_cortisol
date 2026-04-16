// backend/src/gamification/gamification.module.ts

import { Module }            from '@nestjs/common'
import { TypeOrmModule }     from '@nestjs/typeorm'
import { UserGamification }  from './gamification.entity'
import { GamificationService }    from './gamification.service'
import { GamificationController } from './gamification.controller'

@Module({
  imports:     [TypeOrmModule.forFeature([UserGamification])],
  providers:   [GamificationService],
  controllers: [GamificationController],
  exports:     [GamificationService],
})
export class GamificationModule {}