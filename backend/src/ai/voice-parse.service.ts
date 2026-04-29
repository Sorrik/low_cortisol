// backend/src/ai/voice-parse.service.ts
// Транскрипция → gpt-4o-mini + Structured Outputs → типизированные поля для формы.

import { Injectable, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import OpenAI from 'openai'

import {
  SCHEMAS_BY_CONTEXT,
  SYSTEM_PROMPTS,
  VoiceContext,
} from './voice-parse.schema'

@Injectable()
export class VoiceParseService {
  private readonly client: OpenAI
  private readonly model: string

  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(VoiceParseService.name)
    private readonly logger: PinoLogger,
  ) {
    this.client = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
      baseURL: this.config.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
    })
    this.model = this.config.get<string>('VOICE_PARSE_MODEL', 'gpt-4o-mini')
  }

  async parse(transcript: string, context: VoiceContext): Promise<Record<string, unknown>> {
    if (!transcript || transcript.trim().length === 0) {
      throw new BadRequestException('Empty transcript')
    }

    const schema = SCHEMAS_BY_CONTEXT[context]
    const systemPrompt = SYSTEM_PROMPTS[context]

    let completion
    try {
      completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: 'json_schema', json_schema: schema },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Транскрипция:\n"""${transcript}"""` },
        ],
      })
    } catch (err) {
      this.logger.error({ err, context }, 'Voice parse call failed')
      throw new BadRequestException('Не удалось разобрать сказанное.')
    }

    const choice = completion.choices[0]
    if (choice?.message?.refusal) {
      this.logger.warn({ refusal: choice.message.refusal, context }, 'Voice parse refused')
      return { confidence: 0 }
    }

    const content = choice?.message?.content
    if (!content) return { confidence: 0 }

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>
      this.logger.info({ context, usage: completion.usage }, 'Voice parsed')
      return parsed
    } catch (err) {
      this.logger.error({ err, content, context }, 'Voice parse JSON invalid')
      return { confidence: 0 }
    }
  }
}
