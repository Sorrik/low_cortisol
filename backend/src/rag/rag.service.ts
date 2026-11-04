// backend/src/rag/rag.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ChromaClient, Collection, EmbeddingFunction } from 'chromadb'

// Заголовки и аннотации PubMed иногда содержат HTML-сущности, например A&#x3b2;.
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase()
    if (!lower.startsWith('#')) return NAMED_ENTITIES[lower] ?? match
    const code = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10)
    return code <= 0x10ffff ? String.fromCodePoint(code) : match
  })
}

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
 * Эмбеддер на базе OpenAI text-embedding-3-small (1536-dim).
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

    const topics = buildRagTopics(healthSummary)
    this.logger.log(`[findRelevantArticles] topics: ${topics.map(t => `${t.metric}: ${t.query}`).join(' | ')}`)

    try {
      const collection = this.collection
      // Каждую тему ищем только среди статей этой метрики, чтобы одна тема не вытесняла другие.
      const results = await Promise.all(topics.map(topic => collection.query({
        queryTexts: [topic.query],
        nResults: this.TOP_K,
        where: { metric: topic.metric },
        include: ['documents', 'metadatas', 'distances'] as any,
      })))

      const seen = new Set<string>()
      const articles = results
        .flatMap(result => this._rankByRelevance(result))
        .filter(article => !seen.has(article.pmid) && Boolean(seen.add(article.pmid)))
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

  private _rankByRelevance(results: any): RelevantArticle[] {
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
        const abstract = decodeHtmlEntities(doc.replace(/^Title:.*?\n\nAbstract:\s*/s, '')).slice(0, 800)

        articles.push({
          pmid: String(pmid),
          title: decodeHtmlEntities(String(meta?.title ?? '')),
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

    return articles.sort((a, b) => b.relevance - a.relevance)
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
  /** Доля нехватки от личной нормы: 0.25 значит на четверть меньше нормы. */
  calorieDeficit: number
  proteinDeficit: number
  waterDeficit: number
  sleepGoalHours: number
}

export interface RagTopic {
  metric: string
  query: string
}

const MAX_RAG_TOPICS = 4

/** Темы поиска статей: сначала самые серьёзные проблемы относительно личной нормы. */
export function buildRagTopics(ctx: HealthQueryContext): RagTopic[] {
  const scored: (RagTopic & { score: number })[] = []
  const add = (score: number, metric: string, query: string) => scored.push({ score, metric, query })

  if (ctx.calorieDeficit <= -0.5) {
    add(-ctx.calorieDeficit, 'food', 'excess calorie intake overeating health')
  } else if (ctx.calorieDeficit >= 0.1) {
    add(ctx.calorieDeficit, 'food', 'low energy intake undereating fatigue mood')
  }
  if (ctx.proteinDeficit >= 0.1 && ctx.proteinDeficit > ctx.calorieDeficit) {
    add(ctx.proteinDeficit, 'food', 'low dietary protein intake adults mood muscle')
  }
  if (ctx.waterDeficit >= 0.1) {
    add(ctx.waterDeficit, 'water', 'low water intake dehydration mood fatigue')
  }
  if (ctx.avgSleepHours > 0 && ctx.avgSleepHours < ctx.sleepGoalHours) {
    const shortfall = (ctx.sleepGoalHours - ctx.avgSleepHours) / ctx.sleepGoalHours
    add(shortfall, 'sleep', 'short sleep duration fatigue mood adults')
  }
  if (ctx.avgStress >= 5) {
    add((ctx.avgStress - 4) / 10, 'stress', 'chronic stress reduction relaxation adults')
  }
  if (ctx.avgMood > 0 && ctx.avgMood < 6) {
    add((6 - ctx.avgMood) / 6, 'mood', 'low mood lifestyle intervention adults')
  }
  if (ctx.avgActivityMinutes < 30) {
    add((30 - ctx.avgActivityMinutes) / 60, 'activity', 'physical activity mood energy sedentary adults')
  }

  const topics = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RAG_TOPICS)
    .map(({ metric, query }) => ({ metric, query }))
  if (topics.length > 0) return topics

  // Если всё в норме, ищем статьи о поддержании хороших привычек.
  return [
    { metric: 'sleep', query: 'healthy sleep quality circadian rhythm benefits' },
    { metric: 'activity', query: 'regular physical activity benefits mood well-being' },
    { metric: 'mood', query: 'positive affect well-being happiness daily life' },
  ]
}
