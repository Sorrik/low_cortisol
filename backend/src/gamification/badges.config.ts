// backend/src/gamification/badges.config.ts

import { BadgeId } from './gamification.entity'

export interface BadgeDefinition {
  id:          BadgeId
  emoji:       string
  title:       string
  description: string
  points:      number
  rarity:      'common' | 'rare' | 'epic' | 'legendary'
  category:    'streak_any' | 'streak_full' | 'streak_norm' | 'sleep' | 'stress'
             | 'mood' | 'activity' | 'water' | 'anomaly' | 'data' | 'level'
}

export const BADGES: Record<BadgeId, BadgeDefinition> = {

  // ── Стрик: Любые данные ───────────────────────────────────
  streak_any_3:   { id:'streak_any_3',   emoji:'🔥', rarity:'common',    category:'streak_any',  points:10,  title:'3 дня',         description:'3 дня подряд с любыми данными'        },
  streak_any_5:   { id:'streak_any_5',   emoji:'🔥', rarity:'common',    category:'streak_any',  points:20,  title:'5 дней',         description:'5 дней подряд'                        },
  streak_any_7:   { id:'streak_any_7',   emoji:'🔥', rarity:'common',    category:'streak_any',  points:50,  title:'Неделя!',        description:'7 дней подряд без пропусков'          },
  streak_any_10:  { id:'streak_any_10',  emoji:'🔥', rarity:'rare',      category:'streak_any',  points:80,  title:'10 дней',        description:'10 дней подряд'                       },
  streak_any_14:  { id:'streak_any_14',  emoji:'💪', rarity:'rare',      category:'streak_any',  points:120, title:'Две недели',     description:'14 дней — уже привычка'               },
  streak_any_20:  { id:'streak_any_20',  emoji:'💪', rarity:'rare',      category:'streak_any',  points:180, title:'20 дней',        description:'20 дней без пропусков'                },
  streak_any_30:  { id:'streak_any_30',  emoji:'⚡', rarity:'epic',      category:'streak_any',  points:300, title:'Месяц!',         description:'30 дней — настоящая дисциплина'       },
  streak_any_60:  { id:'streak_any_60',  emoji:'⚡', rarity:'epic',      category:'streak_any',  points:600, title:'60 дней',        description:'60 дней — два месяца подряд'          },
  streak_any_100: { id:'streak_any_100', emoji:'👑', rarity:'legendary', category:'streak_any',  points:1000,title:'100 дней',       description:'100 дней — легендарный результат'     },

  // ── Стрик: Все 6 метрик ───────────────────────────────────
  streak_full_3:  { id:'streak_full_3',  emoji:'✨', rarity:'common',    category:'streak_full', points:20,  title:'Полный день ×3',  description:'3 дня подряд с полным набором метрик' },
  streak_full_7:  { id:'streak_full_7',  emoji:'✨', rarity:'rare',      category:'streak_full', points:100, title:'Перфекционист',   description:'7 дней подряд — все 6 метрик'         },
  streak_full_14: { id:'streak_full_14', emoji:'🌟', rarity:'epic',      category:'streak_full', points:250, title:'Идеальный месяц', description:'14 дней подряд — полный набор'        },
  streak_full_30: { id:'streak_full_30', emoji:'💎', rarity:'legendary', category:'streak_full', points:700, title:'Бриллиант',       description:'30 дней подряд — все метрики'         },

  // ── Стрик: Выполнение нормы ───────────────────────────────
  streak_norm_3:  { id:'streak_norm_3',  emoji:'🎯', rarity:'common',    category:'streak_norm', points:30,  title:'В норме ×3',     description:'3 дня: сон ≥ цели и стресс ≤ базового'},
  streak_norm_7:  { id:'streak_norm_7',  emoji:'🎯', rarity:'rare',      category:'streak_norm', points:100, title:'Неделя в норме', description:'7 дней выполнения личных норм'        },
  streak_norm_14: { id:'streak_norm_14', emoji:'🎯', rarity:'epic',      category:'streak_norm', points:250, title:'Мастер нормы',   description:'14 дней в персональном балансе'       },
  streak_norm_30: { id:'streak_norm_30', emoji:'🏆', rarity:'legendary', category:'streak_norm', points:600, title:'Гармония',        description:'30 дней — сон и стресс в норме'       },

  // ── Сон ───────────────────────────────────────────────────
  sleep_week:     { id:'sleep_week',     emoji:'🌙', rarity:'rare',      category:'sleep',       points:80,  title:'Неделя хорошего сна', description:'7 дней подряд сон ≥ личной нормы' },
  sleep_champ:    { id:'sleep_champ',    emoji:'😴', rarity:'epic',      category:'sleep',       points:150, title:'Чемпион сна',    description:'14 дней качество сна ≥ 7/10'         },
  sleep_improver: { id:'sleep_improver', emoji:'📈', rarity:'rare',      category:'sleep',       points:100, title:'Сон улучшился',  description:'Среднее время сна выросло на 1+ ч'    },

  // ── Стресс ────────────────────────────────────────────────
  calm_week:      { id:'calm_week',      emoji:'🧘', rarity:'rare',      category:'stress',      points:80,  title:'Спокойная неделя',   description:'7 дней стресс ≤ базового уровня'  },
  stress_survivor:{ id:'stress_survivor',emoji:'🛡️', rarity:'epic',      category:'stress',      points:200, title:'Пережил кризис', description:'После критического стресса вернулся к норме'},
  zen_master:     { id:'zen_master',     emoji:'☮️', rarity:'legendary', category:'stress',      points:500, title:'Мастер дзен',    description:'30 дней стресс ≤ 4/10'               },

  // ── Настроение ────────────────────────────────────────────
  mood_rising:    { id:'mood_rising',    emoji:'📈', rarity:'common',    category:'mood',        points:40,  title:'Настроение растёт',  description:'5 дней подряд настроение улучшается'},
  mood_stable:    { id:'mood_stable',    emoji:'⚖️', rarity:'rare',      category:'mood',        points:100, title:'Эмоц. баланс',   description:'14 дней настроение ≥ 6/10'           },
  mood_improver:  { id:'mood_improver',  emoji:'🌈', rarity:'rare',      category:'mood',        points:120, title:'Счастливее',      description:'Среднее настроение выросло на 2+ балла'},

  // ── Активность ────────────────────────────────────────────
  active_week:     { id:'active_week',     emoji:'🏃', rarity:'common', category:'activity',    points:60,  title:'Активная неделя', description:'5 из 7 дней с физической активностью'},
  sport_starter:   { id:'sport_starter',   emoji:'🏋️', rarity:'rare',   category:'activity',    points:80,  title:'Начало пути',    description:'10 тренировок записано в системе'     },
  activity_improver:{ id:'activity_improver',emoji:'⚡',rarity:'rare',   category:'activity',    points:100, title:'Стал активнее',  description:'Среднее время активности выросло на 20%'},

  // ── Вода ─────────────────────────────────────────────────
  hydration_week: { id:'hydration_week', emoji:'💧', rarity:'rare',      category:'water',       points:80,  title:'Гидрация ×7',    description:'7 дней подряд норма воды ≥ 1500 мл'  },

  // ── Аномалии ──────────────────────────────────────────────
  anomaly_survived:   { id:'anomaly_survived',   emoji:'💥', rarity:'rare',  category:'anomaly', points:120, title:'Выброс пережит',    description:'После критической аномалии вернулся к норме за 3 дня'},
  anomaly_3_survived: { id:'anomaly_3_survived', emoji:'🦾', rarity:'epic',  category:'anomaly', points:300, title:'Кризисный менеджер',description:'Пережил и восстановился после 3 аномалий'            },

  // ── Данные ────────────────────────────────────────────────
  first_entry:    { id:'first_entry',    emoji:'🌱', rarity:'common',    category:'data',        points:10,  title:'Первый шаг',     description:'Первая запись данных о здоровье'      },
  completionist:  { id:'completionist',  emoji:'✅', rarity:'epic',      category:'data',        points:200, title:'Перфекционист',  description:'30 дней подряд — все 6 метрик'        },

  // ── Уровни ────────────────────────────────────────────────
  level_beginner: { id:'level_beginner', emoji:'🌱', rarity:'common',    category:'level',       points:0,   title:'Новичок',        description:'Старт пути'                           },
  level_amateur:  { id:'level_amateur',  emoji:'⭐', rarity:'common',    category:'level',       points:0,   title:'Любитель',       description:'Набрано 300 очков'                    },
  level_expert:   { id:'level_expert',   emoji:'🌟', rarity:'rare',      category:'level',       points:0,   title:'Эксперт',        description:'Набрано 700 очков'                    },
  level_master:   { id:'level_master',   emoji:'👑', rarity:'epic',      category:'level',       points:0,   title:'Мастер',         description:'Набрано 1500 очков'                   },
}

export const LEVEL_THRESHOLDS = [
  { level: 1, minPoints: 0,    name: 'Новичок',  badge: 'level_beginner' as BadgeId },
  { level: 2, minPoints: 300,  name: 'Любитель', badge: 'level_amateur'  as BadgeId },
  { level: 3, minPoints: 700,  name: 'Эксперт',  badge: 'level_expert'   as BadgeId },
  { level: 4, minPoints: 1500, name: 'Мастер',   badge: 'level_master'   as BadgeId },
]

export function getLevelByPoints(points: number) {
  return [...LEVEL_THRESHOLDS].reverse().find(l => points >= l.minPoints)
    ?? LEVEL_THRESHOLDS[0]
}

// Все стрик-бейджи сгруппированные по типу и порогу
export const STREAK_BADGES = {
  any:  [3, 5, 7, 10, 14, 20, 30, 60, 100] as const,
  full: [3, 7, 14, 30] as const,
  norm: [3, 7, 14, 30] as const,
}