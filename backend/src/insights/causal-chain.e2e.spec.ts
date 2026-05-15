// backend/src/insights/causal-chain.e2e.spec.ts
//
// E2E smoke-тест на сценарий «late eater»: проверяет, что seed-фикстура
// 14 дней (поздние жирные ужины + плохой сон) проходит весь конвейер
// CausalChainService → toChainSummary → buildRecommendationPrompt и
// в итоговом тексте промпта присутствуют:
//   • цепочка A1 со strong/moderate
//   • конкретное число калорий ужина и качество сна
//   • дата триггера в формате DD.MM
//
// Тест защищает фичу causal chains от регрессий в трёх местах сразу:
// детекторе, преобразователе summary, и компоновщике промпта.

import { CausalChainService, CausalChainHealthData } from './causal-chain.service'
import { toChainSummary } from './causal-chain.types'
import { buildRecommendationPrompt } from '../llm/prompt-builder'

// Утилита: вычитает n дней из ISO YYYY-MM-DD (UTC).
function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function ruDate(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`
}

// Late-eater seed: 11 здоровых дней + 3 «плохих» дня в конце.
// Это критично: baseline качества сна формируется из старых дней
// (slice(-33, -3) в _buildBaselines), а сегодняшний день сравнивается
// с этим baseline. Если все 14 дней одинаково плохие — baseline сам
// окажется низким, и абсолютная разница исчезнет.
function buildLateEaterFixture(): CausalChainHealthData {
  const sleep: CausalChainHealthData['sleep'] = []
  const nutrition: CausalChainHealthData['nutrition'] = []
  const mood: CausalChainHealthData['mood'] = []
  const stress: CausalChainHealthData['stress'] = []
  const activity: CausalChainHealthData['activity'] = []
  const water: CausalChainHealthData['water'] = []

  for (let i = 13; i >= 0; i--) {
    const date = daysAgo(i)
    const isRecentBad = i <= 2  // последние 3 дня — плохие

    if (isRecentBad) {
      sleep.push({
        date,
        duration_hours: 5.2,
        quality:        4,
        bed_time:       '00:30',
        wake_time:      '06:30',
        interruptions:  2,
      })
      // Поздний жирный ужин 22:30, 650 ккал, 30г жира
      nutrition.push({
        date,
        calories:      650,
        protein_grams: 25,
        carbs_grams:   35,
        fat_grams:     30,
        time:          '22:30',
      })
      nutrition.push({
        date,
        calories:      1400,
        protein_grams: 70,
        carbs_grams:   180,
        fat_grams:     40,
        time:          '13:00',
      })
      mood.push({ date, mood_score: 5 })
      stress.push({ date, level: 7 })
    } else {
      // Здоровый baseline: 8ч сна, качество 8, без позднего ужина
      sleep.push({
        date,
        duration_hours: 8.0,
        quality:        8,
        bed_time:       '22:30',
        wake_time:      '06:30',
        interruptions:  0,
      })
      nutrition.push({
        date,
        calories:      2100,
        protein_grams: 100,
        carbs_grams:   240,
        fat_grams:     70,
        time:          '19:00',
      })
      mood.push({ date, mood_score: 7 })
      stress.push({ date, level: 4 })
    }

    activity.push({ date, duration_minutes: 30, intensity: 'moderate', time: '18:00' })
    water.push({ date, amount_ml: 1800 })
  }

  return { sleep, mood, stress, activity, water, nutrition }
}

describe('E2E: late-eater seed → causal chain → prompt', () => {
  it('детектирует A1 на late-eater сценарии и помещает её в промпт', () => {
    const healthData = buildLateEaterFixture()

    const service = new CausalChainService()
    const result = service.detect(healthData, {}, { topN: 5 })

    // 1. Цепочка A1 должна быть обнаружена
    const a1 = result.chains.find(c => c.chainId === 'A1')
    expect(a1).toBeDefined()
    expect(['strong', 'moderate']).toContain(a1!.strength)

    // 2. Триггер должен ссылаться на вчерашнюю дату с конкретными числами
    const yesterday = daysAgo(1)
    expect(a1!.trigger.date).toBe(yesterday)
    expect(a1!.trigger.description).toContain('650')
    expect(a1!.trigger.description).toContain('30')

    // 3. Исход — сегодняшний день, качество сна 4/10
    expect(a1!.outcome.date).toBe(daysAgo(0))
    expect(a1!.outcome.description).toContain('4/10')

    // 4. Прогоняем через prompt-builder с _causal_chains
    const prompt = buildRecommendationPrompt(
      {
        ...healthData,
        _causal_chains: result.chains.map(toChainSummary),
      },
      [],
    )

    // 5. В промпте должен быть блок ПРИЧИННО-СЛЕДСТВЕННЫЕ ЦЕПОЧКИ
    expect(prompt).toMatch(/ПРИЧИННО-СЛЕДСТВЕННЫЕ ЦЕПОЧКИ/)
    expect(prompt).toContain('A1')

    // 6. Конкретные числа триггера и исхода должны быть в тексте
    expect(prompt).toContain('650')
    expect(prompt).toContain('4/10')

    // 7. Дата в формате DD.MM должна присутствовать (триггер)
    expect(prompt).toContain(ruDate(yesterday))

    // 8. System prompt rule 11 заставляет LLM использовать цепочку как
    //    основу хотя бы одной рекомендации — проверим, что само правило
    //    добавлено в промпт.
    expect(prompt).toMatch(/ПРИЧИННО-СЛЕДСТВЕННЫЕ ЦЕПОЧКИ\s+—\s+ПРИОРИТЕТ/)
  })

  it('healthy seed → A1 не срабатывает, F1/F2 имеют шанс', () => {
    const sleep: CausalChainHealthData['sleep'] = []
    const nutrition: CausalChainHealthData['nutrition'] = []
    const mood: CausalChainHealthData['mood'] = []
    const stress: CausalChainHealthData['stress'] = []
    const activity: CausalChainHealthData['activity'] = []
    const water: CausalChainHealthData['water'] = []

    for (let i = 13; i >= 0; i--) {
      const date = daysAgo(i)
      sleep.push({
        date,
        duration_hours: 8.0,
        quality:        8,
        bed_time:       '22:30',
        wake_time:      '06:30',
        interruptions:  0,
      })
      nutrition.push({
        date,
        calories:      2100,
        protein_grams: 100,
        carbs_grams:   240,
        fat_grams:     70,
        time:          '19:00',  // вечерний приём, но до 21:00 → не late
      })
      mood.push({ date, mood_score: 8 })
      stress.push({ date, level: 3 })
      activity.push({ date, duration_minutes: 45, intensity: 'moderate', time: '17:00' })
      water.push({ date, amount_ml: 2200 })
    }

    const service = new CausalChainService()
    const result = service.detect({ sleep, mood, stress, activity, water, nutrition }, {})

    // A1 не должна срабатывать
    expect(result.chains.find(c => c.chainId === 'A1')).toBeUndefined()
    // Negative chains в принципе не должны срабатывать на здоровом профиле
    const negativeIds = result.chains.filter(c =>
      ['A1', 'A2', 'B2', 'C1', 'C3', 'D1', 'D2', 'D3', 'E1'].includes(c.chainId),
    )
    expect(negativeIds).toHaveLength(0)
  })
})
