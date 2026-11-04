// backend/src/ai/transcribe.service.ts
// Обёртка над транскрипцией аудио с двумя backend'ами:
//   TRANSCRIBE_BACKEND=ml_service (default) — локальный faster-whisper через ml-service (бесплатно)
//   TRANSCRIBE_BACKEND=openai                — OpenAI Whisper API (платно, fallback)
//
// Возвращает транскрипцию на русском.

import { Injectable, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import OpenAI, { toFile } from 'openai'

type TranscribeBackend = 'ml_service' | 'openai'

@Injectable()
export class TranscribeService {
  private readonly openaiClient: OpenAI
  private readonly openaiModel: string
  private readonly backend: TranscribeBackend
  private readonly mlServiceUrl: string

  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(TranscribeService.name)
    private readonly logger: PinoLogger,
  ) {
    this.openaiClient = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
      baseURL: this.config.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
    })
    this.openaiModel = this.config.get<string>('WHISPER_MODEL', 'whisper-1')

    const rawBackend = (
      this.config.get<string>('TRANSCRIBE_BACKEND', 'ml_service') ?? 'ml_service'
    ).toLowerCase()
    this.backend = rawBackend === 'openai' ? 'openai' : 'ml_service'

    this.mlServiceUrl = (
      this.config.get<string>('ML_SERVICE_URL', 'http://ml-service:8000') ??
      'http://ml-service:8000'
    ).replace(/\/$/, '')

    this.logger.info(
      { backend: this.backend, mlServiceUrl: this.mlServiceUrl },
      'TranscribeService initialized',
    )
  }

  async transcribe(
    audio: Buffer,
    filename = 'audio.m4a',
    language = 'ru',
  ): Promise<string> {
    if (!audio || audio.length === 0) {
      throw new BadRequestException('Empty audio buffer')
    }
    if (audio.length > 25 * 1024 * 1024) {
      throw new BadRequestException('Audio too large (max 25MB)')
    }

    if (this.backend === 'ml_service') {
      return this._transcribeViaMlService(audio, filename, language)
    }
    return this._transcribeViaOpenAI(audio, filename, language)
  }

  private async _transcribeViaMlService(
    audio: Buffer,
    filename: string,
    language: string,
  ): Promise<string> {
    try {
      const form = new FormData()
      const blob = new Blob([audio], { type: 'application/octet-stream' })
      form.append('audio', blob, filename)
      form.append('language', language)

      const res = await fetch(`${this.mlServiceUrl}/transcribe/`, {
        method: 'POST',
        body: form,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`ml-service ${res.status}: ${text || res.statusText}`)
      }

      const data = (await res.json()) as { text?: string; duration?: number }
      const text = (data.text ?? '').trim()
      this.logger.info(
        { bytes: audio.length, chars: text.length, duration: data.duration },
        'Transcribed via ml-service',
      )
      return text
    } catch (err) {
      this.logger.error({ err }, 'ml-service transcribe failed')
      throw new BadRequestException('Не удалось распознать речь. Попробуйте снова.')
    }
  }

  private async _transcribeViaOpenAI(
    audio: Buffer,
    filename: string,
    language: string,
  ): Promise<string> {
    try {
      const file = await toFile(audio, filename)
      const res = await this.openaiClient.audio.transcriptions.create({
        model: this.openaiModel,
        file,
        language,
        response_format: 'text',
      })
      const text = typeof res === 'string' ? res : (res as { text?: string }).text ?? ''
      this.logger.info(
        { bytes: audio.length, chars: text.length },
        'Transcribed via OpenAI Whisper',
      )
      return text.trim()
    } catch (err) {
      this.logger.error({ err }, 'OpenAI Whisper call failed')
      throw new BadRequestException('Не удалось распознать речь. Попробуйте снова.')
    }
  }
}
