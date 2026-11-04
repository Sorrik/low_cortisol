import { ChromaClient } from 'chromadb'
import fs from 'node:fs'
import path from 'node:path'

type SeedStage = 'fetch' | 'embed' | 'upsert' | 'all'
type SeedMode = 'recreate' | 'upsert'

interface PubMedArticle {
  pmid: string
  title: string
  abstract: string
  year: string
  metric: string
  authors: string
  journal: string
}

interface EmbeddedArticle {
  id: string
  document: string
  embedding: number[]
  metadata: {
    pmid: string
    title: string
    year: string
    authors: string
    journal: string
    metric: string
    url: string
  }
}

interface FetchCheckpoint {
  completedQueries: string[]
  articles: PubMedArticle[]
}

const SEARCH_QUERIES: Array<{ query: string; metric: string }> = [
  { query: 'sleep deprivation cortisol stress hormone', metric: 'sleep' },
  { query: 'sleep quality mood depression mental health', metric: 'sleep' },
  { query: 'chronic sleep restriction cognitive performance', metric: 'sleep' },
  { query: 'circadian rhythm sleep wake cycle health', metric: 'sleep' },
  { query: 'irregular sleep schedule circadian misalignment', metric: 'sleep' },
  { query: 'physical activity exercise depression anxiety', metric: 'activity' },
  { query: 'exercise stress reduction well-being', metric: 'activity' },
  { query: 'aerobic exercise sleep quality insomnia', metric: 'activity' },
  { query: 'evening exercise cortisol sleep disturbance', metric: 'activity' },
  { query: 'high intensity exercise cortisol overtraining HPA', metric: 'activity' },
  { query: 'psychological stress chronic health intervention', metric: 'stress' },
  { query: 'mindfulness meditation stress reduction cortisol', metric: 'stress' },
  { query: 'cortisol awakening response circadian rhythm HPA', metric: 'stress' },
  { query: 'chronic stress HPA axis dysregulation recovery', metric: 'stress' },
  { query: 'hydration water intake cognitive function', metric: 'water' },
  { query: 'dehydration fatigue mood performance', metric: 'water' },
  { query: 'nutrition diet mood mental health', metric: 'food' },
  { query: 'protein tryptophan serotonin mood', metric: 'food' },
  { query: 'meal timing circadian rhythm cortisol metabolism', metric: 'food' },
  { query: 'late night eating sleep quality cortisol insulin', metric: 'food' },
  { query: 'intermittent fasting cortisol stress HPA axis', metric: 'food' },
  { query: 'positive affect well-being happiness daily life', metric: 'mood' },
]

const DATA_DIR = path.resolve(__dirname, '../../../data/rag')
const CFG = {
  stage: (process.env.SEED_STAGE ?? 'all') as SeedStage,
  mode: (process.env.SEED_MODE ?? 'upsert') as SeedMode,
  chromaUrl: process.env.CHROMA_URL ?? 'http://localhost:8001',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  pubmedApiKey: process.env.PUBMED_API_KEY ?? '',
  collectionName: process.env.CHROMA_COLLECTION ?? 'health_articles',
  articlesPerQuery: parseInt(process.env.ARTICLES_PER_QUERY ?? '5', 10),
  upsertBatchSize: parseInt(process.env.SEED_BATCH_SIZE ?? '50', 10),
  embedBatchSize: parseInt(process.env.EMBED_BATCH_SIZE ?? '32', 10),
  maxRetries: parseInt(process.env.SEED_MAX_RETRIES ?? '4', 10),
  /**
   * Порог косинусного сходства для семантической дедупликации.
   * Статьи с similarity ≥ threshold относительно уже принятых (внутри одной
   * метрики) считаются дубликатами и не попадают в Chroma. Значение 0.97
   * подобрано консервативно: реальные near-duplicates PubMed (review citing
   * the same study, переиздания) обычно дают ≥ 0.97, оригинальные работы
   * в одной теме редко превышают 0.95.
   */
  dedupThreshold: parseFloat(process.env.SEED_DEDUP_THRESHOLD ?? '0.97'),
  pubmedDelayMs: process.env.PUBMED_DELAY_MS
    ? parseInt(process.env.PUBMED_DELAY_MS, 10)
    : process.env.PUBMED_API_KEY
      ? 110
      : 340,
  force: process.env.SEED_FORCE === '1',
  articlesFile: path.join(DATA_DIR, 'pubmed-articles.json'),
  embeddingsFile: path.join(DATA_DIR, 'pubmed-embeddings.json'),
  fetchCheckpointFile: path.join(DATA_DIR, 'fetch-checkpoint.json'),
} as const

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= CFG.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const waitMs = 500 * 2 ** (attempt - 1)
      console.warn(`  retry ${attempt}/${CFG.maxRetries} for ${label} in ${waitMs}ms`)
      await delay(waitMs)
    }
  }
  throw lastError
}

