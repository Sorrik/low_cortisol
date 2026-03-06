// backend/src/rag/rag.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService }                    from '@nestjs/config'
import { ChromaClient, EmbeddingFunction, Collection } from 'chromadb'

export interface RelevantArticle {
  pmid:      string
  title:     string
  abstract:  string
  year:      string
  metric:    string
  url:       string
  relevance: number
}

// ── Своя реализация эмбеддингов ───────────────────────────────
class OpenAIEmbedder implements EmbeddingFunction {
  constructor(
    private readonly apiKey:  string,
    private readonly baseURL: string,
  ) {}

  async generate(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseURL}/embeddings`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts,
      }),
    })
    const data = await res.json() as any
    return data.data.map((d: any) => d.embedding)
  }
}

// ── Хелпер для парсинга URL → host/port ──────────────────────
function makeChromaClient(url: string): ChromaClient {
  const parsed = new URL(url)
  const ssl    = parsed.protocol === 'https:'
  const host   = parsed.hostname
  const port   = parseInt(parsed.port) || (ssl ? 443 : 8000)
  return new ChromaClient({ ssl, host, port } as any)
}

// ─────────────────────────────────────────────────────────────

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name)
  private client:     ChromaClient
  private embedder:   OpenAIEmbedder
  private collection: Collection | null = null

  private readonly COLLECTION_NAME = 'health_articles'
  private readonly TOP_K           = 3

  constructor(private readonly config: ConfigService) {
    const chromaUrl = this.config.get<string>('CHROMA_URL', 'http://chromadb:8000')
    this.client     = makeChromaClient(chromaUrl)

    this.embedder = new OpenAIEmbedder(
      this.config.get<string>('OPENAI_API_KEY', ''),
      this.config.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
    )
  }

  async onModuleInit() {
    try {
      this.collection = await this.client.getCollection({
        name:              this.COLLECTION_NAME,
        embeddingFunction: this.embedder,
      })
      const count = await this.collection.count()
      this.logger.log(`[onModuleInit] ChromaDB подключён → ${count} статей в коллекции`)
    } catch (err) {
      this.logger.warn(`[onModuleInit] ChromaDB недоступен или коллекция не создана: ${err}`)
      this.logger.warn('[onModuleInit] RAG отключён — запусти seed скрипт')
      this.collection = null
    }
  }

  async findRelevantArticles(healthSummary: HealthQueryContext): Promise<RelevantArticle[]> {
    if (!this.collection) {
      this.logger.warn('[findRelevantArticles] коллекция недоступна → пропускаем RAG')
      return []
    }

    const queries = this._buildSemanticQueries(healthSummary)
    this.logger.log(`[findRelevantArticles] запросы: ${queries.join(' | ')}`)

    try {
      const results = await this.collection.query({
        queryTexts: queries,
        nResults:   this.TOP_K,
        include:    ['documents', 'metadatas', 'distances'] as any,
      })

      const articles = this._deduplicateAndRank(results)
      this.logger.log(`[findRelevantArticles] найдено ${articles.length} статей`)
      return articles

    } catch (err) {
      this.logger.error(`[findRelevantArticles] ошибка ChromaDB: ${err}`)
      return []
    }
  }

  private _buildSemanticQueries(ctx: HealthQueryContext): string[] {
    const queries: string[] = []

    if (ctx.avgSleepHours < 6)        queries.push('sleep deprivation health consequences cortisol mood')
    else if (ctx.avgSleepHours < 7)   queries.push('insufficient sleep cognitive performance well-being')
    if (ctx.avgStress > 6)            queries.push('chronic stress cortisol reduction intervention')
    if (ctx.avgActivityMinutes < 20)  queries.push('physical activity exercise mental health depression')
    if (ctx.avgWaterGlasses < 6)      queries.push('dehydration cognitive function mood fatigue')
    if (ctx.avgMood < 5)              queries.push('low mood intervention lifestyle mental health')

    if (queries.length === 0) queries.push('lifestyle health optimization well-being')

    return queries.slice(0, 3)
  }

  private _deduplicateAndRank(results: any): RelevantArticle[] {
    const seen     = new Set<string>()
    const articles: RelevantArticle[] = []

    const docsList  = results.documents  ?? []
    const metasList = results.metadatas  ?? []
    const distsList = results.distances  ?? []

    for (let q = 0; q < docsList.length; q++) {
      const docs  = docsList[q]  ?? []
      const metas = metasList[q] ?? []
      const dists = distsList[q] ?? []

      for (let i = 0; i < docs.length; i++) {
        const meta = metas[i] as any
        const pmid = meta?.pmid
        if (!pmid || seen.has(pmid)) continue
        seen.add(pmid)

        const distance  = dists[i] ?? 1
        const relevance = Math.max(0, 1 - distance / 2)
        const doc       = docs[i] ?? ''
        const abstract  = doc.replace(/^Title:.*?\n\nAbstract:\s*/s, '').slice(0, 800)

        articles.push({
          pmid:      String(pmid),
          title:     String(meta?.title  ?? ''),
          abstract,
          year:      String(meta?.year   ?? ''),
          metric:    String(meta?.metric ?? ''),
          url:       String(meta?.url    ?? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`),
          relevance: Math.round(relevance * 100) / 100,
        })
      }
    }

    return articles.sort((a, b) => b.relevance - a.relevance).slice(0, 3)
  }
}

export interface HealthQueryContext {
  avgSleepHours:      number
  avgStress:          number
  avgMood:            number
  avgActivityMinutes: number
  avgWaterGlasses:    number
}