// backend/src/insights/causal-chain.service.spec.ts
//
// Юнит-тесты CausalChainService.
// Сейчас покрыт smoke-сценарий A1 (поздний жирный ужин → плохой сон).
// Шаблон легко расширяется на остальные 15 детекторов: подменяешь
// healthData и проверяешь ожидаемый chainId/strength.

import { CausalChainService } from './causal-chain.service'
import type { CausalChainHealthData } from './causal-chain.service'

function date(offsetDays: number): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

/**
 * Базовая «нейтральная» 14-дневная история: метрики в норме, никаких
 * аномалий. Используется как фон для сценариев — в каждом тесте мы
 * подменяем конкретные дни/значения, не трогая остальное.
 */
function neutralHistory(): CausalChainHealthData {
  const sleep:    CausalChainHealthData['sleep']    = []
  const mood:     CausalChainHealthData['mood']     = []
  const stress:   CausalChainHealthData['stress']   = []
  const activity: CausalChainHealthData['activity'] = []
  const water:    CausalChainHealthData['water']    = []
  const nutrition: CausalChainHealthData['nutrition'] = []

  for (let i = -13; i <= 0; i++) {
    const d = date(i)
    sleep.push({
      date: d,
      duration_hours: 7.5,
      quality: 8,
      interruptions: 0,
      bed_time: '23:00',
      wake_time: '06:30',
    })
    mood.push({ date: d, mood_score: 7 })
    stress.push({ date: d, level: 4 })
    activity.push({
      date: d,
      duration_minutes: 35,
      intensity: 'moderate',
      time: '08:00',
    })
    water.push({ date: d, amount_ml: 2100 })
    nutrition.push({
      date: d,
      calories: 2100,
      protein_grams: 90,
      carbs_grams: 240,
      fat_grams: 70,
      time: '13:00',
    })
  }

  return { sleep, mood, stress, activity, water, nutrition }
}