function stripTags(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function progressBar(done: number, total: number, width = 24): string {
  const safeTotal = Math.max(total, 1)
  const filled = Math.round((done / safeTotal) * width)
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}] ${done}/${total}`
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
  } catch {
    return null
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  ensureDataDir()
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8')
}

async function fetchPubMedIds(query: string, maxResults: number): Promise<string[]> {
  const term = `${query} AND hasabstract[text] AND ("2015"[pdat]:"2025"[pdat])`
  const params = new URLSearchParams({
    db: 'pubmed',
    term,
    retmax: String(maxResults),
    retmode: 'json',
    sort: 'relevance',
    ...(CFG.pubmedApiKey ? { api_key: CFG.pubmedApiKey } : {}),
  })

  return withRetry(async () => {
    const response = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params}`)
    if (!response.ok) throw new Error(`esearch HTTP ${response.status}`)
    const data = await response.json() as { esearchresult?: { idlist?: string[] } }
    return data.esearchresult?.idlist ?? []
  }, `esearch:${query}`)
}

async function fetchPubMedDetails(pmids: string[]): Promise<Array<Omit<PubMedArticle, 'metric'>>> {
  if (pmids.length === 0) return []

  const params = new URLSearchParams({
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'xml',
    rettype: 'abstract',
    ...(CFG.pubmedApiKey ? { api_key: CFG.pubmedApiKey } : {}),
  })

  return withRetry(async () => {
    const response = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${params}`)
    if (!response.ok) throw new Error(`efetch HTTP ${response.status}`)
    return parsePubMedXml(await response.text())
  }, `efetch:${pmids.join(',')}`)
}

function parsePubMedXml(xml: string): Array<Omit<PubMedArticle, 'metric'>> {
  const blocks = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) ?? []
  const articles: Array<Omit<PubMedArticle, 'metric'>> = []

  for (const block of blocks) {
    const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] ?? ''
    const title = stripTags(block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1] ?? '')
    const year = block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)?.[1] ?? ''

    const abstractParts = block.match(/<AbstractText[^>]*>[\s\S]*?<\/AbstractText>/g) ?? []
    const abstract = abstractParts
      .map(part => {
        const label = part.match(/Label="([^"]+)"/)?.[1]
        const content = stripTags(part)
        return label ? `${label}: ${content}` : content
      })
      .filter(Boolean)
      .join(' ')

    const authorBlocks = block.match(/<Author[^>]*>[\s\S]*?<\/Author>/g) ?? []
    const authors = authorBlocks
      .slice(0, 6)
      .map(part => {
        const lastName = stripTags(part.match(/<LastName>([\s\S]*?)<\/LastName>/)?.[1] ?? '')
        const initials = stripTags(part.match(/<Initials>([\s\S]*?)<\/Initials>/)?.[1] ?? '')
        return lastName ? `${lastName} ${initials}`.trim() : ''
      })
      .filter(Boolean)
      .join(', ')

    const journal = stripTags(
      block.match(/<ISOAbbreviation>([\s\S]*?)<\/ISOAbbreviation>/)?.[1]
      ?? block.match(/<Title>([\s\S]*?)<\/Title>/)?.[1]
      ?? '',
    )

    if (pmid && title && abstract.length > 100) {
      articles.push({ pmid, title, abstract, year, authors, journal })
    }
  }

  return articles
}

class OpenAIEmbedder {
  constructor(
    private readonly apiKey: string,
    private readonly baseURL: string,
  ) {}

  async generate(texts: string[]): Promise<number[][]> {
    return withRetry(async () => {
      const response = await fetch(`${this.baseURL}/embeddings`, {
        method: 'POST',
        signal: AbortSignal.timeout(60_000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: texts,
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`embedding HTTP ${response.status}: ${body.slice(0, 300)}`)
      }

      const data = await response.json() as { data?: Array<{ embedding: number[] }> }
      if (!Array.isArray(data.data)) {
        throw new Error('embedding response missing data[]')
      }
      return data.data.map(item => item.embedding)
    }, `embeddings:${texts.length}`)
  }
}

function makeChromaClient(url: string): ChromaClient {
  const parsed = new URL(url)
  const ssl = parsed.protocol === 'https:'
  const host = parsed.hostname
  const port = parseInt(parsed.port, 10) || (ssl ? 443 : 8000)
  return new ChromaClient({ ssl, host, port } as never)
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Семантическая дедупликация: для каждой метрики сортируем статьи по году
 * (новее → приоритетнее) и оставляем только те, чьё косинусное сходство со
 * всеми ранее принятыми в этой же метрике ниже порога. Дедуплицируем внутри
 * метрики, а не глобально, чтобы не терять кросс-доменные статьи (sleep ↔
 * stress часто близки, но обе нужны для разных триггеров).
 */
function deduplicateBySemanticSimilarity(
  embedded: EmbeddedArticle[],
  threshold: number,
): { kept: EmbeddedArticle[]; dropped: number } {
  const byMetric = new Map<string, EmbeddedArticle[]>()
  for (const item of embedded) {
    const metric = item.metadata.metric
    if (!byMetric.has(metric)) byMetric.set(metric, [])
    byMetric.get(metric)!.push(item)
  }

  const kept: EmbeddedArticle[] = []
  let dropped = 0

  for (const [metric, items] of byMetric) {
    const sorted = [...items].sort((a, b) =>
      (b.metadata.year || '0').localeCompare(a.metadata.year || '0'),
    )
    const acceptedInMetric: EmbeddedArticle[] = []

    for (const candidate of sorted) {
      const tooSimilar = acceptedInMetric.some(accepted =>
        cosineSimilarity(candidate.embedding, accepted.embedding) >= threshold,
      )
      if (tooSimilar) {
        dropped++
        continue
      }
      acceptedInMetric.push(candidate)
    }

    kept.push(...acceptedInMetric)
    console.log(
      `  dedup [${metric}]: ${items.length} -> ${acceptedInMetric.length} ` +
      `(removed ${items.length - acceptedInMetric.length})`,
    )
  }

  return { kept, dropped }
}

function buildDocument(article: PubMedArticle): string {
  return [
    `Title: ${article.title}`,
    article.authors ? `Authors: ${article.authors}` : '',
    article.journal ? `Journal: ${article.journal}` : '',
    article.year ? `Year: ${article.year}` : '',
    `Abstract: ${article.abstract}`,
  ].filter(Boolean).join('\n')
}

async function runFetch(): Promise<PubMedArticle[]> {
  ensureDataDir()

  if (!CFG.force) {
    const existing = readJsonFile<PubMedArticle[]>(CFG.articlesFile)
    if (existing && existing.length > 0) {
      console.log(`Using cached articles file: ${CFG.articlesFile} (${existing.length} articles)`)
      return existing
    }
  }

  const checkpoint = readJsonFile<FetchCheckpoint>(CFG.fetchCheckpointFile) ?? {
    completedQueries: [],
    articles: [],
  }

  const seenPmids = new Set(checkpoint.articles.map(article => article.pmid))

  for (let index = 0; index < SEARCH_QUERIES.length; index++) {
    const { query, metric } = SEARCH_QUERIES[index]
    if (checkpoint.completedQueries.includes(query)) {
      console.log(`  skip ${query}`)
      continue
    }

    process.stdout.write(`  ${progressBar(index, SEARCH_QUERIES.length)} ${metric} `)
    let added = 0

    try {
      const pmids = await fetchPubMedIds(query, CFG.articlesPerQuery)
      await delay(CFG.pubmedDelayMs)
      const articles = await fetchPubMedDetails(pmids)
      await delay(CFG.pubmedDelayMs)

      for (const article of articles) {
        if (!seenPmids.has(article.pmid)) {
          seenPmids.add(article.pmid)
          checkpoint.articles.push({ ...article, metric })
          added += 1
        }
      }

      checkpoint.completedQueries.push(query)
      writeJsonFile(CFG.fetchCheckpointFile, checkpoint)
      console.log(`+${added} total=${checkpoint.articles.length}`)
    } catch (error) {
      console.log(`error: ${error}`)
    }
  }

  if (checkpoint.articles.length === 0) {
    throw new Error('No PubMed articles fetched')
  }

  writeJsonFile(CFG.articlesFile, checkpoint.articles)
  if (fs.existsSync(CFG.fetchCheckpointFile)) fs.unlinkSync(CFG.fetchCheckpointFile)

  console.log(`Saved articles -> ${CFG.articlesFile}`)
  return checkpoint.articles
}

async function runEmbed(): Promise<EmbeddedArticle[]> {
  ensureDataDir()

  const articles = readJsonFile<PubMedArticle[]>(CFG.articlesFile)
  if (!articles || articles.length === 0) {
    throw new Error(`Articles file not found or empty: ${CFG.articlesFile}`)
  }

  const existing = !CFG.force
    ? readJsonFile<EmbeddedArticle[]>(CFG.embeddingsFile) ?? []
    : []
  const embeddedById = new Map(existing.map(item => [item.id, item]))
  const embedder = new OpenAIEmbedder(CFG.openaiApiKey, CFG.openaiBaseUrl)

  if (!CFG.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required for embed stage')
  }

  const pending = articles.filter(article => !embeddedById.has(`pmid_${article.pmid}`))
  console.log(`Embedding pending: ${pending.length}, cached: ${embeddedById.size}`)

  for (let index = 0; index < pending.length; index += CFG.embedBatchSize) {
    const batch = pending.slice(index, index + CFG.embedBatchSize)
    const documents = batch.map(buildDocument)
    const embeddings = await embedder.generate(documents)

    for (let offset = 0; offset < batch.length; offset++) {
      const article = batch[offset]
      const id = `pmid_${article.pmid}`
      embeddedById.set(id, {
        id,
        document: documents[offset],
        embedding: embeddings[offset],
        metadata: {
          pmid: article.pmid,
          title: article.title,
          year: article.year,
          authors: article.authors,
          journal: article.journal,
          metric: article.metric,
          url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
        },
      })
    }

    writeJsonFile(CFG.embeddingsFile, [...embeddedById.values()])
    console.log(`  ${progressBar(Math.min(index + batch.length, pending.length), pending.length)} embedded`)
  }

  const embedded = [...embeddedById.values()].sort((a, b) => a.id.localeCompare(b.id))
  writeJsonFile(CFG.embeddingsFile, embedded)
  console.log(`Saved embeddings -> ${CFG.embeddingsFile}`)
  return embedded
}

async function runUpsert(): Promise<void> {
  ensureDataDir()

  const embedded = readJsonFile<EmbeddedArticle[]>(CFG.embeddingsFile)
  if (!embedded || embedded.length === 0) {
    throw new Error(`Embeddings file not found or empty: ${CFG.embeddingsFile}`)
  }

  console.log(`Semantic dedup (threshold=${CFG.dedupThreshold}):`)
  const { kept, dropped } = deduplicateBySemanticSimilarity(embedded, CFG.dedupThreshold)
  console.log(`  total: ${embedded.length} -> ${kept.length} (removed ${dropped})`)

  const chroma = makeChromaClient(CFG.chromaUrl)
  let collection: Awaited<ReturnType<typeof chroma.createCollection>>

  if (CFG.mode === 'recreate') {
    try {
      await chroma.deleteCollection({ name: CFG.collectionName })
      console.log(`Deleted old collection: ${CFG.collectionName}`)
    } catch {}

    collection = await chroma.createCollection({
      name: CFG.collectionName,
      metadata: { description: 'PubMed health articles for RAG', 'hnsw:space': 'cosine' } as any,
    })
  } else {
    collection = await chroma.getOrCreateCollection({
      name: CFG.collectionName,
      metadata: { description: 'PubMed health articles for RAG', 'hnsw:space': 'cosine' } as any,
    })
  }

  for (let index = 0; index < kept.length; index += CFG.upsertBatchSize) {
    const batch = kept.slice(index, index + CFG.upsertBatchSize)
    await withRetry(() => collection.upsert({
      ids: batch.map(item => item.id),
      documents: batch.map(item => item.document),
      metadatas: batch.map(item => item.metadata),
      embeddings: batch.map(item => item.embedding),
    }), `chroma-upsert:${index / CFG.upsertBatchSize + 1}`)

    console.log(`  ${progressBar(Math.min(index + batch.length, kept.length), kept.length)} upserted`)
  }

  console.log(`Collection ready: ${CFG.collectionName}`)
}

async function main() {
  ensureDataDir()

  console.log('PubMed -> ChromaDB seed')
  console.log(`Stage: ${CFG.stage}`)
  console.log(`Mode: ${CFG.mode}`)
  console.log(`Data dir: ${DATA_DIR}`)
  console.log(`Articles/query: ${CFG.articlesPerQuery}`)
  console.log(`Embed batch: ${CFG.embedBatchSize}`)
  console.log(`Upsert batch: ${CFG.upsertBatchSize}`)
  console.log(`Force: ${CFG.force ? 'yes' : 'no'}`)
  console.log('')

  switch (CFG.stage) {
    case 'fetch':
      await runFetch()
      break
    case 'embed':
      await runEmbed()
      break
    case 'upsert':
      await runUpsert()
      break
    case 'all':
    default:
      await runFetch()
      await runEmbed()
      await runUpsert()
      break
  }
}

main().catch(error => {
  console.error('Seed failed:', error)
  process.exit(1)
})
