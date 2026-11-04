// backend/src/rag/rag.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ChromaClient, Collection, EmbeddingFunction } from 'chromadb'

export interface RelevantArticle {
  pmid: string
  title: string
  abstract: string
  year: string
  metric: string
  url: string
  relevance: number
}

/**
 * Эмбеддер на базе OpenAI text-embedding-3-small (1536-dim). По умолчанию
 * ходит через proxyapi.ru — выходит ~0,02 ₽ на полный пересев корпуса.
 * Используется как embedding-функция коллекции ChromaDB: при поиске
 * запрос пользователя проходит тот же преобразователь, что и аннотации
 * при сидинге, иначе косинусное расстояние теряет смысл.
 */
class OpenAIEmbedder implements EmbeddingFunction {
  constructor(
    private readonly apiKey: string,
    private readonly baseURL: string,
    private readonly model: string = 'text-embedding-3-small',
  ) {}

  async generate(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    const res = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`OpenAI embeddings failed (${res.status}): ${body.slice(0, 300)}`)
    }
    const data = await res.json() as any
    if (!Array.isArray(data?.data)) {
      throw new Error('OpenAI embeddings: payload missing data[]')
    }
    return data.data.map((d: any) => d.embedding as number[])
  }
}

function makeChromaClient(url: string): ChromaClient {
  const parsed = new URL(url)
  const ssl = parsed.protocol === 'https:'
  const host = parsed.hostname
  const port = parseInt(parsed.port) || (ssl ? 443 : 8000)
  return new ChromaClient({ ssl, host, port } as any)
}

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name)
  private client: ChromaClient
  private embedder: EmbeddingFunction
  private collection: Collection | null = null
  private lastEnsureAttemptAt = 0

  private readonly COLLECTION_NAME = 'health_articles'
  private readonly TOP_K = 3
  private readonly RECONNECT_COOLDOWN_MS = 60_000

  /**
   * Cosine-distance в ChromaDB для нерелевантных статей быстро уходит к ~1.
   * Берём верхнюю границу: всё с distance > этого значения считаем
   * нерелевантным и не отдаём в LLM. На семантически близких статьях
   * distance обычно < 0.5–0.7. 0.85 — порог между «может пригодиться» и
   * «явный шум». Можно переопределить через env RAG_MAX_DISTANCE.
   */
  private readonly maxDistance: number

  constructor(private readonly config: ConfigService) {
    const chromaUrl = this.config.get<string>('CHROMA_URL', 'http://chromadb:8000')
    this.client = makeChromaClient(chromaUrl)

    this.embedder = new OpenAIEmbedder(
      this.config.get<string>('OPENAI_API_KEY', ''),
      this.config.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      this.config.get<string>('OPENAI_EMBEDDINGS_MODEL', 'text-embedding-3-small'),
    )

    const raw = Number(this.config.get<string>('RAG_MAX_DISTANCE', '0.9'))
    this.maxDistance = Number.isFinite(raw) && raw > 0 ? raw : 0.9
  }

  async onModuleInit() {
    await this._ensureCollection('onModuleInit')
  }

  async findRelevantArticles(healthSummary: HealthQueryContext): Promise<RelevantArticle[]> {
    const ready = await this._ensureCollection('findRelevantArticles')
    if (!ready || !this.collection) {
      this.logger.warn('[findRelevantArticles] collection unavailable -> skipping RAG')
      return []
    }

    const queries = this._buildSemanticQueries(healthSummary)
    this.logger.log(`[findRelevantArticles] queries: ${queries.join(' | ')}`)

    try {
      const results = await this.collection.query({
        queryTexts: queries,
        nResults: this.TOP_K,
        include: ['documents', 'metadatas', 'distances'] as any,
      })

      const articles = this._deduplicateAndRank(results)
      this.logger.log(`[findRelevantArticles] found ${articles.length} articles`)
      return articles
    } catch (err) {
      this.collection = null
      this.logger.error(`[findRelevantArticles] ChromaDB query failed: ${err}`)
      return []
    }
  }

  private async _ensureCollection(source: string): Promise<boolean> {
    if (this.collection) return true

    const now = Date.now()
    if (now - this.lastEnsureAttemptAt < this.RECONNECT_COOLDOWN_MS) {
      return false
    }
    this.lastEnsureAttemptAt = now

    try {
      this.collection = await this.client.getCollection({
        name: this.COLLECTION_NAME,
        embeddingFunction: this.embedder,
      })
      const count = await this.collection.count()
      this.logger.log(`[${source}] ChromaDB collection ready -> ${count} articles`)
      return true
    } catch (err) {
      this.collection = null
      this.logger.warn(`[${source}] ChromaDB unavailable or collection missing: ${err}`)
      return false
    }
  }

  private _buildSemanticQueries(ctx: HealthQueryContext): string[] {
    const queries: string[] = []

    // Проблемные сценарии — пороги смягчены, чтобы покрыть и
    // «субоптимальные» состояния (сон 7-7.5ч и т.п.), которые в карточках
    // могут оказаться attention/alert по личной норме.
    if (ctx.avgSleepHours < 6)        queries.push('sleep deprivation health consequences cortisol mood')
    else if (ctx.avgSleepHours < 7.5) queries.push('insufficient sleep cognitive performance well-being')

    if (ctx.avgStress >= 5)           queries.push('chronic stress cortisol reduction intervention')
    if (ctx.avgActivityMinutes < 30)  queries.push('physical activity exercise mental health depression')
    if (ctx.avgWaterGlasses < 8)      queries.push('dehydration cognitive function mood fatigue')
    if (ctx.avgMood < 6)              queries.push('low mood intervention lifestyle mental health')

    // Питание: дефицит белка ИЛИ низкая калорийность
    if (ctx.avgProteinGrams > 0 && ctx.avgProteinGrams < 70) {
      queries.push('protein intake mood serotonin tryptophan deficiency')
    }
    if (ctx.avgCalories > 0 && ctx.avgCalories < 1500) {
      queries.push('caloric restriction fatigue mood cognitive function')
    }

    // Если всё в норме — ищем статьи про поддержание хороших привычек,
    // чтобы и good-карточки имели научную подложку
    if (queries.length === 0) {
      if (ctx.avgSleepHours >= 7)       queries.push('healthy sleep quality circadian rhythm benefits')
      if (ctx.avgActivityMinutes >= 20) queries.push('regular physical activity benefits mood well-being')
      if (ctx.avgMood >= 7)             queries.push('positive affect well-being happiness daily life')
      if (queries.length === 0)         queries.push('lifestyle health optimization well-being')
    }

    return queries.slice(0, 3)
  }

  private _deduplicateAndRank(results: any): RelevantArticle[] {
    const seen = new Set<string>()
    const articles: RelevantArticle[] = []
    let droppedCount = 0

    const docsList = results.documents ?? []
    const metasList = results.metadatas ?? []
    const distsList = results.distances ?? []

    for (let q = 0; q < docsList.length; q++) {
      const docs = docsList[q] ?? []
      const metas = metasList[q] ?? []
      const dists = distsList[q] ?? []

      for (let i = 0; i < docs.length; i++) {
        const meta = metas[i] as any
        const pmid = meta?.pmid
        if (!pmid || seen.has(pmid)) continue

        const distance = Number(dists[i] ?? 1)

        // Distance threshold: нерелевантные статьи в LLM-промпт не идут.
        // Без этого LLM может процитировать явный шум как «исследование».
        if (distance > this.maxDistance) {
          droppedCount++
          continue
        }

        seen.add(pmid)

        const relevance = Math.max(0, 1 - distance / 2)
        const doc = docs[i] ?? ''
        const abstract = doc.replace(/^Title:.*?\n\nAbstract:\s*/s, '').slice(0, 800)

        articles.push({
          pmid: String(pmid),
          title: String(meta?.title ?? ''),
          abstract,
          year: String(meta?.year ?? ''),
          metric: String(meta?.metric ?? ''),
          url: String(meta?.url ?? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`),
          relevance: Math.round(relevance * 100) / 100,
        })
      }
    }

    if (droppedCount > 0) {
      this.logger.log(
        `[rag] dropped ${droppedCount} articles by distance > ${this.maxDistance}`,
      )
    }

    return articles.sort((a, b) => b.relevance - a.relevance).slice(0, 3)
  }
}

export interface HealthQueryContext {
  avgSleepHours: number
  avgStress: number
  avgMood: number
  avgActivityMinutes: number
  avgWaterGlasses: number
  avgCalories: number
  avgProteinGrams: number
}