describe('CausalChainService', () => {
  let service: CausalChainService

  beforeEach(() => {
    service = new CausalChainService()
  })

  describe('A1: late fatty meal yesterday → bad sleep today', () => {
    it('срабатывает при совпадении условий', () => {
      const history = neutralHistory()
      const yesterday = date(-1)
      const today = date(0)

      // Вчера — поздний жирный ужин: 650 ккал, 30г жира, в 22:30
      history.nutrition.push({
        date: yesterday,
        calories: 650,
        protein_grams: 20,
        carbs_grams: 30,
        fat_grams: 30,
        time: '22:30',
      })

      // Сегодня — плохой сон: 4.5ч, качество 4/10
      const todaySleep = history.sleep.find(s => s.date === today)!
      todaySleep.duration_hours = 4.5
      todaySleep.quality = 4
      todaySleep.interruptions = 3
      todaySleep.bed_time = '01:30'
      todaySleep.wake_time = '06:00'

      const result = service.detect(
        history,
        { sleepGoalHours: 8, baselineStress: 5 },
        { topN: 5 },
      )

      const a1 = result.chains.find(c => c.chainId === 'A1')
      expect(a1).toBeDefined()
      expect(a1!.strength).toMatch(/^(moderate|strong)$/)
      expect(a1!.trigger.metric).toBe('nutrition')
      expect(a1!.outcome.metric).toBe('sleep')
      expect(a1!.outcome.value).toBe(4)  // sleep_quality
      expect(a1!.lagDescription).toBe('вчера → сегодня')
      expect(a1!.recommendation).toContain('650')
      expect(a1!.recommendation).toContain('4/10')
    })

    it('не срабатывает если ужин не жирный', () => {
      const history = neutralHistory()
      const yesterday = date(-1)
      const today = date(0)

      // Вчера — поздний, но не жирный ужин (5г жира на 650 ккал → ratio < 0.35)
      history.nutrition.push({
        date: yesterday,
        calories: 650,
        protein_grams: 50,
        carbs_grams: 90,
        fat_grams: 5,
        time: '22:30',
      })

      const todaySleep = history.sleep.find(s => s.date === today)!
      todaySleep.duration_hours = 4.5
      todaySleep.quality = 4

      const result = service.detect(
        history,
        { sleepGoalHours: 8, baselineStress: 5 },
      )

      expect(result.chains.find(c => c.chainId === 'A1')).toBeUndefined()
    })

    it('не срабатывает если сон сегодня нормальный', () => {
      const history = neutralHistory()
      const yesterday = date(-1)

      history.nutrition.push({
        date: yesterday,
        calories: 650,
        protein_grams: 20,
        carbs_grams: 30,
        fat_grams: 30,
        time: '22:30',
      })

      // Сегодня сон не трогаем — он нормальный (7.5ч, quality 8)
      const result = service.detect(
        history,
        { sleepGoalHours: 8, baselineStress: 5 },
      )

      expect(result.chains.find(c => c.chainId === 'A1')).toBeUndefined()
    })
  })

  describe('F1: хороший сон вчера → отличное настроение сегодня', () => {
    it('срабатывает при позитивной цепочке', () => {
      const history = neutralHistory()
      const yesterday = date(-1)
      const today = date(0)

      const yestSleep = history.sleep.find(s => s.date === yesterday)!
      yestSleep.duration_hours = 8.1
      yestSleep.quality = 9

      const todayMood = history.mood.find(m => m.date === today)!
      todayMood.mood_score = 9

      const result = service.detect(
        history,
        { sleepGoalHours: 8, baselineStress: 5 },
      )

      const f1 = result.chains.find(c => c.chainId === 'F1')
      expect(f1).toBeDefined()
      expect(f1!.category).toBe('positive')
    })
  })

  describe('персональные пороги вместо хардкода', () => {
    it('A3: на крупном юзере (TDEE 2800) порог дефицита выше, чем 1500*0.7', () => {
      // Юзер с targetCalories=2800, minCalories=2380. Severe deficit
      // = 2380*0.7 = 1666 ккал. Дефолтный порог был бы 1500*0.7=1050.
      const history = neutralHistory()
      const yesterday = date(-1)
      const today = date(0)

      // Вчера — 1500 ккал. Для дефолтного порога это НЕ дефицит (≥1050),
      // а для персонального уже дефицит (<1666).
      const yestNutrition = history.nutrition.find(n => n.date === yesterday)!
      yestNutrition.calories = 1500
      const todayMood = history.mood.find(m => m.date === today)!
      todayMood.mood_score = 4  // ниже 7-1.5 = 5.5

      const result = service.detect(
        history,
        {
          sleepGoalHours: 8,
          baselineStress: 5,
          weightKg: 95,
          calorieTargets: {
            targetCalories: 2800,
            minCalories:    2380,
            maxCalories:    3360,
          },
        },
      )

      const a3 = result.chains.find(c => c.chainId === 'A3')
      expect(a3).toBeDefined()
      // В тексте должна быть персональная норма, не дефолтная
      expect(a3!.trigger.description).toContain('2380')
    })

    it('A3: на маленьком юзере (TDEE 1700) НЕ срабатывает на 1500 ккал', () => {
      // Юзер с targetCalories=1700, minCalories=1445. Severe deficit
      // = 1445*0.7 = 1011 ккал. 1500 ккал — это норма для неё.
      const history = neutralHistory()
      const yesterday = date(-1)

      const yestNutrition = history.nutrition.find(n => n.date === yesterday)!
      yestNutrition.calories = 1500

      const result = service.detect(
        history,
        {
          sleepGoalHours: 8,
          baselineStress: 5,
          weightKg: 52,
          calorieTargets: {
            targetCalories: 1700,
            minCalories:    1445,
            maxCalories:    2040,
          },
        },
      )

      expect(result.chains.find(c => c.chainId === 'A3')).toBeUndefined()
    })

    it('A4: на крупном юзере порог белка >50г', () => {
      // weightKg=95 → proteinMin = max(60, 95*1.0) = 95г.
      // Юзер ест 70г белка/день — для дефолта (50) это норма, для нашего — дефицит.
      const history = neutralHistory()
      for (const n of history.nutrition) n.protein_grams = 70
      for (const m of history.mood) m.mood_score = 4

      const result = service.detect(
        history,
        {
          weightKg: 95,
          calorieTargets: { targetCalories: 2800, minCalories: 2380, maxCalories: 3360 },
        },
      )

      const a4 = result.chains.find(c => c.chainId === 'A4')
      expect(a4).toBeDefined()
      expect(a4!.trigger.description).toContain('95')  // персональная норма
    })

    it('B3: на крупном юзере порог воды >1500 мл', () => {
      // weightKg=95 → waterMin = max(1500, 95*30) = 2850 мл.
      // Юзер выпил 2000 мл при 95-минутной тренировке — для дефолта это норма,
      // для нас — дефицит.
      const history = neutralHistory()
      const today = date(0)
      const todayActivity = history.activity.find(a => a.date === today)!
      todayActivity.duration_minutes = 95
      const todayWater = history.water.find(w => w.date === today)!
      todayWater.amount_ml = 2000

      const result = service.detect(
        history,
        {
          weightKg: 95,
          calorieTargets: { targetCalories: 2800, minCalories: 2380, maxCalories: 3360 },
        },
      )

      const b3 = result.chains.find(c => c.chainId === 'B3')
      expect(b3).toBeDefined()
      expect(b3!.outcome.description).toContain('2850')
    })

    it('без профиля используются разумные дефолты (1500/60/1500)', () => {
      // Smoke: при пустом профиле детекторы не падают, A1 продолжает работать.
      const history = neutralHistory()
      const yesterday = date(-1)
      const today = date(0)

      history.nutrition.push({
        date: yesterday,
        calories: 650,
        protein_grams: 20,
        carbs_grams: 30,
        fat_grams: 30,
        time: '22:30',
      })
      const todaySleep = history.sleep.find(s => s.date === today)!
      todaySleep.duration_hours = 4.5
      todaySleep.quality = 4

      const result = service.detect(history, {})  // профиль пустой
      const a1 = result.chains.find(c => c.chainId === 'A1')
      expect(a1).toBeDefined()
    })
  })

  describe('базовые инварианты', () => {
    it('возвращает пустой массив на коротком окне', () => {
      const history: CausalChainHealthData = {
        sleep: [],
        mood: [],
        stress: [],
        activity: [],
        water: [],
        nutrition: [],
      }
      const result = service.detect(history, {})
      expect(result.chains).toEqual([])
      expect(result.detectedCount).toBe(0)
    })

    it('сортирует цепочки по priority desc и ограничивает topN', () => {
      const history = neutralHistory()
      const result = service.detect(history, {}, { topN: 2 })
      expect(result.chains.length).toBeLessThanOrEqual(2)
      for (let i = 1; i < result.chains.length; i++) {
        expect(result.chains[i - 1].priority).toBeGreaterThanOrEqual(result.chains[i].priority)
      }
    })
  })
})
