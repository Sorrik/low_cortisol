import type {
  SleepRecord,
  NutritionRecord,
  MoodRecord,
  StressRecord,
  ActivityRecord,
  WaterRecord,
  Recommendation,
} from "@/types/health"

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split("T")[0]
}

export const mockSleep: SleepRecord[] = [
  { id: "s1", date: daysAgo(0), hours: 7.2, quality: 4, notes: "Хороший сон" },
  { id: "s2", date: daysAgo(1), hours: 6.0, quality: 3 },
  { id: "s3", date: daysAgo(2), hours: 8.1, quality: 5, notes: "Отличный сон" },
  { id: "s4", date: daysAgo(3), hours: 5.5, quality: 2 },
  { id: "s5", date: daysAgo(4), hours: 7.0, quality: 4 },
  { id: "s6", date: daysAgo(5), hours: 6.8, quality: 3 },
  { id: "s7", date: daysAgo(6), hours: 7.5, quality: 4 },
]

export const mockFood: NutritionRecord[] = [
  { id: "f1", date: daysAgo(0), kcal: 1850, proteins: 120, fats: 65, carbs: 200, mealName: "Завтрак + Обед + Ужин" },
  { id: "f2", date: daysAgo(1), kcal: 2100, proteins: 140, fats: 70, carbs: 230 },
  { id: "f3", date: daysAgo(2), kcal: 1600, proteins: 100, fats: 55, carbs: 180 },
  { id: "f4", date: daysAgo(3), kcal: 2300, proteins: 150, fats: 80, carbs: 260 },
  { id: "f5", date: daysAgo(4), kcal: 1900, proteins: 125, fats: 60, carbs: 210 },
  { id: "f6", date: daysAgo(5), kcal: 2050, proteins: 135, fats: 72, carbs: 220 },
  { id: "f7", date: daysAgo(6), kcal: 1750, proteins: 110, fats: 58, carbs: 195 },
]

export const mockMood: MoodRecord[] = [
  { id: "m1", date: daysAgo(0), value: 4, notes: "Хорошее настроение" },
  { id: "m2", date: daysAgo(1), value: 3 },
  { id: "m3", date: daysAgo(2), value: 5, notes: "Отличный день" },
  { id: "m4", date: daysAgo(3), value: 2, notes: "Устал" },
  { id: "m5", date: daysAgo(4), value: 4 },
  { id: "m6", date: daysAgo(5), value: 3 },
  { id: "m7", date: daysAgo(6), value: 4 },
]

export const mockStress: StressRecord[] = [
  { id: "st1", date: daysAgo(0), level: 4, notes: "Нормально" },
  { id: "st2", date: daysAgo(1), level: 7, notes: "Рабочий день" },
  { id: "st3", date: daysAgo(2), level: 3 },
  { id: "st4", date: daysAgo(3), level: 8, notes: "Дедлайн" },
  { id: "st5", date: daysAgo(4), level: 5 },
  { id: "st6", date: daysAgo(5), level: 6 },
  { id: "st7", date: daysAgo(6), level: 4 },
]

export const mockActivity: ActivityRecord[] = [
  { id: "a1", date: daysAgo(0), type: "run", duration: 45, steps: 8500 },
  { id: "a2", date: daysAgo(1), type: "gym", duration: 60, steps: 3200 },
  { id: "a3", date: daysAgo(2), type: "walk", duration: 30, steps: 6000 },
  { id: "a4", date: daysAgo(3), type: "run", duration: 35, steps: 7200 },
  { id: "a5", date: daysAgo(4), type: "other", duration: 50, steps: 4500 },
  { id: "a6", date: daysAgo(5), type: "gym", duration: 70, steps: 3000 },
  { id: "a7", date: daysAgo(6), type: "walk", duration: 40, steps: 5500 },
]

export const mockWater: WaterRecord[] = [
  { id: "w1", date: daysAgo(0), glasses: 6 },
  { id: "w2", date: daysAgo(1), glasses: 8 },
  { id: "w3", date: daysAgo(2), glasses: 5 },
  { id: "w4", date: daysAgo(3), glasses: 7 },
  { id: "w5", date: daysAgo(4), glasses: 4 },
  { id: "w6", date: daysAgo(5), glasses: 8 },
  { id: "w7", date: daysAgo(6), glasses: 6 },
]

export const mockRecommendations: Recommendation[] = [
  {
    id: "r1",
    metric: "sleep",
    title: "Недостаточно сна",
    description: "Вы спали менее 6 часов три ночи подряд. Попробуйте ложиться на 30 минут раньше.",
    severity: "alert",
  },
  {
    id: "r2",
    metric: "stress",
    title: "Высокий стресс в будни",
    description: "Ваш уровень стресса достигал пика в рабочие дни. Попробуйте короткие дыхательные упражнения.",
    severity: "attention",
  },
  {
    id: "r3",
    metric: "water",
    title: "Водный баланс",
    description: "Отличная работа! Вы выполняете норму воды в большинство дней.",
    severity: "good",
  },
  {
    id: "r4",
    metric: "activity",
    title: "Регулярная активность",
    description: "Вы тренируетесь каждый день. Продолжайте в том же духе!",
    severity: "good",
  },
  {
    id: "r5",
    metric: "food",
    title: "Баланс макронутриентов",
    description: "Увеличьте долю белка в рационе. Текущее среднее ниже рекомендуемой нормы.",
    severity: "attention",
  },
  {
    id: "r6",
    metric: "mood",
    title: "Настроение стабильно",
    description: "Ваше настроение было стабильным на этой неделе. Это хороший знак!",
    severity: "good",
  },
]
