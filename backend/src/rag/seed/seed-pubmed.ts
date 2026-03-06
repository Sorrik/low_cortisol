// backend/src/rag/seed/seed-pubmed.ts
// Запуск (PowerShell):
//   $env:OPENAI_API_KEY="sk-..."
//   $env:OPENAI_BASE_URL="https://api.openai.com/v1"
//   $env:CHROMA_URL="http://localhost:8001"
//   npx ts-node -r tsconfig-paths/register src/rag/seed/seed-pubmed.ts

import { ChromaClient, EmbeddingFunction } from 'chromadb'

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
    if (data.error) throw new Error(`OpenAI error: ${JSON.stringify(data.error)}`)
    return data.data.map((d: any) => d.embedding)
  }
}

// ── Темы для поиска ───────────────────────────────────────────
const SEARCH_QUERIES = [
  { query: 'sleep deprivation cortisol stress hormone',       metric: 'sleep'    },
  { query: 'sleep quality mood depression mental health',     metric: 'sleep'    },
  { query: 'chronic sleep restriction cognitive performance', metric: 'sleep'    },
  { query: 'physical activity exercise depression anxiety',   metric: 'activity' },
  { query: 'exercise stress reduction well-being',            metric: 'activity' },
  { query: 'aerobic exercise sleep quality insomnia',         metric: 'activity' },
  { query: 'psychological stress chronic health intervention',metric: 'stress'   },
  { query: 'mindfulness meditation stress reduction',         metric: 'stress'   },
  { query: 'hydration water intake cognitive function',       metric: 'water'    },
  { query: 'dehydration fatigue mood performance',            metric: 'water'    },
  { query: 'nutrition diet mood mental health',               metric: 'food'     },
  { query: 'protein tryptophan serotonin mood',               metric: 'food'     },
  { query: 'omega-3 depression inflammation brain',           metric: 'food'     },
  { query: 'positive affect well-being happiness daily',      metric: 'mood'     },
  { query: 'circadian rhythm sleep wake cycle health',        metric: 'sleep'    },
]

const ARTICLES_PER_QUERY = 5
const CHROMA_URL          = process.env.CHROMA_URL      ?? 'http://localhost:8001'
const OPENAI_API_KEY      = process.env.OPENAI_API_KEY  ?? ''
const OPENAI_BASE_URL     = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
const COLLECTION_NAME     = 'health_articles'

// ── Types ─────────────────────────────────────────────────────
interface PubMedArticle {
  pmid:     string
  title:    string
  abstract: string
  year:     string
  metric:   string
}

// ── PubMed E-utilities ────────────────────────────────────────

async function fetchPubMedIds(query: string, maxResults: number): Promise<string[]> {
  // hasabstract[text] — правильный фильтр через term, не через filter
  const term = `${query} AND hasabstract[text] AND ("2015"[pdat]:"2025"[pdat])`

  const params = new URLSearchParams({
    db:      'pubmed',
    term,
    retmax:  String(maxResults),
    retmode: 'json',
    sort:    'relevance',
  })

  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params}`

  try {
    const res  = await fetch(url)
    const data = await res.json() as any
    const ids  = data.esearchresult?.idlist ?? []
    return ids
  } catch (err) {
    console.error(`  PubMed esearch error: ${err}`)
    return []
  }
}

async function fetchPubMedDetails(pmids: string[]): Promise<Array<Omit<PubMedArticle, 'metric'>>> {
  if (!pmids.length) return []

  const params = new URLSearchParams({
    db:      'pubmed',
    id:      pmids.join(','),
    retmode: 'xml',
    rettype: 'abstract',
  })

  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${params}`

  try {
    const res = await fetch(url)
    const xml = await res.text()
    return parseXml(xml)
  } catch (err) {
    console.error(`  PubMed efetch error: ${err}`)
    return []
  }
}

function parseXml(xml: string): Array<Omit<PubMedArticle, 'metric'>> {
  const articles: Array<Omit<PubMedArticle, 'metric'>> = []

  const articleBlocks = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) ?? []

  for (const block of articleBlocks) {
    const pmidMatch     = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)
    const titleMatch    = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)
    const abstractMatch = block.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)
    const yearMatch     = block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)

    const pmid     = pmidMatch?.[1]  ?? ''
    const title    = stripTags(titleMatch?.[1] ?? '')
    const year     = yearMatch?.[1]  ?? ''
    const abstract = abstractMatch
      ? abstractMatch.map(a => stripTags(a)).join(' ')
      : ''

    if (pmid && title && abstract.length > 100) {
      articles.push({ pmid, title, abstract, year })
    }
  }

  return articles
}

