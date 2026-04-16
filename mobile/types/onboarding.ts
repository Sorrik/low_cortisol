// mobile/types/onboarding.ts

export type GoalType         = 'sleep' | 'stress' | 'energy' | 'mood' | 'weight'
export type SleepChronotype  = 'early_bird' | 'night_owl' | 'no_routine'
export type ActivityLevel    = 'sedentary' | 'light' | 'moderate' | 'active'
export type SportType        = 'running' | 'gym' | 'yoga' | 'cycling' | 'swimming' | 'team_sports' | 'martial_arts' | 'home_workout' | 'none'
export type SportGoal        = 'lose_weight' | 'build_muscle' | 'improve_endurance' | 'stay_healthy' | 'reduce_stress'
export type AgeRange         = '18-25' | '26-35' | '36-45' | '46+'
export type Gender           = 'male' | 'female' | 'other' | 'prefer_not_to_say'

export interface UserProfile {
  id:                    string
  userId:                string
  name:                  string | null
  ageRange:              AgeRange | null
  gender:                Gender | null
  goals:                 GoalType[]
  primaryGoal:           GoalType | null
  chronotype:            SleepChronotype | null
  sleepGoalHours:        number | null
  activityLevel:         ActivityLevel | null
  sportTypes:            SportType[]
  workoutsPerWeek:       number | null
  avgWorkoutDurationMin: number | null
  sportGoal:             SportGoal | null
  baselineStress:        number | null
  onboardingCompleted:   boolean
}

export interface OnboardingData {
  ageRange: AgeRange
  gender:   Gender
  name:     string
  goals:       GoalType[]
  primaryGoal: GoalType
  chronotype:     SleepChronotype
  sleepGoalHours: number
  activityLevel:         ActivityLevel
  sportTypes:            SportType[]
  workoutsPerWeek:       number
  avgWorkoutDurationMin: number
  sportGoal:             SportGoal | null
  baselineStress: number
}

// --- Конфигурации для UI (Лейблы и Эмодзи) ---

export const GOAL_CONFIG: Record<GoalType, { label: string; icon: string; desc: string }> = {
  sleep:  { label: 'Улучшить сон',        icon: '🌙', desc: 'Засыпать быстрее, спать глубже'     },
  stress: { label: 'Снизить стресс',      icon: '🧘', desc: 'Научиться управлять напряжением'    },
  energy: { label: 'Больше энергии',      icon: '⚡', desc: 'Чувствовать себя бодрым весь день'  },
  mood:   { label: 'Стабильное настроение', icon: '😊', desc: 'Ровный эмоциональный фон'         },
  weight: { label: 'Контроль веса',       icon: '🥗', desc: 'Питание и активность в балансе'     },
}

export const CHRONOTYPE_CONFIG: Record<SleepChronotype, { label: string; desc: string; time: string }> = {
  early_bird: { label: 'Жаворонок',  desc: 'Встаю до 7:00, ложусь до 23:00',  time: '06:00 – 22:30' },
  night_owl:  { label: 'Сова',       desc: 'Ложусь после полуночи, встаю позже', time: '09:00 – 01:00' },
  no_routine: { label: 'Без режима', desc: 'График меняется каждый день',        time: 'по-разному'    },
}

export const ACTIVITY_CONFIG: Record<ActivityLevel, { label: string; desc: string; icon: string }> = {
  sedentary: { label: 'Почти не занимаюсь', desc: 'Офисная работа, мало движения',    icon: '💻' },
  light:     { label: '1-2 раза в неделю',  desc: 'Прогулки, лёгкие тренировки',    icon: '🚶' },
  moderate:  { label: '3-4 раза в неделю',  desc: 'Регулярные тренировки',             icon: '跑' }, // Заменил на иконку бега для наглядности
  active:    { label: 'Каждый день',         desc: 'Спорт — часть жизни',             icon: '🏋️' },
}

export const SPORT_CONFIG: Record<SportType, { label: string; icon: string }> = {
  running:      { label: 'Бег',           icon: '🏃' },
  gym:          { label: 'Тренажёрный зал',icon: '🏋️' },
  yoga:         { label: 'Йога / растяжка',icon: '🧘' },
  cycling:      { label: 'Велосипед',      icon: '🚴' },
  swimming:     { label: 'Плавание',      icon: '🏊' },
  team_sports:  { label: 'Командные виды',icon: '⚽' },
  martial_arts: { label: 'Единоборства',   icon: '🥊' },
  home_workout: { label: 'Дома без инвентаря', icon: '🏠' },
  none:         { label: 'Не занимаюсь',   icon: '—'  },
}

export const SPORT_GOAL_CONFIG: Record<SportGoal, { label: string; icon: string }> = {
  lose_weight:        { label: 'Сбросить вес',          icon: '📉' },
  build_muscle:       { label: 'Набрать мышечную массу', icon: '💪' },
  improve_endurance:  { label: 'Улучшить выносливость',  icon: '🏅' },
  stay_healthy:       { label: 'Поддерживать здоровье',  icon: '❤️' },
  reduce_stress:      { label: 'Снять стресс спортом',   icon: '🧘' },
}

export const AGE_RANGE_LABELS: Record<AgeRange, string> = {
  '18-25': '18–25 лет',
  '26-35': '26–35 лет',
  '36-45': '36–45 лет',
  '46+':   '46+ лет',
}

export const GENDER_LABELS: Record<Gender, string> = {
  male:              'Мужской',
  female:            'Женский',
  other:             'Другой',
  prefer_not_to_say: 'Не указывать',
}

export const ONBOARDING_DEFAULTS: OnboardingData = {
  ageRange:             '18-25',
  gender:               'prefer_not_to_say',
  name:                 '',
  goals:                [],
  primaryGoal:          'mood',
  chronotype:           'no_routine',
  sleepGoalHours:       8,
  activityLevel:        'light',
  sportTypes:           [],
  workoutsPerWeek:      0,
  avgWorkoutDurationMin:45,
  sportGoal:            null,
  baselineStress:       5,
}