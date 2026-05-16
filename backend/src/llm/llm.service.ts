// backend/src/llm/llm.service.ts

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService }      from '@nestjs/config'
import OpenAI                 from 'openai'
import {
  buildRecommendationPrompt,
  detectInjection,
  extractHealthContext,
  MlPrediction,
} from './prompt-builder'
import { RecommendationDto }  from '../ml/dto/ml-response.dto'
import { RagService }         from '../rag/rag.service'
import {
  RECOMMENDATIONS_JSON_SCHEMA,
  VALID_METRICS,
  VALID_SEVERITIES,
} from './recommendations.schema'

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
  private readonly requestTimeoutMs: number
  /**
   * TEMP debug-флаг для аудита качества рекомендаций. При LLM_PROMPT_DUMP=1
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
    this.requestTimeoutMs = this.config.get<number>('OPENAI_TIMEOUT_MS', 20_000)
    this.client = new OpenAI({
      apiKey:  this.config.get<string>('OPENAI_API_KEY'),
      baseURL: this.config.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      timeout: this.requestTimeoutMs,
      maxRetries: 1,
    })
    // gpt-4o-2024-08-06 — первая версия с поддержкой Structured Outputs (strict JSON schema).
    // gpt-4.1-mini / gpt-4o-mini тоже поддерживают, но 4o даёт лучшее качество советов.
    this.model = this.config.get<string>('LLM_MODEL', 'gpt-4o-2024-08-06')
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
        temperature: 0.2,
        max_tokens:  800,
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
        return { recommendations: [], sources }
      }

      // Artemox-прокси иногда возвращает HTTP 200 с телом null —
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

      // ── Safety post-processing (Wave 3) ─────────────────────────────────
      // Порядок важен:
      //   1) валидация PMID — иначе фильтр опасности может работать на тексте
      //      с галлюцинированной ссылкой;
      //   2) фильтр опасных советов — может ПОДМЕНИТЬ description, потому
      //      идёт до severity-коррекции;
      //   3) severity коррекция — уже на чистом тексте.
      const allowedPmids = new Set(articles.map(a => String(a.pmid)))
      recommendations = this._stripUnknownPmidRefs(recommendations, allowedPmids)
      this._dump('AFTER _stripUnknownPmidRefs', recommendations)

      recommendations = this._filterDangerousAdvice(recommendations)
      this._dump('AFTER _filterDangerousAdvice', recommendations)

      recommendations = this._dedupeCausalChains(recommendations)
      this._dump('AFTER _dedupeCausalChains', recommendations)

      recommendations = this._correctSeverities(recommendations, healthData)
      this._dump('AFTER _correctSeverities (final)', recommendations)
      return { recommendations, sources }

    } catch (err) {
      this.logger.error(`[getRecommendations] OpenAI error: ${err}`)
      throw err
    }
  }

  // ── Safety: PMID валидация ────────────────────────────────────────────
  //
  // LLM может сослаться на статью маркером [N], где N — порядковый номер
  // в нашем списке. Иногда модель выдумывает новые номера ([7] при 3
  // статьях), и фронт строит URL europepmc.org/article/MED/{выдуманный}.
  // Здесь сверяем, что N действительно есть в retrieved-наборе по позиции
  // (1..articles.length). Если нет — удаляем маркер из description, чтобы
  // пользователь не вёл по битой ссылке.

  private _stripUnknownPmidRefs(
    recs: RecommendationDto[],
    allowedPmids: Set<string>,
  ): RecommendationDto[] {
    const allowedIndices = new Set<number>(
      Array.from({ length: allowedPmids.size }, (_, i) => i + 1),
    )

    return recs.map(rec => {
      const cleaned = rec.description.replace(/\[(\d+)\]/g, (match, num) => {
        const n = Number(num)
        if (allowedIndices.has(n)) return match
        this.logger.warn(
          `[safety] stripped unknown PMID ref [${n}] from rule_id=${rec.rule_id ?? '-'} ` +
          `(allowed: 1..${allowedPmids.size})`,
        )
        return ''
      }).replace(/\s{2,}/g, ' ').trim()

      return cleaned === rec.description ? rec : { ...rec, description: cleaned }
    })
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
            title: 'Совет требует обсуждения со специалистом',
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

    const avgOf = (arr: any[], key: string) =>
      arr.length ? arr.reduce((s: number, r: any) => s + (r[key] ?? 0), 0) / arr.length : 0

    // Питание: nutrition массив = отдельные приёмы. avgOf даёт среднее
    // НА ПРИЁМ, а проверки ниже — на ДЕНЬ (< 1200 ккал/день и т.п.).
    // Поэтому аггрегируем по дням так же, как в prompt-builder.
    const nutritionByDay = new Map<string, { calories: number; protein: number; days: number }>()
    for (const r of (healthData.nutrition ?? []) as Array<{ date?: string; calories?: number; protein_grams?: number }>) {
      const day = (r.date ?? 'unknown').slice(0, 10)
      const prev = nutritionByDay.get(day) ?? { calories: 0, protein: 0, days: 1 }
      prev.calories += r.calories ?? 0
      prev.protein  += r.protein_grams ?? 0
      nutritionByDay.set(day, prev)
    }
    const dailyCalArr  = [...nutritionByDay.values()].map(d => d.calories).filter(c => c > 0)
    const dailyProtArr = [...nutritionByDay.values()].map(d => d.protein).filter(p => p > 0)
    const avgCalories  = dailyCalArr.length  ? dailyCalArr.reduce((s, v)  => s + v, 0) / dailyCalArr.length  : 0
    const avgProtein   = dailyProtArr.length ? dailyProtArr.reduce((s, v) => s + v, 0) / dailyProtArr.length : 0

    const avgSleep    = avgOf(healthData.sleep     ?? [], 'duration_hours')
    const avgStress   = avgOf(healthData.stress    ?? [], 'level')
    const avgMood     = avgOf(healthData.mood      ?? [], 'mood_score')

    const profile = healthData._user_profile ?? {}
    const sleepGoal = (profile.sleep_goal_hours as number | undefined) ?? 8
    const baseline  = (profile.baseline_stress  as number | undefined) ?? 5
    // Персональные нормы. Если в профиле не заданы — используем
    // популяционные fallback'и, чтобы не блокировать недозаполненных юзеров.
    const targetCalories = (profile.target_calories  as number | undefined) ?? 2000
    const targetProtein  = (profile.target_protein_g as number | undefined) ?? 75
    const targetWaterMl  = (profile.target_water_ml  as number | undefined) ?? 2000

    // Процентное отклонение от персональной нормы. Защищает от
    // несправедливости абсолютных порогов: «70г белка» — alert для маленькой
    // женщины (норма 55) и good для крупного мужчины (норма 95).
    const proteinDeficit = avgProtein > 0
      ? (targetProtein - avgProtein) / targetProtein  // 0.25 = 25% дефицит
      : 0
    const calorieDeficit = avgCalories > 0
      ? (targetCalories - avgCalories) / targetCalories
      : 0

    // Минимальный порог (повышает severity): метрика в опасном диапазоне
    const minSeverity: Record<string, 'good' | 'attention' | 'alert'> = {}
    if (avgCalories > 0) {
      // alert: ≥25% недобор от персональной нормы калорий ИЛИ >75% профицит
      if (calorieDeficit >= 0.25 || avgCalories > targetCalories * 1.75) {
        minSeverity['food'] = 'alert'
      } else if (avgProtein > 0 && proteinDeficit >= 0.25) {
        // alert: ≥25% недобор белка
        minSeverity['food'] = 'alert'
      }
    }
    if (avgSleep > 0) {
      if (avgSleep < 5.5)      minSeverity['sleep'] = 'alert'
      else if (avgSleep > 10)  minSeverity['sleep'] = 'attention'
    }
    if (avgStress > 0) {
      if (avgStress > 8) {
        minSeverity['stress'] = 'alert'
      } else if (avgStress > 7 || (avgStress - baseline >= 2 && avgStress > 5)) {
        minSeverity['stress'] = 'attention'
      }
    }
    if (avgMood > 0) {
      if (avgMood < 4)        minSeverity['mood'] = 'alert'
      else if (avgMood < 6)   minSeverity['mood'] = 'attention'
    }

    // Максимальный порог (понижает severity). 5 г белка при норме 75 — это
    // вариативность, а не повод для alert. Универсальное правило:
    // отклонение < 10% от нормы — это «good», 10-25% — «attention».
    const maxSeverity: Record<string, 'good' | 'attention' | 'alert'> = {}
    if (avgStress > 0 && avgStress < 5)                    maxSeverity['stress']   = 'attention'
    if (avgSleep  > 0 && avgSleep  >= sleepGoal - 0.5)     maxSeverity['sleep']    = 'attention'
    if (avgMood   > 0 && avgMood   >= 6)                   maxSeverity['mood']     = 'attention'

    // Food: одновременно учитываем калории и белок.
    if (avgCalories > 0) {
      const maxDeficit = Math.max(calorieDeficit, proteinDeficit)
      if (maxDeficit < 0.10) {
        maxSeverity['food'] = 'good'      // < 10% — норма
      } else if (maxDeficit < 0.25) {
        maxSeverity['food'] = 'attention' // 10-25% — заметно, но не alert
      }
      // ≥ 25% — alert, потолок не применяется
    }

    // Water: тот же принцип — процентное отклонение от персональной нормы.
    // Берём avg по дням из healthData.water (там уже daily-aggregated по SQL).
    const dailyWater = (healthData.water ?? [])
      .map((r: { amount_ml?: number }) => r.amount_ml ?? 0)
      .filter((v: number) => v > 0)
    if (dailyWater.length > 0) {
      const avgWater = dailyWater.reduce((s: number, v: number) => s + v, 0) / dailyWater.length
      const waterDeficit = (targetWaterMl - avgWater) / targetWaterMl
      if (waterDeficit >= 0.50) {
        minSeverity['water'] = 'alert'
      } else if (waterDeficit < 0.10) {
        maxSeverity['water'] = 'good'
      } else if (waterDeficit < 0.30) {
        maxSeverity['water'] = 'attention'
      }
    }

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
}
