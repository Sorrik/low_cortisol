import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { BadRequestException } from '@nestjs/common'
import { getLoggerToken } from 'nestjs-pino'

import { FoodVisionService } from './food-vision.service'

const mockCreate = jest.fn()
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  }
})

describe('FoodVisionService', () => {
  let service: FoodVisionService

  const fakeLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
  }

  beforeEach(async () => {
    mockCreate.mockReset()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodVisionService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: string) => {
              const map: Record<string, string> = {
                OPENAI_API_KEY: 'sk-test',
                OPENAI_BASE_URL: 'https://api.openai.com/v1',
                VISION_MODEL: 'gpt-4o-2024-08-06',
              }
              return map[key] ?? def
            },
          },
        },
        {
          provide: getLoggerToken(FoodVisionService.name),
          useValue: fakeLogger,
        },
      ],
    }).compile()

    service = module.get(FoodVisionService)
  })

  const validImageB64 = 'a'.repeat(200)

  it('rejects empty or too-short base64', async () => {
    await expect(service.analyze('', 'image/jpeg')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.analyze('short', 'image/jpeg')).rejects.toBeInstanceOf(BadRequestException)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('parses structured JSON response and returns items', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                { name_ru: 'куриная грудка', name_en_query: 'chicken breast', grams_estimate: 150, confidence: 0.9 },
                { name_ru: 'рис варёный',    name_en_query: 'white rice cooked', grams_estimate: 200, confidence: 0.8 },
              ],
              overall_confidence: 0.85,
            }),
          },
        },
      ],
      usage: { total_tokens: 300 },
    })

    const res = await service.analyze(validImageB64, 'image/jpeg')
    expect(res.items).toHaveLength(2)
    expect(res.items[0]).toMatchObject({ name_ru: 'куриная грудка', grams_estimate: 150 })
    expect(res.overall_confidence).toBe(0.85)

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.response_format.type).toBe('json_schema')
    expect(callArgs.response_format.json_schema.strict).toBe(true)
    expect(callArgs.messages[1].content[1].type).toBe('image_url')
    expect(callArgs.messages[1].content[1].image_url.url).toContain('data:image/jpeg;base64,')
  })

  it('handles model refusal gracefully', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { refusal: 'I cannot process this image.' } }],
    })

    const res = await service.analyze(validImageB64, 'image/jpeg')
    expect(res).toEqual({ items: [], overall_confidence: 0 })
  })

  it('filters out malformed items', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                { name_ru: 'good', name_en_query: 'good', grams_estimate: 100, confidence: 0.9 },
                { name_ru: '',     name_en_query: 'bad',  grams_estimate: 50,  confidence: 0.5 },
                { name_ru: 'no-grams', name_en_query: 'x', grams_estimate: 0, confidence: 0.5 },
              ],
              overall_confidence: 0.7,
            }),
          },
        },
      ],
    })

    const res = await service.analyze(validImageB64, 'image/jpeg')
    expect(res.items).toHaveLength(1)
    expect(res.items[0].name_ru).toBe('good')
  })

  it('returns empty on invalid JSON content', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'not-json at all' } }],
    })

    const res = await service.analyze(validImageB64, 'image/jpeg')
    expect(res).toEqual({ items: [], overall_confidence: 0 })
  })

  it('wraps OpenAI errors into BadRequestException', async () => {
    mockCreate.mockRejectedValueOnce(new Error('rate limited'))
    await expect(service.analyze(validImageB64, 'image/jpeg')).rejects.toBeInstanceOf(BadRequestException)
  })
})
