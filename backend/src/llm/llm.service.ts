// backend/src/llm/llm.service.ts

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService }      from '@nestjs/config'
import OpenAI                 from 'openai'
import {
  buildRecommendationPrompt,
  detectInjection,
  extractHealthContext,
  MlPrediction,
  buildCitationPrompt,
  buildPolishPrompt,
  copiesPolishExample,
} from './prompt-builder'
import { RecommendationDto }  from '../ml/dto/ml-response.dto'
import { RagService, RelevantArticle } from '../rag/rag.service'
import {
  buildAttentionCard,
  buildCriticalCard,
  computeSeverityBounds,
  criticalMetrics,
  SEVERITY_WINDOW_DAYS,
} from './severity-bounds'
import {
  CITATION_JSON_SCHEMA,
  POLISH_JSON_SCHEMA,
  RECOMMENDATIONS_JSON_SCHEMA,
  VALID_METRICS,
  VALID_SEVERITIES,
} from './recommendations.schema'

// ── Типы ─────────────────────────────────────────────────────

export interface ArticleSource {
  index:   number
  pmid:    string
  title:   string
  titleRu: string
  year:    string
  url:     string
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
  private readonly model:           string
  private readonly translationModel: string
  private readonly polishModel: string
  private readonly requestTimeoutMs: number
  private readonly isConfigured: boolean

  // Кеш переводов PubMed-заголовков (PMID -> русский заголовок).
  // Заголовки статей не меняются, поэтому in-memory кеша достаточно
  // на время жизни процесса. На 90 статьях это десятки KB.
  private readonly titleTranslationCache = new Map<string, string>()
  /**
   * Отладочный флаг для аудита качества рекомендаций. При LLM_PROMPT_DUMP=1
   * в лог печатается полный system/user промпт, retrieved-статьи, сырой
   * ответ OpenAI и рекомендации на каждой стадии постобработки.
   * Использовать только на dev-окружении при ручной проверке.
   */
  private readonly dumpPrompt = process.env.LLM_PROMPT_DUMP === '1'

  private _dump(label: string, payload: unknown): void {
    if (!this.dumpPrompt) return
    const body = typeof payload === 'string'
      ? payload
      : JSON.stringify(payload, null, 2)
    // warn-уровень чтобы пройти любой LOG_LEVEL
    this.logger.warn(`\n========== [DUMP] ${label} ==========\n${body}\n========== END ${label} ==========`)
  }