function stripTags(str: string): string {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&amp;/g,  '&')
    .replace(/&quot;/g, '"')
    .trim()
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── ChromaDB клиент (v2 API) ──────────────────────────────────
function makeChromaClient(url: string): ChromaClient {
  const parsed = new URL(url)
  const ssl    = parsed.protocol === 'https:'
  const host   = parsed.hostname
  const port   = parseInt(parsed.port) || (ssl ? 443 : 8000)

  return new ChromaClient({ ssl, host, port } as any)
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('🔬 PubMed → ChromaDB seed начинается...\n')

  // Проверяем переменные
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY не задан!')
    process.exit(1)
  }
  console.log(`🔑 API key: ${OPENAI_API_KEY.slice(0, 10)}...`)
  console.log(`🌐 Base URL: ${OPENAI_BASE_URL}`)
  console.log(`🗄️  Chroma: ${CHROMA_URL}\n`)

  const chroma   = makeChromaClient(CHROMA_URL)
  const embedder = new OpenAIEmbedder(OPENAI_API_KEY, OPENAI_BASE_URL)

  // Тест эмбеддингов до начала
  process.stdout.write('🧪 Тест эмбеддингов... ')
  try {
    await embedder.generate(['test'])
    console.log('✅ OK')
  } catch (err) {
    console.error(`\n❌ Ошибка эмбеддингов: ${err}`)
    process.exit(1)
  }

  // Пересоздаём коллекцию
  try {
    await chroma.deleteCollection({ name: COLLECTION_NAME })
    console.log('♻️  Старая коллекция удалена')
  } catch {
    // коллекции не было — ок
  }

  const collection = await chroma.createCollection({
    name:              COLLECTION_NAME,
    embeddingFunction: embedder,
    metadata:          { description: 'PubMed health articles for RAG' },
  })

  console.log(`✅ Коллекция "${COLLECTION_NAME}" создана\n`)

  // Собираем статьи
  const allArticles: PubMedArticle[] = []
  const seenPmids   = new Set<string>()

  for (const { query, metric } of SEARCH_QUERIES) {
    process.stdout.write(`📡 "${query}" → `)

    const pmids    = await fetchPubMedIds(query, ARTICLES_PER_QUERY)
    const articles = await fetchPubMedDetails(pmids)

    let added = 0
    for (const article of articles) {
      if (!seenPmids.has(article.pmid)) {
        seenPmids.add(article.pmid)
        allArticles.push({ ...article, metric })
        added++
      }
    }

    console.log(`${added} новых (всего ${seenPmids.size})`)
    await sleep(400)   // PubMed rate limit
  }

  if (allArticles.length === 0) {
    console.error('\n❌ Статьи не загружены — проверь интернет-соединение')
    process.exit(1)
  }

  console.log(`\n📚 Итого: ${allArticles.length} статей`)
  console.log('⚡ Загружаем в ChromaDB...\n')

  // Батчами по 50
  const BATCH_SIZE = 50
  let uploaded = 0

  for (let i = 0; i < allArticles.length; i += BATCH_SIZE) {
    const batch     = allArticles.slice(i, i + BATCH_SIZE)
    const documents = batch.map(a => `Title: ${a.title}\n\nAbstract: ${a.abstract}`)
    const metadatas = batch.map(a => ({
      pmid:   a.pmid,
      title:  a.title,
      year:   a.year,
      metric: a.metric,
      url:    `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`,
    }))
    const ids = batch.map(a => `pmid_${a.pmid}`)

    await collection.add({ ids, documents, metadatas })
    uploaded += batch.length
    console.log(`  ✓ ${uploaded}/${allArticles.length}`)
  }

  console.log('\n🎉 Seed завершён!')
  console.log('📊 По метрикам:')
  const byMetric: Record<string, number> = {}
  for (const a of allArticles) byMetric[a.metric] = (byMetric[a.metric] ?? 0) + 1
  for (const [m, c] of Object.entries(byMetric)) console.log(`  ${m}: ${c}`)
}

main().catch(console.error)