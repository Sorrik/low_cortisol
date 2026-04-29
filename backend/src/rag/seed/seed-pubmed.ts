// backend/src/rag/seed/seed-pubmed.ts
//
// Запуск (PowerShell):
//   $env:OPENAI_API_KEY="sk-..."
//   $env:OPENAI_BASE_URL="https://api.openai.com/v1"
//   $env:CHROMA_URL="http://localhost:8001"
//   npx ts-node -r tsconfig-paths/register src/rag/seed/seed-pubmed.ts
//
// Флаги (env):
//   SEED_MODE=upsert   — не удалять коллекцию, только добавить новые статьи
//   SEED_CHECKPOINT=1  — сохранять прогресс в seed-checkpoint.json (resume после краша)
//   PUBMED_API_KEY=... — увеличивает лимит с 3 до 10 req/s
//   ARTICLES_PER_QUERY=5 — кол-во статей на запрос

import { ChromaClient, EmbeddingFunction } from 'chromadb'
import fs from 'fs'
import path from 'path'

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const CFG = {
  chromaUrl:       process.env.CHROMA_URL          ?? 'http://localhost:8001',
  openaiApiKey:    process.env.OPENAI_API_KEY       ?? '',
  openaiBaseUrl:   process.env.OPENAI_BASE_URL      ?? 'https://api.openai.com/v1',
  pubmedApiKey:    process.env.PUBMED_API_KEY        ?? '',          // optional, raises rate-limit to 10/s
  collectionName:  'health_articles',
  articlesPerQuery: parseInt(process.env.ARTICLES_PER_QUERY ?? '5'),
  batchSize:        50,
  mode:            (process.env.SEED_MODE ?? 'recreate') as 'recreate' | 'upsert',
  checkpoint:       Boolean(process.env.SEED_CHECKPOINT),
  checkpointFile:   path.resolve('seed-checkpoint.json'),
  /** PubMed rate: 3 req/s without key, 10 req/s with key */
  pubmedDelay:     () => CFG.pubmedApiKey ? 110 : 340,  // ms between requests
  maxRetries:       4,
} as const

// ─────────────────────────────────────────────────────────────
// Search queries
// ─────────────────────────────────────────────────────────────

const SEARCH_QUERIES: Array<{ query: string; metric: string }> = [
  // Sleep
  { query: 'sleep deprivation cortisol stress hormone',         metric: 'sleep'    },
  { query: 'sleep quality mood depression mental health',       metric: 'sleep'    },
  { query: 'chronic sleep restriction cognitive performance',   metric: 'sleep'    },
  { query: 'circadian rhythm sleep wake cycle health',          metric: 'sleep'    },
  { query: 'irregular sleep schedule circadian misalignment',   metric: 'sleep'    },
  // Activity
  { query: 'physical activity exercise depression anxiety',     metric: 'activity' },
  { query: 'exercise stress reduction well-being',              metric: 'activity' },
  { query: 'aerobic exercise sleep quality insomnia',           metric: 'activity' },
  { query: 'evening exercise cortisol sleep disturbance',       metric: 'activity' },
  { query: 'high intensity exercise cortisol overtraining HPA', metric: 'activity' },
  // Stress & cortisol
  { query: 'psychological stress chronic health intervention',  metric: 'stress'   },
  { query: 'mindfulness meditation stress reduction cortisol',  metric: 'stress'   },
  { query: 'cortisol awakening response circadian rhythm HPA',  metric: 'stress'   },
  { query: 'chronic stress HPA axis dysregulation recovery',    metric: 'stress'   },
  // Water
  { query: 'hydration water intake cognitive function',         metric: 'water'    },
  { query: 'dehydration fatigue mood performance',              metric: 'water'    },
  // Food & meal timing
  { query: 'nutrition diet mood mental health',                 metric: 'food'     },
  { query: 'protein tryptophan serotonin mood',                 metric: 'food'     },
  { query: 'meal timing circadian rhythm cortisol metabolism',  metric: 'food'     },
  { query: 'late night eating sleep quality cortisol insulin',  metric: 'food'     },
  { query: 'intermittent fasting cortisol stress HPA axis',     metric: 'food'     },
  // Mood
  { query: 'positive affect well-being happiness daily life',   metric: 'mood'     },
]

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface PubMedArticle {
  pmid:     string
  title:    string
  abstract: string
  year:     string
  metric:   string
  authors:  string   // "LastName1 FM, LastName2 FM"
  journal:  string
}

