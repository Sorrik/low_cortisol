// backend/src/llm/llm.service.ts

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService }      from '@nestjs/config'
import OpenAI                 from 'openai'
import { buildRecommendationPrompt, extractHealthContext } from './prompt-builder'
import { RecommendationDto }  from '../ml/dto/ml-response.dto'
import { RagService, RelevantArticle } from '../rag/rag.service'

// ── Типы ─────────────────────────────────────────────────────

export interface ArticleSource {
  index: number   // номер [1], [2], [3] в тексте рекомендаций
  pmid:  string
  title: string
  year:  string
  url:   string   // Europe PMC — доступен в РФ
}

export interface RecommendationsResult {
  recommendations: RecommendationDto[]
  sources:         ArticleSource[]
}

// ─────────────────────────────────────────────────────────────

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name)
  private readonly client: OpenAI
  private readonly model:  string

  constructor(
    private readonly config:     ConfigService,
    private readonly ragService: RagService,
  ) {
    this.client = new OpenAI({
      apiKey:  this.config.get<string>('OPENAI_API_KEY'),
      baseURL: this.config.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
    })
    this.model = this.config.get<string>('LLM_MODEL', 'gpt-4o-mini')
  }

  async getRecommendations(healthData: any): Promise<RecommendationsResult> {
    this.logger.log(`[getRecommendations] model=${this.model}`)

    const healthContext = extractHealthContext(healthData)
    const articles      = await this.ragService.findRelevantArticles(healthContext)

    if (articles.length > 0) {
      this.logger.log(
        `[getRecommendations] RAG нашёл ${articles.length} статей: ` +
        articles.map(a => `PMID:${a.pmid} (${a.relevance})`).join(', ')
      )
    } else {
      this.logger.log('[getRecommendations] RAG статей не найдено')
    }

    // Нумерация [1][2][3] совпадает с порядком статей в промпте
    const sources: ArticleSource[] = articles.map((a, i) => ({
      index: i + 1,
      pmid:  a.pmid,
      title: a.title,
      year:  a.year,
      url:   `https://europepmc.org/article/MED/${a.pmid}`,
    }))

    const promptPayload = buildRecommendationPrompt(healthData, articles)
    const { system, user } = JSON.parse(promptPayload)

    try {
      const response = await this.client.chat.completions.create({
        model:       this.model,
        temperature: 0.4,
        max_tokens:  1200,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user   },
        ],
      })

      const raw = response.choices[0]?.message?.content ?? ''
      this.logger.log(`[getRecommendations] usage=${JSON.stringify(response.usage)}`)

      const recommendations = this._parseResponse(raw)
      return { recommendations, sources }

    } catch (err) {
      this.logger.error(`[getRecommendations] OpenAI error: ${err}`)
      throw err
    }
  }

  private _parseResponse(raw: string): RecommendationDto[] {
    try {
      const cleaned = raw
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      const parsed = JSON.parse(cleaned)
      const recs   = parsed?.recommendations

      if (!Array.isArray(recs)) {
        this.logger.warn('[_parseResponse] recommendations не массив')
        return []
      }

      const valid = recs.filter((r: any) => {
        const hasFields =
          typeof r.metric      === 'string' &&
          typeof r.severity    === 'string' &&
          typeof r.title       === 'string' &&
          typeof r.description === 'string'

        const validMetric   = ['sleep','mood','stress','activity','water','food'].includes(r.metric)
        const validSeverity = ['good','attention','alert'].includes(r.severity)

        if (!hasFields || !validMetric || !validSeverity) {
          this.logger.warn(`[_parseResponse] невалидная: ${JSON.stringify(r)}`)
          return false
        }
        return true
      })

      this.logger.log(`[_parseResponse] получено ${recs.length}, валидных ${valid.length}`)
      return valid as RecommendationDto[]

    } catch (err) {
      this.logger.error(`[_parseResponse] ошибка парсинга: ${err}`)
      return []
    }
  }
}