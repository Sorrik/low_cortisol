// backend/src/insights/calorie-thresholds.service.spec.ts

import { computeCalorieThresholds } from './calorie-thresholds.service'

describe('computeCalorieThresholds', () => {

  describe('Mifflin-St Jeor с точными данными', () => {
    it('считает BMR/TDEE для мужчины 25 лет, 80 кг, 180 см, активность moderate', () => {
      const result = computeCalorieThresholds({
        gender: 'male',
        age: 25,
        weightKg: 80,
        heightCm: 180,
        ageRange: null,
        activityLevel: 'moderate',
        nutritionGoal: 'maintain',
      })

      // BMR = 10*80 + 6.25*180 - 5*25 + 5 = 800 + 1125 - 125 + 5 = 1805
      expect(result.bmr).toBe(1805)
      // TDEE = 1805 * 1.55 = 2797.75 -> округление
      expect(result.tdee).toBeGreaterThanOrEqual(2797)
      expect(result.tdee).toBeLessThanOrEqual(2798)
      // target = tdee при maintain
      expect(result.targetCalories).toBe(result.tdee)
    })

    it('считает BMR для женщины 30 лет, 65 кг, 168 см, light', () => {
      const result = computeCalorieThresholds({
        gender: 'female',
        age: 30,
        weightKg: 65,
        heightCm: 168,
        ageRange: null,
        activityLevel: 'light',
        nutritionGoal: 'maintain',
      })

      // BMR = 10*65 + 6.25*168 - 5*30 - 161 = 650 + 1050 - 150 - 161 = 1389
      expect(result.bmr).toBe(1389)
      // TDEE = 1389 * 1.375 = 1909.875 -> ~1910
      expect(result.tdee).toBeGreaterThanOrEqual(1909)
      expect(result.tdee).toBeLessThanOrEqual(1910)
    })
  })

  describe('nutritionGoal сдвигает targetCalories', () => {
    const baseInput = {
      gender:        'male'      as const,
      age:           25,
      weightKg:      80,
      heightCm:      180,
      ageRange:      null,
      activityLevel: 'moderate'  as const,
    }

    it('lose_weight даёт ~85% от TDEE', () => {
      const r = computeCalorieThresholds({ ...baseInput, nutritionGoal: 'lose_weight' })
      expect(r.targetCalories).toBeCloseTo(r.tdee * 0.85, -1)
    })

    it('maintain даёт ровно TDEE', () => {
      const r = computeCalorieThresholds({ ...baseInput, nutritionGoal: 'maintain' })
      expect(r.targetCalories).toBe(r.tdee)
    })

    it('muscle_gain даёт ~110% от TDEE', () => {
      const r = computeCalorieThresholds({ ...baseInput, nutritionGoal: 'muscle_gain' })
      expect(r.targetCalories).toBeCloseTo(r.tdee * 1.1, -1)
    })

    it('min/max границы считаются от targetCalories', () => {
      const lose = computeCalorieThresholds({ ...baseInput, nutritionGoal: 'lose_weight' })
      const gain = computeCalorieThresholds({ ...baseInput, nutritionGoal: 'muscle_gain' })
      // Дефицитная цель → нижний порог ниже, чем у muscle_gain.
      expect(lose.minCalories).toBeLessThan(gain.minCalories)
      expect(lose.maxCalories).toBeLessThan(gain.maxCalories)
    })
  })

  describe('fallback на популяционные средние', () => {
    it('без weightKg и heightCm использует средние по полу', () => {
      const r = computeCalorieThresholds({
        gender: 'female',
        age: 30,
        weightKg: null,
        heightCm: null,
        ageRange: null,
        activityLevel: 'light',
        nutritionGoal: 'maintain',
      })

      // Female default: 67 кг, 165 см, age 30 → BMR = 10*67 + 6.25*165 - 5*30 - 161 = 670 + 1031.25 - 150 - 161 = 1390.25 → 1390
      expect(r.bmr).toBeGreaterThanOrEqual(1389)
      expect(r.bmr).toBeLessThanOrEqual(1391)
    })

    it('точные данные дают другой BMR, чем популяционные', () => {
      const exact = computeCalorieThresholds({
        gender: 'male',
        age: 25,
        weightKg: 95,
        heightCm: 188,
        ageRange: null,
        activityLevel: 'active',
        nutritionGoal: 'maintain',
      })
      const fallback = computeCalorieThresholds({
        gender: 'male',
        age: null,
        weightKg: null,
        heightCm: null,
        ageRange: null,
        activityLevel: 'active',
        nutritionGoal: 'maintain',
      })
      // Крупный пользователь (95/188) должен получить заметно больше калорий
      // чем популяционный мужчина (78/178).
      expect(exact.tdee).toBeGreaterThan(fallback.tdee + 300)
    })

    it('полностью пустой профиль → дефолтные значения', () => {
      const r = computeCalorieThresholds({
        gender: null,
        age: null,
        weightKg: null,
        heightCm: null,
        ageRange: null,
        activityLevel: null,
        nutritionGoal: null,
      })
      expect(r.bmr).toBe(1620)
      expect(r.tdee).toBe(2230)
    })
  })
})
