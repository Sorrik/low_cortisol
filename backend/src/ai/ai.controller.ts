// backend/src/ai/ai.controller.ts
// POST /ai/voice-to-form — multipart: audio + context.
// Возвращает { transcript, fields } — транскрипция + типизированные поля для формы.

import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { TranscribeService } from './transcribe.service'
import { VoiceParseService } from './voice-parse.service'
import { VOICE_CONTEXTS, VoiceContext } from './voice-parse.schema'

@ApiTags('AI')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly transcribe: TranscribeService,
    private readonly parser: VoiceParseService,
  ) {}

  @Post('voice-to-form')
  @ApiOperation({ summary: 'Аудио → транскрипция → типизированные поля формы' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async voiceToForm(
    @UploadedFile() file: Express.Multer.File,
    @Body('context') context: string,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('audio file is required')
    }
    if (!VOICE_CONTEXTS.includes(context as VoiceContext)) {
      throw new BadRequestException(
        `context must be one of: ${VOICE_CONTEXTS.join(', ')}`,
      )
    }

    const transcript = await this.transcribe.transcribe(file.buffer, file.originalname)
    if (!transcript) {
      return { transcript: '', fields: { confidence: 0 } }
    }

    const fields = await this.parser.parse(transcript, context as VoiceContext)
    return { transcript, fields }
  }
}
