// backend/src/insights/feedback-summary.spec.ts
//
// Unit-тесты чистой функции aggregateFeedbackSummary — она конвертирует
// сырые feedback-строки в сводку для LLM-prompt (UserFeedbackSummary).
// Раньше логика была встроена в _getFeedbackSummary; вынесли её, чтобы
// тестировать без мока репозитория.

import { aggregateFeedbackSummary } from './insights.service'

type Row = { ruleId: string; rating: 'helpful' | 'not_helpful' }

describe('aggregateFeedbackSummary', () => {
  it('пустой массив → totalCount=0, пустые map\'ы', () => {
    const result = aggregateFeedbackSummary([])
    expect(result.totalCount).toBe(0)
    expect(result.byCategoryHelpful).toEqual({})
    expect(result.byCategoryNotHelpful).toEqual({})
    expect(result.topHelpfulRuleIds).toEqual([])
    expect(result.topNotHelpfulRuleIds).toEqual([])
  })

  it('подсчитывает helpful и not_helpful раздельно по rule_id', () => {
    const rows: Row[] = [
      { ruleId: 'sleep.short_sleep', rating: 'helpful' },
      { ruleId: 'sleep.short_sleep', rating: 'helpful' },
      { ruleId: 'sleep.short_sleep', rating: 'not_helpful' },
      { ruleId: 'nutrition.low_protein', rating: 'helpful' },
    ]
    const r = aggregateFeedbackSummary(rows)
    expect(r.totalCount).toBe(4)
    expect(r.topHelpfulRuleIds[0]).toEqual({ ruleId: 'sleep.short_sleep', count: 2 })
    expect(r.topNotHelpfulRuleIds[0]).toEqual({ ruleId: 'sleep.short_sleep', count: 1 })
  })

  it('извлекает категорию из rule_id (то, что до точки)', () => {
    const rows: Row[] = [
      { ruleId: 'sleep.short_sleep',   rating: 'helpful' },
      { ruleId: 'sleep.bad_quality',   rating: 'helpful' },
      { ruleId: 'nutrition.low_protein', rating: 'not_helpful' },
      { ruleId: 'nutrition.late_meal',   rating: 'not_helpful' },
      { ruleId: 'nutrition.late_meal',   rating: 'not_helpful' },
    ]
    const r = aggregateFeedbackSummary(rows)
    expect(r.byCategoryHelpful).toEqual({ sleep: 2 })
    expect(r.byCategoryNotHelpful).toEqual({ nutrition: 3 })
  })

  it('rule_id без точки целиком становится категорией', () => {
    // LLM-сгенерированные ID имеют форму llm.{hash} — но если приходит
    // ID без точки, мы не должны падать; используем как категорию.
    const rows: Row[] = [
      { ruleId: 'unknown', rating: 'helpful' },
      { ruleId: 'llm.abc123', rating: 'not_helpful' },
    ]
    const r = aggregateFeedbackSummary(rows)
    expect(r.byCategoryHelpful).toEqual({ unknown: 1 })
    expect(r.byCategoryNotHelpful).toEqual({ llm: 1 })
  })

  it('top-3 ruleIds отсортированы по убыванию count', () => {
    const rows: Row[] = [
      ...Array(5).fill({ ruleId: 'nutrition.late_meal',   rating: 'not_helpful' }),
      ...Array(3).fill({ ruleId: 'nutrition.low_protein', rating: 'not_helpful' }),
      ...Array(2).fill({ ruleId: 'sleep.bad_quality',     rating: 'not_helpful' }),
      ...Array(1).fill({ ruleId: 'stress.high',           rating: 'not_helpful' }),
    ]
    const r = aggregateFeedbackSummary(rows)
    // Топ-3 — без stress.high
    expect(r.topNotHelpfulRuleIds).toHaveLength(3)
    expect(r.topNotHelpfulRuleIds[0]).toEqual({ ruleId: 'nutrition.late_meal',   count: 5 })
    expect(r.topNotHelpfulRuleIds[1]).toEqual({ ruleId: 'nutrition.low_protein', count: 3 })
    expect(r.topNotHelpfulRuleIds[2]).toEqual({ ruleId: 'sleep.bad_quality',     count: 2 })
  })
})
