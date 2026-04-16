// backend/src/llm/llm.service.ts

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService }      from '@nestjs/config'
import OpenAI                 from 'openai'
import {
  buildRecommendationPrompt,
  extractHealthContext,
  MlPrediction,
} from './prompt-builder'
import { RecommendationDto }  from '../ml/dto/ml-response.dto'
import { RagService }         from '../rag/rag.service'

// ── Типы ─────────────────────────────────────────────────────

export interface ArticleSource {
  index: number
  pmid:  string
  title: string
  year:  string
  url:   string
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
    // gpt-4.1-mini — быстрее и дешевле gpt-4o-mini
    this.model = this.config.get<string>('LLM_MODEL', 'gpt-4.1-mini')
  }

  // ── Главный метод ─────────────────────────────────────────
  //
  // mlPrediction — опциональный: приходит из InsightsService после
  // вызова ML-сервиса. Если null (cold_start) — промпт строится
  // без SHAP блока, только на rule-based данных.

  async getRecommendations(
    healthData:    any,
    mlPrediction?: MlPrediction | null,
  ): Promise<RecommendationsResult> {
    this.logger.log(
      `[getRecommendations] model=${this.model}, ` +
      `ml_phase=${mlPrediction?.phase_mode ?? 'none'}, ` +
      `shap_factors=${mlPrediction?.top_influencers?.length ?? 0}`
    )

    // ── RAG: находим релевантные статьи
    const healthContext = extractHealthContext(healthData)
    const articles      = await this.ragService.findRelevantArticles(healthContext)

    if (articles.length > 0) {
      this.logger.log(
        `[getRecommendations] RAG нашёл ${articles.length} статей: ` +
        articles.map(a => `PMID:${a.pmid}`).join(', ')
      )
    }

    // ── Источники для фронтенда
    const sources: ArticleSource[] = articles.map((a, i) => ({
      index: i + 1,
      pmid:  a.pmid,
      title: a.title,
      year:  a.year,
      url:   `https://europepmc.org/article/MED/${a.pmid}`,
    }))

    // ── Строим промпт: данные + SHAP + RAG
    const promptPayload = buildRecommendationPrompt(
      healthData,
      articles,
      mlPrediction ?? undefined,
    )
    const { system, user } = JSON.parse(promptPayload)

    this.logger.debug(`[getRecommendations] prompt preview: ${user.slice(0, 300)}...`)

    try {
      const response = await this.client.chat.completions.create({
        model:       this.model,
        temperature: 0.2,
        max_tokens:  800,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user   },
        ],
      })

      const raw = response.choices[0]?.message?.content ?? ''

      this.logger.log(
        `[getRecommendations] tokens: ` +
        `prompt=${response.usage?.prompt_tokens}, ` +
        `completion=${response.usage?.completion_tokens}`
      )

      const recommendations = this._parseResponse(raw)
      return { recommendations, sources }

    } catch (err) {
      this.logger.error(`[getRecommendations] OpenAI error: ${err}`)
      throw err
    }
  }

  // ── Парсинг ответа ────────────────────────────────────────

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

      const VALID_METRICS    = ['sleep', 'mood', 'stress', 'activity', 'water', 'food']
      const VALID_SEVERITIES = ['good', 'attention', 'alert']

      const valid = recs.filter((r: any) => {
        const ok =
          typeof r.metric      === 'string' &&
          typeof r.severity    === 'string' &&
          typeof r.title       === 'string' &&
          typeof r.description === 'string' &&
          VALID_METRICS.includes(r.metric)   &&
          VALID_SEVERITIES.includes(r.severity)

        if (!ok) {
          this.logger.warn(`[_parseResponse] невалидная: ${JSON.stringify(r)}`)
        }
        return ok
      })

      this.logger.log(`[_parseResponse] получено ${recs.length}, валидных ${valid.length}`)
      return valid as RecommendationDto[]

    } catch (err) {
      this.logger.error(`[_parseResponse] ошибка парсинга: ${err}`)
      return []
    }
  }
}