import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { BadRequestException } from '@nestjs/common'
import { getLoggerToken } from 'nestjs-pino'

import { VoiceParseService } from './voice-parse.service'

const mockCreate = jest.fn()
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}))

describe('VoiceParseService', () => {
  let service: VoiceParseService

  beforeEach(async () => {
    mockCreate.mockReset()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceParseService,
        {
          provide: ConfigService,
          useValue: { get: (_: string, def?: string) => def ?? 'test' },
        },
        {
          provide: getLoggerToken(VoiceParseService.name),
          useValue: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), setContext: jest.fn() },
        },
      ],
    }).compile()
    service = module.get(VoiceParseService)
  })

  it('rejects empty transcript', async () => {
    await expect(service.parse('', 'mood')).rejects.toBeInstanceOf(BadRequestException)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('parses mood voice to fields', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              mood_score: 7,
              stress_level: 'high',
              notes: 'был тяжёлый день',
              confidence: 0.9,
            }),
          },
        },
      ],
      usage: { total_tokens: 80 },
    })

    const res = await service.parse('чувствую себя на семь, стресс сильный, был тяжёлый день', 'mood')
    expect(res).toMatchObject({ mood_score: 7, stress_level: 'high', confidence: 0.9 })

    const [args] = mockCreate.mock.calls[0]
    expect(args.response_format.type).toBe('json_schema')
    expect(args.response_format.json_schema.name).toBe('MoodVoiceResult')
    expect(args.response_format.json_schema.strict).toBe(true)
  })

  it('selects sleep schema for sleep context', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              bed_time: '23:00',
              wake_time: '07:00',
              duration_hours: 8,
              quality: 7,
              interruptions: null,
              notes: '',
              confidence: 0.85,
            }),
          },
        },
      ],
    })

    await service.parse('лёг в одиннадцать, встал в семь', 'sleep')
    expect(mockCreate.mock.calls[0][0].response_format.json_schema.name).toBe('SleepVoiceResult')
  })

  it('selects water schema for water context', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ amount_ml: 500, notes: '', confidence: 0.9 }) } }],
    })
    const res = await service.parse('выпил пол-литра', 'water')
    expect(res).toMatchObject({ amount_ml: 500 })
    expect(mockCreate.mock.calls[0][0].response_format.json_schema.name).toBe('WaterVoiceResult')
  })

  it('returns confidence=0 on refusal', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { refusal: 'нельзя' } }],
    })
    const res = await service.parse('хм', 'mood')
    expect(res).toEqual({ confidence: 0 })
  })

  it('returns confidence=0 on invalid JSON', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'not-json' } }] })
    const res = await service.parse('test', 'food')
    expect(res).toEqual({ confidence: 0 })
  })

  it('wraps OpenAI error into BadRequest', async () => {
    mockCreate.mockRejectedValueOnce(new Error('rate-limited'))
    await expect(service.parse('test', 'mood')).rejects.toBeInstanceOf(BadRequestException)
  })
})
