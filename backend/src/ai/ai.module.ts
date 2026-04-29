// backend/src/ai/ai.module.ts

import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { TranscribeService } from './transcribe.service'
import { VoiceParseService } from './voice-parse.service'

@Module({
  controllers: [AiController],
  providers: [TranscribeService, VoiceParseService],
  exports: [TranscribeService, VoiceParseService],
})
export class AiModule {}