interface Checkpoint {
  completedQueries: string[]           // queries already fetched
  articles:         PubMedArticle[]
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Retry with exponential back-off */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  retries = CFG.maxRetries,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const wait = 500 * 2 ** attempt
      console.warn(`  ⚠️  ${label} — attempt ${attempt}/${retries} failed, retry in ${wait}ms`)
      await delay(wait)
    }
  }
  throw lastErr
}

function stripTags(str: string): string {
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&amp;/g,  '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Simple progress bar: [████░░░░] 12/22 */
function progressBar(done: number, total: number, width = 24): string {
  const filled = Math.round((done / total) * width)
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${done}/${total}`
}

// ─────────────────────────────────────────────────────────────
// Checkpoint helpers
// ─────────────────────────────────────────────────────────────

function loadCheckpoint(): Checkpoint | null {
  if (!CFG.checkpoint) return null
  try {
    const raw = fs.readFileSync(CFG.checkpointFile, 'utf8')
    return JSON.parse(raw) as Checkpoint
  } catch {
    return null
  }
}

function saveCheckpoint(cp: Checkpoint) {
  if (!CFG.checkpoint) return
  fs.writeFileSync(CFG.checkpointFile, JSON.stringify(cp, null, 2))
}

function clearCheckpoint() {
  if (!CFG.checkpoint) return
  try { fs.unlinkSync(CFG.checkpointFile) } catch {}
}

// ─────────────────────────────────────────────────────────────
// PubMed E-utilities
// ─────────────────────────────────────────────────────────────

async function fetchPubMedIds(query: string, maxResults: number): Promise<string[]> {
  const term = `${query} AND hasabstract[text] AND ("2015"[pdat]:"2025"[pdat])`

  const params = new URLSearchParams({
    db:      'pubmed',
    term,
    retmax:  String(maxResults),
    retmode: 'json',
    sort:    'relevance',
    ...(CFG.pubmedApiKey ? { api_key: CFG.pubmedApiKey } : {}),
  })

  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params}`

  return withRetry(async () => {
    const res  = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { esearchresult?: { idlist?: string[] } }
    return data.esearchresult?.idlist ?? []
  }, `esearch: "${query}"`)
}

async function fetchPubMedDetails(
  pmids: string[],
): Promise<Array<Omit<PubMedArticle, 'metric'>>> {
  if (!pmids.length) return []

  const params = new URLSearchParams({
    db:      'pubmed',
    id:      pmids.join(','),
    retmode: 'xml',
    rettype: 'abstract',
    ...(CFG.pubmedApiKey ? { api_key: CFG.pubmedApiKey } : {}),
  })

  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${params}`

  return withRetry(async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    return parseXml(xml)
  }, `efetch: ${pmids.join(',')}`)
}

function parseXml(xml: string): Array<Omit<PubMedArticle, 'metric'>> {
  const articles: Array<Omit<PubMedArticle, 'metric'>> = []
  const blocks = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) ?? []

  for (const block of blocks) {
    const pmid  = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] ?? ''
    const title = stripTags(block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1] ?? '')
    const year  = block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)?.[1] ?? ''

    // ── Abstract: сохраняем структуру секций (Label="BACKGROUND" и т.д.) ──
    const abstractRaw = block.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g) ?? []
    const abstract = abstractRaw
      .map(tag => {
        const label   = tag.match(/Label="([^"]+)"/)?.[1]
        const content = stripTags(tag)
        return label ? `${label}: ${content}` : content
      })
      .filter(Boolean)
      .join(' ')

    // ── Authors ──────────────────────────────────────────────
    const authorBlocks = block.match(/<Author[^>]*>[\s\S]*?<\/Author>/g) ?? []
    const authors = authorBlocks
      .slice(0, 6)                                              // cap at 6 to avoid very long strings
      .map(a => {
        const last    = stripTags(a.match(/<LastName>([\s\S]*?)<\/LastName>/)?.[1] ?? '')
        const initials = stripTags(a.match(/<Initials>([\s\S]*?)<\/Initials>/)?.[1] ?? '')
        return last ? `${last} ${initials}`.trim() : ''
      })
      .filter(Boolean)
      .join(', ')

    // ── Journal ───────────────────────────────────────────────
    const journal = stripTags(
      block.match(/<ISOAbbreviation>([\s\S]*?)<\/ISOAbbreviation>/)?.[1] ??
      block.match(/<Title>([\s\S]*?)<\/Title>/)?.[1] ??
      '',
    )

    if (pmid && title && abstract.length > 100) {
      articles.push({ pmid, title, abstract, year, authors, journal })
    }
  }

  return articles
}

// ─────────────────────────────────────────────────────────────
// Embeddings
// ─────────────────────────────────────────────────────────────

class OpenAIEmbedder implements EmbeddingFunction {
  constructor(private readonly apiKey: string, private readonly baseURL: string) {}

  async generate(texts: string[]): Promise<number[][]> {
    return withRetry(async () => {
      const res = await fetch(`${this.baseURL}/embeddings`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
      })
      const data = await res.json() as { error?: unknown; data: Array<{ embedding: number[] }> }
      if (data.error) throw new Error(`OpenAI error: ${JSON.stringify(data.error)}`)
      return data.data.map(d => d.embedding)
    }, 'embeddings')
  }
}

// ─────────────────────────────────────────────────────────────
// ChromaDB client
// ─────────────────────────────────────────────────────────────

function makeChromaClient(url: string): ChromaClient {
  const parsed = new URL(url)
  const ssl    = parsed.protocol === 'https:'
  const host   = parsed.hostname
  const port   = parseInt(parsed.port) || (ssl ? 443 : 8000)
  return new ChromaClient({ ssl, host, port } as never)
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🔬 PubMed → ChromaDB seed\n')
  console.log(`  Mode:       ${CFG.mode}`)
  console.log(`  Checkpoint: ${CFG.checkpoint ? CFG.checkpointFile : 'off'}`)
  console.log(`  Articles/q: ${CFG.articlesPerQuery}`)
  console.log(`  PubMed key: ${CFG.pubmedApiKey ? '✅ set (10 req/s)' : '—  (3 req/s)'}`)
  console.log(`  OpenAI key: ${CFG.openaiApiKey.slice(0, 10)}...`)
  console.log(`  Base URL:   ${CFG.openaiBaseUrl}`)
  console.log(`  Chroma:     ${CFG.chromaUrl}\n`)

  if (!CFG.openaiApiKey) {
    console.error('❌ OPENAI_API_KEY не задан'); process.exit(1)
  }

  const embedder = new OpenAIEmbedder(CFG.openaiApiKey, CFG.openaiBaseUrl)

  // ── Smoke-test embeddings ────────────────────────────────────
  process.stdout.write('🧪 Тест эмбеддингов... ')
  try {
    await embedder.generate(['test'])
    console.log('✅')
  } catch (err) {
    console.error(`\n❌ ${err}`); process.exit(1)
  }

  // ── Chroma collection ────────────────────────────────────────
  const chroma = makeChromaClient(CFG.chromaUrl)

  let collection: Awaited<ReturnType<typeof chroma.createCollection>>

  if (CFG.mode === 'recreate') {
    try {
      await chroma.deleteCollection({ name: CFG.collectionName })
      console.log('♻️  Старая коллекция удалена')
    } catch {}
    collection = await chroma.createCollection({
      name:              CFG.collectionName,
      embeddingFunction: embedder,
      metadata:          { description: 'PubMed health articles for RAG' },
    })
    console.log(`✅ Коллекция "${CFG.collectionName}" создана\n`)
  } else {
    collection = await chroma.getOrCreateCollection({
      name:              CFG.collectionName,
      embeddingFunction: embedder,
      metadata:          { description: 'PubMed health articles for RAG' },
    })
    console.log(`✅ Upsert в коллекцию "${CFG.collectionName}"\n`)
  }

  // ── Load checkpoint if exists ────────────────────────────────
  const cp: Checkpoint = loadCheckpoint() ?? { completedQueries: [], articles: [] }
  if (cp.completedQueries.length > 0) {
    console.log(`📂 Продолжаем с чекпоинта: ${cp.completedQueries.length}/${SEARCH_QUERIES.length} запросов, ${cp.articles.length} статей\n`)
  }

  const seenPmids = new Set<string>(cp.articles.map(a => a.pmid))
  const total     = SEARCH_QUERIES.length

  // ── Fetch articles ───────────────────────────────────────────
  for (let qi = 0; qi < SEARCH_QUERIES.length; qi++) {
    const { query, metric } = SEARCH_QUERIES[qi]

    if (cp.completedQueries.includes(query)) {
      console.log(`  ⏭️  skip (cached): "${query}"`)
      continue
    }

    process.stdout.write(`  ${progressBar(qi, total)} "${metric}" `)

    let added = 0
    try {
      const pmids    = await fetchPubMedIds(query, CFG.articlesPerQuery)
      await delay(CFG.pubmedDelay())                             // respect rate limit between esearch & efetch

      const articles = await fetchPubMedDetails(pmids)
      await delay(CFG.pubmedDelay())

      for (const article of articles) {
        if (!seenPmids.has(article.pmid)) {
          seenPmids.add(article.pmid)
          cp.articles.push({ ...article, metric })
          added++
        }
      }

      cp.completedQueries.push(query)
      saveCheckpoint(cp)

      console.log(`+${added} (total ${seenPmids.size})`)
    } catch (err) {
      console.error(`\n  ❌ Ошибка для "${query}": ${err}`)
      // не прерываем цикл — идём дальше
    }
  }

  if (cp.articles.length === 0) {
    console.error('\n❌ Статьи не загружены — проверь интернет-соединение')
    process.exit(1)
  }

  console.log(`\n📚 Итого статей: ${cp.articles.length}`)
  console.log('⚡ Загружаем в ChromaDB...\n')

  // ── Upload to Chroma in batches ──────────────────────────────
  let uploaded = 0
  for (let i = 0; i < cp.articles.length; i += CFG.batchSize) {
    const batch = cp.articles.slice(i, i + CFG.batchSize)

    // Документ: структурированный текст — лучше для retrieval
    const documents = batch.map(a =>
      [
        `Title: ${a.title}`,
        a.authors  ? `Authors: ${a.authors}`  : '',
        a.journal  ? `Journal: ${a.journal}`  : '',
        a.year     ? `Year: ${a.year}`         : '',
        `Abstract: ${a.abstract}`,
      ].filter(Boolean).join('\n'),
    )

    const metadatas = batch.map(a => ({
      pmid:    a.pmid,
      title:   a.title,
      year:    a.year,
      authors: a.authors,
      journal: a.journal,
      metric:  a.metric,
      url:     `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`,
    }))

    const ids = batch.map(a => `pmid_${a.pmid}`)

    await withRetry(
      () => collection.upsert({ ids, documents, metadatas }),
      `chroma upsert batch ${i / CFG.batchSize + 1}`,
    )

    uploaded += batch.length
    process.stdout.write(`\r  ✓ ${progressBar(uploaded, cp.articles.length)}`)
  }

  console.log('\n')

  // ── Summary ──────────────────────────────────────────────────
  console.log('🎉 Seed завершён!\n')
  console.log('📊 По метрикам:')
  const byMetric: Record<string, number> = {}
  for (const a of cp.articles) byMetric[a.metric] = (byMetric[a.metric] ?? 0) + 1
  const maxCount = Math.max(...Object.values(byMetric))
  for (const [m, c] of Object.entries(byMetric).sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.round((c / maxCount) * 20))
    console.log(`  ${m.padEnd(10)} ${bar.padEnd(20)} ${c}`)
  }

  clearCheckpoint()
}

main().catch(err => { console.error('💥 Fatal:', err); process.exit(1) })