  constructor(
    private readonly config:     ConfigService,
    private readonly ragService: RagService,
  ) {
    this.isConfigured = Boolean(this.config.get<string>('OPENAI_API_KEY'))
    this.requestTimeoutMs = Number(this.config.get<string | number>('LLM_TIMEOUT_MS', 20_000)) || 20_000
    this.client = new OpenAI({
      apiKey:  this.config.get<string>('OPENAI_API_KEY'),
      baseURL: this.config.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      timeout: this.requestTimeoutMs,
      maxRetries: 1,
    })
    // gpt-4o-mini поддерживает Structured Outputs (strict JSON schema) и даёт
    // достаточное качество советов при низкой стоимости. Можно поднять до
    // gpt-4o-2024-08-06 через LLM_MODEL для более качественной генерации.
    this.model = this.config.get<string>('LLM_MODEL', 'gpt-4o-mini')
    // Для перевода заголовков PubMed используем ту же (или явно заданную)
    // лёгкую модель. Перевод кэшируется на процесс — повторных вызовов нет.
    this.translationModel = this.config.get<string>('LLM_TRANSLATION_MODEL', this.model)
    // Для стиля нужна модель сильнее основной: gpt-4o-mini почти не меняет текст.
    this.polishModel = this.config.get<string>('LLM_POLISH_MODEL', this.model)
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
    // Демо-режим: без ключа LLM и RAG не вызываются. Пустой ответ заставляет
    // InsightsService вернуть рекомендации по правилам и ML, как при сбое LLM.
    if (!this.isConfigured) {
      this.logger.warn('[getRecommendations] OPENAI_API_KEY is not set, LLM is skipped')
      return { recommendations: [], sources: [] }
    }

    this.logger.log(
      `[getRecommendations] model=${this.model}, ` +
      `ml_phase=${mlPrediction?.phase_mode ?? 'none'}, ` +
      `shap_factors=${mlPrediction?.top_influencers?.length ?? 0}`
    )

    // Аудит-лог попыток prompt-injection через профиль пользователя.
    // sanitizeForPrompt всё равно их вырежет, но мы хотим знать,
    // что такая попытка была — и иметь возможность среагировать.
    const profile = healthData?._user_profile ?? {}
    for (const field of ['primary_goal', 'sport_goal', 'chronotype', 'activity_level']) {
      const hit = detectInjection(profile?.[field])
      if (hit) {
        this.logger.warn(
          `[safety] injection attempt in profile.${field}: "${hit}" — sanitized`,
        )
      }
    }

    // ── RAG: находим релевантные статьи
    const healthContext = extractHealthContext(healthData)
    const articles      = await this.ragService.findRelevantArticles(healthContext)

    if (articles.length > 0) {
      this.logger.log(
        `[getRecommendations] RAG нашёл ${articles.length} статей: ` +
        articles.map(a => `PMID:${a.pmid}`).join(', ')
      )
    }

    this._dump('HEALTH_DATA (input to prompt-builder)', healthData)
    this._dump('RAG ARTICLES', articles.map(a => ({
      pmid: a.pmid,
      title: a.title,
      year: a.year,
      relevance: a.relevance,
      metric: a.metric,
      abstract_head: (a.abstract ?? '').slice(0, 300),
    })))

    // ── Строим промпт: данные + SHAP + RAG
    const promptPayload = buildRecommendationPrompt(
      healthData,
      articles,
      mlPrediction ?? undefined,
    )
    const { system, user } = JSON.parse(promptPayload)

    this.logger.debug(
      `[getRecommendations] prompt ready: system_chars=${system.length}, ` +
      `user_chars=${user.length}, articles=${articles.length}`,
    )

    this._dump('SYSTEM PROMPT', system)
    this._dump('USER PROMPT', user)
    this._dump('ML PREDICTION (passed to prompt-builder)', mlPrediction ?? null)

    try {
      const response = await this.client.chat.completions.create({
        model:       this.model,
        temperature: 0.6,
        max_tokens:  1000,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user   },
        ],
        // Structured Outputs: модель гарантирует JSON, валидный по схеме.
        // Избавляет от ручного markdown-stripping и снижает hallucination.
        response_format: {
          type: 'json_schema',
          json_schema: RECOMMENDATIONS_JSON_SCHEMA,
        },
      }, {
        timeout: this.requestTimeoutMs,
      })

      // Если модель решила отказать (safety refusal) — message.refusal будет строкой
      const refusal = response.choices?.[0]?.message?.refusal
      if (refusal) {
        this.logger.warn(`[getRecommendations] model refused: ${refusal}`)
        return { recommendations: [], sources: [] }
      }

      // Прокси иногда возвращает HTTP 200 с телом null —
      // OpenAI SDK парсит это как null вместо броска APIError
      if (!response || !response.choices?.length) {
        throw new Error(
          `OpenAI proxy returned empty response (model=${this.model}). ` +
          `Possible cause: quota exceeded or proxy error.`
        )
      }

      const raw = response.choices[0]?.message?.content ?? ''

      this.logger.log(
        `[getRecommendations] tokens: ` +
        `prompt=${response.usage?.prompt_tokens}, ` +
        `completion=${response.usage?.completion_tokens}`
      )

      this._dump('OPENAI RAW RESPONSE', raw)

      let recommendations = this._parseResponse(raw)
      this._dump('AFTER _parseResponse', recommendations)

      // ── Постобработка ─────────────────────────────────────────────────
      // Порядок важен:
      //   1) маркеры основной генерации убираем: ссылки ставит отдельный шаг;
      //   2) критичные карточки и severity-коррекция задают итоговый цвет;
      //   3) шаг стиля переписывает текст под этот цвет, параллельно выбираются ссылки;
      //   4) фильтр опасных советов проверяет финальный текст и может его подменить.
      recommendations = this._removeCitations(recommendations)
      this._dump('AFTER _removeCitations', recommendations)

      recommendations = this._dedupeCausalChains(recommendations)
      this._dump('AFTER _dedupeCausalChains', recommendations)

      recommendations = this._ensureCriticalCards(recommendations, healthData)
      this._dump('AFTER _ensureCriticalCards', recommendations)

      recommendations = this._correctSeverities(recommendations, healthData)
      this._dump('AFTER _correctSeverities', recommendations)

