// backend/src/insights/causal-chain.types.ts
//
// Типы для CausalChainService — выявление причинно-следственных цепочек
// между метриками. См. план в design notes
// (16 паттернов A1–F2).

export type CausalMetric =
  | 'sleep'
  | 'mood'
  | 'stress'
  | 'activity'
  | 'nutrition'
  | 'water'

export type ChainStrength = 'weak' | 'moderate' | 'strong'

export type ChainCategory =
  | 'nutrition_sleep'   // A1, A2
  | 'nutrition_mood'    // A3, A4
  | 'activity_sleep'    // B1, B2
  | 'activity_hydration' // B3
  | 'sleep_stress'      // C1
  | 'sleep_mood'        // C2, C3
  | 'stress_eating'     // D1
  | 'stress_sleep'      // D2
  | 'stress_hydration'  // D3
  | 'hydration_energy'  // E1
  | 'fuel_recovery'     // E2
  | 'positive'          // F1, F2

/** Одно звено цепочки — конкретное измерение конкретной метрики. */
export interface CausalChainStep {
  metric: CausalMetric
  /** ISO YYYY-MM-DD. Для оконных цепочек — последняя дата окна. */
  date: string
  /** Значение метрики (часы, баллы, ккал, мл, …). */
  value: number
  /** Единица измерения для UI и подстановки в текст. */
  unit: string
  /**
   * Человекочитаемое описание звена, готовое к вставке в LLM prompt.
   * Пример: «ужин 650 ккал, 30г жира в 22:30» или «сон 4.5ч, 3 прерывания».
   */
  description: string
}

/**
 * Полная причинно-следственная цепочка между двумя–тремя метриками.
 * Передаётся в LLM как «факт из данных пользователя», на основе которого
 * формулируется рекомендация.
 */
export interface CausalChain {
  /** Идентификатор паттерна из карты: A1, A2, …, F2. */
  chainId: string

  category: ChainCategory

  /** Качество доказательства цепочки (см. план, расчёт strength). */
  strength: ChainStrength

  /** Причина — что случилось «до». */
  trigger: CausalChainStep

  /** Посредник — необязательное промежуточное звено. */
  mediator?: CausalChainStep

  /** Следствие — что случилось «после». */
  outcome: CausalChainStep

  /** «Вчера → сегодня», «за 7 дней», «3 дня подряд». */
  lagDescription: string

  /** Короткий физиологический механизм для LLM. */
  mechanism: string

  /**
   * Готовый текст совета — fallback на случай если LLM недоступен и нужно
   * показать рекомендацию из rule-based слоя.
   */
  recommendation: string

  /** 0–100. Выше = важнее показать пользователю. */
  priority: number

  tags: string[]
}

export interface CausalChainsResult {
  /** Отсортированы по priority desc, обрезаны до topN. */
  chains: CausalChain[]
  /** Полное число обнаруженных цепочек до topN. */
  detectedCount: number
}

/**
 * Сводка для передачи в LLM prompt. Не включает recommendation/priority/tags —
 * они нужны только на сервере. Это уменьшает размер промпта.
 */
export interface CausalChainSummary {
  chainId: string
  category: ChainCategory
  strength: ChainStrength
  trigger: CausalChainStep
  mediator?: CausalChainStep
  outcome: CausalChainStep
  lagDescription: string
  mechanism: string
}

/**
 * Преобразование полного CausalChain → CausalChainSummary для prompt.
 * Используется в InsightsService при подготовке enrichedData._causal_chains.
 */
export function toChainSummary(chain: CausalChain): CausalChainSummary {
  const summary: CausalChainSummary = {
    chainId:        chain.chainId,
    category:       chain.category,
    strength:       chain.strength,
    trigger:        chain.trigger,
    outcome:        chain.outcome,
    lagDescription: chain.lagDescription,
    mechanism:      chain.mechanism,
  }
  if (chain.mediator) summary.mediator = chain.mediator
  return summary
}