      const deadline = Date.now() + LlmService.STEPS_BUDGET_MS
      const [polished, citations] = await Promise.all([
        this._polishCards(recommendations, healthData, deadline),
        this._selectCitations(recommendations, articles, deadline),
      ])
      this._dump('AFTER _polishCards', polished)

      recommendations = this._filterDangerousAdvice(polished)
      this._dump('AFTER _filterDangerousAdvice', recommendations)

      // Финальный шаг — нормализуем good-карточки. LLM может вписать
      // негатив даже при severity=good, потому что видит мелкий нисходящий тренд.
      recommendations = this._normalizeGoodCards(recommendations, healthData)
      this._dump('AFTER _normalizeGoodCards', recommendations)

      recommendations = this._sortBySeverity(this._attachCitations(recommendations, citations))
      const cited = this._renumberCitations(recommendations, articles)
      const translatedTitles = await this._translateTitles(
        cited.articles.map(a => ({ pmid: a.pmid, title: a.title })),
      )
      const sources: ArticleSource[] = cited.articles.map((a, i) => ({
        index:   i + 1,
        pmid:    a.pmid,
        title:   a.title,
        titleRu: translatedTitles.get(a.pmid) ?? a.title,
        year:    a.year,
        url:     `https://europepmc.org/article/MED/${a.pmid}`,
      }))
      this._dump('FINAL', { recommendations: cited.recommendations, sources })
      return { recommendations: cited.recommendations, sources }

    } catch (err) {
      this.logger.error(`[getRecommendations] OpenAI error: ${err}`)
      throw err
    }
  }

  // ── Ссылки на статьи ──────────────────────────────────────────────────

  private _removeCitations(recs: RecommendationDto[]): RecommendationDto[] {
    return recs.map(rec => {
      const description = rec.description
        .replace(/\[\d+\]/g, '')
        .replace(/\s+([.,;:!?])/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim()
      return description === rec.description ? rec : { ...rec, description }
    })
  }

  /**
   * Для каждой карточки возвращает номер подходящей статьи или null. Модели показываем
   * только статьи той же темы. Исключения: настроение связано со всеми метриками, а карточка
   * с причинной цепочкой охватывает несколько тем. Ответ модели сверяем с этим списком.
   */
  private async _selectCitations(
    recs: RecommendationDto[],
    articles: RelevantArticle[],
    deadline = Date.now() + LlmService.STEPS_BUDGET_MS,
  ): Promise<(number | null)[]> {
    const none = recs.map(() => null)
    const offers = recs.map(rec => articles
      .map((article, index) => ({ ...article, id: index + 1 }))
      .filter(article => rec.metric === 'mood' || rec.causal_chain || article.metric === rec.metric))
    if (offers.every(offer => offer.length === 0)) return none

    try {
      const { system, user } = buildCitationPrompt(
        recs.map((rec, i) => ({ title: rec.title, description: rec.description, articles: offers[i] })),
      )
      const response = await this.client.chat.completions.create({
        model:       this.polishModel,
        temperature: 0,
        max_tokens:  300,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user   },
        ],
        response_format: { type: 'json_schema', json_schema: CITATION_JSON_SCHEMA },
      }, {
        timeout: this._stepTimeoutMs(deadline),
      })

      const cards = JSON.parse(response.choices?.[0]?.message?.content ?? '')?.cards
      if (!Array.isArray(cards) || cards.length !== recs.length) {
        this.logger.warn('[citations] неверное число карточек, ссылки не добавлены')
        return none
      }
      return recs.map((_, i) => {
        const source = cards[i]?.source
        return offers[i].some(article => article.id === source) ? source : null
      })
    } catch (err) {
      this.logger.warn(`[citations] failed: ${err}`)
      return none
    }
  }

  /** Маркер ставим после первого предложения: статья подтверждает описанную там проблему. */
  private _attachCitations(
    recs: RecommendationDto[],
    citations: (number | null)[],
  ): RecommendationDto[] {
    return recs.map((rec, i) => {
      const source = citations[i]
      if (!source || rec.title === LlmService.BLOCKED_CARD_TITLE) return rec
      const end = rec.description.search(/[.!?…](?=\s|$)/)
      const description = end === -1
        ? `${rec.description} [${source}]`
        : `${rec.description.slice(0, end + 1)} [${source}]${rec.description.slice(end + 1)}`
      return { ...rec, description }
    })
  }

  /** В источники попадают только процитированные статьи, с номерами по порядку упоминания. */
  private _renumberCitations(
    recs: RecommendationDto[],
    articles: RelevantArticle[],
  ): { recommendations: RecommendationDto[]; articles: RelevantArticle[] } {
    const newIndex = new Map<number, number>()
    const recommendations = recs.map(rec => {
      const description = rec.description.replace(/\[(\d+)\]/g, (match, num) => {
        const oldIndex = Number(num)
        if (!articles[oldIndex - 1]) return ''
        if (!newIndex.has(oldIndex)) newIndex.set(oldIndex, newIndex.size + 1)
        return `[${newIndex.get(oldIndex)}]`
      })
      return description === rec.description ? rec : { ...rec, description }
    })
    return {
      recommendations,
      articles: [...newIndex.keys()].map(oldIndex => articles[oldIndex - 1]),
    }
  }

  /**
   * LLM может пропустить критичную метрику или похвалить её. Такой совет
   * не должен зависеть от генерации, поэтому сервер добавляет или заменяет карточку.
   */
  private _ensureCriticalCards(
    recs: RecommendationDto[],
    healthData: any,
  ): RecommendationDto[] {
    const bounds = computeSeverityBounds(healthData)
    const result = [...recs]
    for (const metric of criticalMetrics(bounds)) {
      const index = result.findIndex(rec => rec.metric === metric)
      if (index === -1) {
        this.logger.warn(`[critical] LLM пропустила метрику ${metric}, добавлена карточка`)
        result.push(buildCriticalCard(metric, bounds))
      } else if (!result.some(rec => rec.metric === metric && rec.severity !== 'good')) {
        this.logger.warn(`[critical] LLM похвалила метрику ${metric}, карточка заменена`)
        result[index] = buildCriticalCard(metric, bounds)
      }
    }
    return result
  }

  private _stepTimeoutMs(deadline: number): number {
    return Math.min(this.requestTimeoutMs, Math.max(deadline - Date.now(), 1))
  }

  /**
   * Переписывает карточки живым языком. Отклонённые карточки уходят на второй проход
   * с указанием причины, а затем получают запасной текст: штамп не должен дойти до экрана.
   */
  private async _polishCards(
    recs: RecommendationDto[],
    healthData: any = {},
    deadline = Date.now() + LlmService.STEPS_BUDGET_MS,
  ): Promise<RecommendationDto[]> {
    if (recs.length === 0) return recs

    const result = [...recs]
    const problems = new Map<number, string>()
    let pending = recs.map((_, i) => i)

    for (let attempt = 0; attempt < LlmService.POLISH_ATTEMPTS && pending.length > 0; attempt++) {
      if (Date.now() >= deadline) break
      const cards = await this._requestPolish(
        pending.map(i => ({ ...recs[i], previous_problem: problems.get(i) })),
        deadline,
      )
      if (!cards) break

      const rejected: number[] = []
      pending.forEach((index, position) => {
        const problem = this._polishProblem(recs[index], cards[position])
        if (problem) {
          problems.set(index, problem)
          rejected.push(index)
        } else {
          result[index] = {
            ...recs[index],
            title: cards[position].title.trim(),
            description: cards[position].description.trim(),
          }
        }
      })
      pending = rejected
    }

    for (const index of pending) {
      this.logger.warn(`[polish] ${recs[index].metric}: ${problems.get(index) ?? 'нет ответа'}, запасной текст`)
      result[index] = this._fallbackCard(recs[index], healthData)
    }
    return result
  }

  private async _requestPolish(
    cards: (RecommendationDto & { previous_problem?: string })[],
    deadline: number,
  ): Promise<{ title: string; description: string }[] | null> {
    try {
      const { system, user } = buildPolishPrompt(cards)
      const response = await this.client.chat.completions.create({
        model:       this.polishModel,
        temperature: 0.7,
        max_tokens:  1000,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user   },
        ],
        response_format: { type: 'json_schema', json_schema: POLISH_JSON_SCHEMA },
      }, {
        timeout: this._stepTimeoutMs(deadline),
      })

      const polished = JSON.parse(response.choices?.[0]?.message?.content ?? '')?.cards
      if (Array.isArray(polished) && polished.length === cards.length) return polished
      this.logger.warn('[polish] неверное число карточек в ответе')
      return null
    } catch (err) {
      this.logger.warn(`[polish] failed: ${err}`)
      return null
    }
  }

  /** Возвращает причину отклонения текста или null, если текст годится. */
  private _polishProblem(rec: RecommendationDto, card: any): string | null {
    if (!card?.title?.trim() || !card?.description?.trim()) return 'пустой заголовок или текст'

    const text = `${card.title} ${card.description}`
    const stamp = text.match(LlmService.STAMP_PATTERN)?.[0]
    if (stamp) return `запрещённый оборот «${stamp}»`
    if (LlmService.GENDERED_PATTERN.test(text)) return 'слово с указанием рода'
    if (copiesPolishExample(card.title, card.description)) return 'фраза скопирована из образца'

    const numbers = (value: string) => new Set(
      (value.match(/\d+(?:[.,]\d+)?/g) ?? []).map(n => n.replace(',', '.')),
    )
    const original = numbers(`${rec.title} ${rec.description}`)
    const polished = numbers(text)
    const added = [...polished].find(n => !original.has(n))
    if (added) return `новое число ${added}, можно использовать только исходные`
    if (original.size > 0 && polished.size === 0) return 'пропали все исходные числа'
    return null
  }

  /** Текст для карточки, которую шаг стиля не смог переписать. */
  private _fallbackCard(rec: RecommendationDto, healthData: any): RecommendationDto {
    const bounds = computeSeverityBounds(healthData)
    const useServerText = (card: { title: string; description: string }) => ({
      ...rec,
      title: card.title,
      description: card.description,
    })

    if (rec.severity === 'alert' && criticalMetrics(bounds).includes(rec.metric)) {
      return useServerText(buildCriticalCard(rec.metric, bounds))
    }
    const clean = !LlmService.STAMP_PATTERN.test(`${rec.title} ${rec.description}`)
      && !LlmService.GENDERED_PATTERN.test(`${rec.title} ${rec.description}`)
    if (clean) return rec

    if (rec.severity === 'good') {
      const template = this._goodCardTemplates(healthData)[rec.metric]
      return template ? { ...rec, title: template.title, description: template.desc } : rec
    }
    return useServerText(buildAttentionCard(rec.metric, bounds))
  }

  private _sortBySeverity(recs: RecommendationDto[]): RecommendationDto[] {
    const rank: Record<string, number> = { alert: 0, attention: 1, good: 2 }
    return [...recs].sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3))
  }

  // ── Safety: фильтр опасных советов ─────────────────────────────────────
  //
  // Health-app не имеет права рекомендовать лекарства, голодание, отказ
  // от воды или экстремальные тренировки. Системный промпт запрещает это,
  // но мы не можем полагаться только на промпт — добавляем серверный
  // фильтр на ключевые опасные паттерны. При срабатывании:
  //   - description заменяется на безопасный шаблон;
  //   - severity сохраняется (метрика всё ещё может требовать внимания);
  //   - случай логируется для последующего разбора и подкручивания промпта.

  // ВАЖНО: regex без \b — в JS без флага u кириллица не входит в \w,
  // поэтому \b даёт ложноотрицательные совпадения на стыке русского
  // слова и пробела. Для фильтра «осторожнее = лучше».
  private static readonly DANGEROUS_PATTERNS: { pattern: RegExp; reason: string }[] = [
    { pattern: /(голодай(те)?|голодан\w*|поголод\w+)/i,                                    reason: 'fasting_advice' },
    { pattern: /(прими(те)?|выпей(те)?|купи(те)?)\s+(витамин\w*|таблетк\w*|лекарств\w*|добавк\w*|снотворн\w*|антидепрессант\w*|транквилизатор\w*)/i, reason: 'medication_advice' },
    { pattern: /(прекрати(те)?|перестан(ь|ьте)|откажись(?:\s+от)?)\s+пить\s+воду/i,        reason: 'water_restriction' },
    { pattern: /(трениров\w*|занят\w*|тренируй(?:тесь|ся))\s+(больше|более)\s+\d+\s*час/i, reason: 'extreme_exercise' },
    { pattern: /(не\s+ешь(те)?|пропусти(те)?\s+приё?м|откажись(?:\s+от)?\s+(еды|пищи))/i,  reason: 'skip_meals_advice' },
    { pattern: /(прекрати(те)?\s+принимать|отмени(те)?)\s+(лекарств\w*|таблетк\w*|препарат\w*)/i, reason: 'stop_medication_advice' },
  ]

  private _filterDangerousAdvice(recs: RecommendationDto[]): RecommendationDto[] {
    return recs.map(rec => {
      for (const { pattern, reason } of LlmService.DANGEROUS_PATTERNS) {
        if (pattern.test(rec.description) || pattern.test(rec.title)) {
          this.logger.error(
            `[safety] dangerous advice blocked: reason=${reason}, ` +
            `metric=${rec.metric}, rule_id=${rec.rule_id ?? '-'}, ` +
            `title="${rec.title.slice(0, 60)}"`,
          )
          return {
            ...rec,
            title: LlmService.BLOCKED_CARD_TITLE,
            description:
              'По этой метрике система предлагала шаг, который мы не показываем без ' +
              'консультации врача (приём препаратов, голодание, экстремальные нагрузки и т.п.). ' +
              'Если по этой теме есть вопросы — обсудите их с терапевтом или специалистом.',
            // Помечаем, что severity не должна повышаться: это не повод алёртить.
            severity: rec.severity === 'alert' ? 'attention' : rec.severity,
          }
        }
      }
      return rec
    })
  }

  // ── Постобработка severity ────────────────────────────────
  // Корректирует severity в обе стороны:
  // - повышает когда LLM занижает критические значения
  // - понижает когда LLM завышает хорошие значения

  /**
   * Дедупликация causal_chain между рекомендациями. LLM иногда прикрепляет
   * одну и ту же цепочку (например, A2 «питание → сон») сразу к двум
   * рекомендациям — питанию и сну. По UX это выглядит как повтор: юзер
   * видит одинаковый блок «Почему этот совет» в двух карточках.
   *
   * Правило: одна цепочка → одна рекомендация. Оставляем на той, у
   * которой выше severity (alert > attention > good). При равной severity —
   * на первой в порядке возврата. На остальных causal_chain = null.
   */
  private _dedupeCausalChains(recs: RecommendationDto[]): RecommendationDto[] {
    const sevRank: Record<string, number> = { alert: 3, attention: 2, good: 1 }
    const seen = new Map<string, number>()  // chain_id -> index of "winner"

    recs.forEach((r, idx) => {
      const chainId = r.causal_chain?.chain_id
      if (!chainId) return
      const current = seen.get(chainId)
      if (current === undefined) {
        seen.set(chainId, idx)
        return
      }
      const curSev = sevRank[recs[current].severity] ?? 0
      const newSev = sevRank[r.severity] ?? 0
      if (newSev > curSev) seen.set(chainId, idx)
    })

    return recs.map((r, idx) => {
      const chainId = r.causal_chain?.chain_id
      if (!chainId) return r
      const winner = seen.get(chainId)
      if (winner !== idx) {
        return { ...r, causal_chain: null }
      }
      return r
    })
  }

  private _correctSeverities(
    recs: RecommendationDto[],
    healthData: any,
  ): RecommendationDto[] {
    const SEVERITY_ORDER = { good: 0, attention: 1, alert: 2 }

    const { averages, floor: minSeverity, ceil: maxSeverity } = computeSeverityBounds(healthData)
    const { calories: avgCalories, sleep: avgSleep, stress: avgStress, mood: avgMood } = averages

    return recs.map(rec => {
      let { severity } = rec
      const current = SEVERITY_ORDER[severity as keyof typeof SEVERITY_ORDER] ?? 0

      // Применяем минимум (повышение)
      const floor = minSeverity[rec.metric]
      if (floor && SEVERITY_ORDER[floor] > current) {
        this.logger.warn(
          `[_correctSeverities] ${rec.metric}: ${severity}→${floor} (raised)` +
          ` cal=${avgCalories.toFixed(0)}, sleep=${avgSleep.toFixed(1)},` +
          ` stress=${avgStress.toFixed(1)}, mood=${avgMood.toFixed(1)}`
        )
        severity = floor
      }

      // Применяем максимум (понижение)
      const ceil = maxSeverity[rec.metric]
      const corrected = SEVERITY_ORDER[severity as keyof typeof SEVERITY_ORDER] ?? 0
      if (ceil && corrected > SEVERITY_ORDER[ceil]) {
        this.logger.warn(
          `[_correctSeverities] ${rec.metric}: ${severity}→${ceil} (lowered, value is good)`
        )
        severity = ceil
      }

      return severity !== rec.severity ? { ...rec, severity } : rec
    })
  }

  // ── Парсинг ответа ────────────────────────────────────────
  // Structured Outputs гарантирует валидный JSON по нашей схеме,
  // но оставляем defense-in-depth проверки полей — прокси или старые
  // модели могут схему проигнорировать.

  private _parseResponse(raw: string): RecommendationDto[] {
    try {
      const parsed = JSON.parse(raw)
      const recs   = parsed?.recommendations

      if (!Array.isArray(recs)) {
        this.logger.warn('[_parseResponse] recommendations не массив')
        return []
      }

      const valid = recs.filter((r: any) => {
        const ok =
          typeof r.metric      === 'string' &&
          typeof r.severity    === 'string' &&
          typeof r.title       === 'string' &&
          typeof r.description === 'string' &&
          (VALID_METRICS    as readonly string[]).includes(r.metric)   &&
          (VALID_SEVERITIES as readonly string[]).includes(r.severity)

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

  // ── Перевод заголовков PubMed на русский ──────────────────────────────
  //
  // Заголовки статей приходят на английском, для пользователя ВКР нужны
  // русские. Переводим один раз через gpt-4o-mini, кешируем результат
  // по PMID. На 90 статьях весь корпус переводится за один-два запроса.
  // При сбое или таймауте — fallback на оригинальный английский заголовок.

  private async _translateTitles(
    items: { pmid: string; title: string }[],
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>()

    const pending: { pmid: string; title: string }[] = []
    for (const item of items) {
      const cached = this.titleTranslationCache.get(item.pmid)
      if (cached) {
        result.set(item.pmid, cached)
      } else {
        pending.push(item)
      }
    }

    if (pending.length === 0) return result

    try {
      const numbered = pending
        .map((it, i) => `${i + 1}. ${it.title.replace(/\s+/g, ' ').trim()}`)
        .join('\n')

      const response = await this.client.chat.completions.create({
        model:       this.translationModel,
        temperature: 0.1,
        max_tokens:  600,
        messages: [
          {
            role:    'system',
            content:
              'Переведи научные заголовки PubMed на русский язык. ' +
              'Сохрани смысл, термины переводи общедоступно. Без кавычек, без точки в конце. ' +
              'Верни ТОЛЬКО JSON-массив строк в том же порядке, без пояснений. ' +
              'Пример: ["Заголовок один", "Заголовок два"]',
          },
          { role: 'user', content: numbered },
        ],
      }, {
        timeout: LlmService.TRANSLATION_TIMEOUT_MS,
      })

      const raw = response.choices?.[0]?.message?.content?.trim() ?? ''
      const parsed: unknown = JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim())

      if (Array.isArray(parsed) && parsed.length === pending.length) {
        pending.forEach((it, i) => {
          const ru = typeof parsed[i] === 'string' ? (parsed[i] as string).trim() : ''
          if (ru) {
            this.titleTranslationCache.set(it.pmid, ru)
            result.set(it.pmid, ru)
          }
        })
      } else {
        this.logger.warn(
          `[translateTitles] mismatched response length: expected ${pending.length}, got ${Array.isArray(parsed) ? parsed.length : 'non-array'}`,
        )
      }
    } catch (err) {
      this.logger.warn(`[translateTitles] failed: ${err}`)
    }

    return result
  }

  // ── Нормализатор good-карточек ─────────────────────────────────────────
  //
  // LLM любит даже в карточке «всё хорошо» вписать оговорку про мелкий тренд
  // («среднее 8.4/10, но наблюдается ухудшение»). Для юзера с метриками в
  // норме это разрушает UX — мы хотим, чтобы хорошие карточки звучали как
  // поддержка коуча, не как мелочный аудит.
  //
  // Стратегия:
  //   1) если severity != "good" — не трогаем;
  //   2) ищем запрещённые слова/обороты в title и description;
  //   3) если найдены — подменяем на метрик-специфичный позитивный шаблон,
  //      подставляя число из реальных данных пользователя.

  // ВАЖНО: держать синхронно со списком запрещённых оборотов в
  // prompt-builder.ts (раздел 5a, "ДЛЯ severity = good"). «но», «однако»,
  // «следует» намеренно НЕ входят сюда — это нейтральные слова, которые
  // ломают естественность текста, если запретить их целиком (см. правку
  // промпта: разрешены, если фраза в целом звучит позитивно).
  private static readonly POLISH_ATTEMPTS = 2
  /** Общий бюджет шагов стиля и ссылок: клиент не должен ждать ответ слишком долго. */
  private static readonly STEPS_BUDGET_MS = 15_000
  private static readonly TRANSLATION_TIMEOUT_MS = 5_000
  private static readonly BLOCKED_CARD_TITLE = 'Совет требует обсуждения со специалистом'
  private static readonly STAMP_PATTERN =
    /недостат\S*|в том же духе|так держать|постарайся|ты потребляешь|требует внимания|показател\S*|уровн\S*|уровень|в среднем|средн(?:ий|ее|яя|его|ем)(?![а-яё])|значительно|ниже оптимального|не дотягива\S*|способствует|сказыва\S*|отличный результат|это здорово/i
  private static readonly GENDERED_PATTERN = /(^|[\s,.!?])(ты|чем|как)\s+[а-яё]+(л|ла)(?=[\s,.!?]|$)/i

  private static readonly NEGATIVE_PATTERNS = [
    /ухудш/i, /снижа/i, /снизил/i, /падае/i, /упал/i,
    /\bниже\b/i, /\bхуже\b/i, /слабее/i,
    /проблем/i, /\bриск/i, /беспоко/i, /тревож/i, /осторож/i,
    /обрати внимание/i, /стоит улучшить/i, /стоит обратить/i,
    /попробуй (добавить|улучшить|пересмотреть)/i,
    /недобор/i, /не дотягива/i,
  ] as const

  private _goodCardTemplates(healthData: any): Record<string, { title: string; desc: string }> {
    const { sleep: avgSleep, mood: avgMood, stress: avgStress, water: avgWaterMl } =
      computeSeverityBounds(healthData).averages
    const activityRecords = [...(healthData.activity ?? [])]
      .sort((a: any, b: any) => String(a.date ?? '').localeCompare(String(b.date ?? '')))
      .slice(-SEVERITY_WINDOW_DAYS)
    const avgActivity = activityRecords.length
      ? activityRecords.reduce((sum: number, r: any) => sum + (r.duration_minutes ?? 0), 0) / activityRecords.length
      : 0

    const r1 = (n: number) => Math.round(n * 10) / 10
    const r0 = (n: number) => Math.round(n)

    const templates: Record<string, { title: string; desc: string }> = {
      mood: {
        title: 'Стабильно хорошее настроение',
        desc:  `Около ${r1(avgMood)} из 10 за неделю, и это не разовая удача. Похоже, у тебя сложился рабочий ритм.`,
      },
      sleep: {
        title: 'Хороший сон',
        desc:  `Около ${r1(avgSleep)} ч за ночь, и такой режим уже держится. Организм скажет за это спасибо.`,
      },
      stress: {
        title: 'Стресс под контролем',
        desc:  `Около ${r1(avgStress)} из 10 за неделю. Спокойная неделя, и это хороший запас сил на следующую.`,
      },
      activity: {
        title: 'Отличная активность',
        desc:  `Около ${r0(avgActivity)} минут движения в день. Такой темп легко сделать привычкой.`,
      },
      water: {
        title: 'Хороший уровень гидратации',
        desc:  `Около ${r0(avgWaterMl / 50) * 50} мл в день. Похоже, бутылка с водой уже стала привычкой.`,
      },
      food: {
        title: 'Питание в порядке',
        desc:  `Рацион совпадает с твоими целями, и это видно по неделе в целом, а не по одному удачному дню.`,
      },
    }

    return templates
  }

  private _normalizeGoodCards(
    recs: RecommendationDto[],
    healthData: any,
  ): RecommendationDto[] {
    const templates = this._goodCardTemplates(healthData)

    const hasNegative = (s: string): boolean =>
      LlmService.NEGATIVE_PATTERNS.some(p => p.test(s))

    return recs.map(rec => {
      if (rec.severity !== 'good') return rec

      const tpl = templates[rec.metric]
      if (!tpl) return rec

      const titleBad = hasNegative(rec.title)
      const descBad  = hasNegative(rec.description)

      if (!titleBad && !descBad) return rec

      this.logger.warn(
        `[normalize] good-card "${rec.metric}" содержала негативную лексику, ` +
        `переписали по шаблону (title_bad=${titleBad}, desc_bad=${descBad})`,
      )

      return {
        ...rec,
        title:       titleBad ? tpl.title : rec.title,
        description: descBad  ? tpl.desc  : rec.description,
      }
    })
  }
}
