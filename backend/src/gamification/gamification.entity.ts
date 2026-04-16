// backend/src/gamification/gamification.entity.ts

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm'

export type BadgeId =
  // Стрики — любые данные
  | 'streak_any_3'  | 'streak_any_5'  | 'streak_any_7'  | 'streak_any_10'
  | 'streak_any_14' | 'streak_any_20' | 'streak_any_30' | 'streak_any_60' | 'streak_any_100'
  // Стрики — все 6 метрик
  | 'streak_full_3' | 'streak_full_7' | 'streak_full_14' | 'streak_full_30'
  // Стрики — выполнение нормы (сон ≥ цели + стресс ≤ базового)
  | 'streak_norm_3' | 'streak_norm_7' | 'streak_norm_14' | 'streak_norm_30'
  // Сон
  | 'sleep_week' | 'sleep_champ' | 'sleep_improver'
  // Стресс
  | 'calm_week' | 'stress_survivor' | 'zen_master'
  // Настроение
  | 'mood_rising' | 'mood_stable' | 'mood_improver'
  // Активность
  | 'active_week' | 'sport_starter' | 'activity_improver'
  // Вода
  | 'hydration_week'
  // Аномалии
  | 'anomaly_survived' | 'anomaly_3_survived'
  // Данные
  | 'first_entry' | 'completionist'
  // Уровни
  | 'level_beginner' | 'level_amateur' | 'level_expert' | 'level_master'

@Entity('user_gamification')
export class UserGamification {

  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ name: 'user_id', unique: true })
  userId!: string

  // ── Стрик 1: Любые данные ─────────────────────────────────
  @Column({ name: 'streak_any_current', default: 0 })
  streakAnyCurrent!: number

  @Column({ name: 'streak_any_longest', default: 0 })
  streakAnyLongest!: number

  // ── Стрик 2: Все 6 метрик ─────────────────────────────────
  @Column({ name: 'streak_full_current', default: 0 })
  streakFullCurrent!: number

  @Column({ name: 'streak_full_longest', default: 0 })
  streakFullLongest!: number

  // ── Стрик 3: Выполнение личной нормы ──────────────────────
  // Сон ≥ sleepGoalHours И стресс ≤ baselineStress
  @Column({ name: 'streak_norm_current', default: 0 })
  streakNormCurrent!: number

  @Column({ name: 'streak_norm_longest', default: 0 })
  streakNormLongest!: number

  // ── Общее ─────────────────────────────────────────────────
  @Column({ name: 'last_entry_date', type: 'date', nullable: true })
  lastEntryDate!: string | null

  @Column({ name: 'last_full_date', type: 'date', nullable: true })
  lastFullDate!: string | null

  @Column({ name: 'last_norm_date', type: 'date', nullable: true })
  lastNormDate!: string | null

  @Column({ name: 'streak_freeze_used', default: false })
  streakFreezeUsed!: boolean

  // ── Очки и уровень ────────────────────────────────────────
  @Column({ name: 'total_points', default: 0 })
  totalPoints!: number

  @Column({ default: 1 })
  level!: number

  @Column({ name: 'level_name', type: 'varchar', default: 'Новичок' })
  levelName!: string

  // ── Бейджи ────────────────────────────────────────────────
  @Column({ type: 'simple-json', default: '[]' })
  badges!: BadgeId[]

  @Column({ name: 'badge_dates', type: 'simple-json', default: '{}' })
  badgeDates!: Record<string, string>

  // ── Вспомогательные счётчики для бейджей ─────────────────
  @Column({ name: 'total_entries', default: 0 })
  totalEntries!: number

  @Column({ name: 'calm_days_streak', default: 0 })
  calmDaysStreak!: number

  @Column({ name: 'good_sleep_streak', default: 0 })
  goodSleepStreak!: number

  @Column({ name: 'mood_rising_days', default: 0 })
  moodRisingDays!: number

  @Column({ name: 'hydration_days_streak', default: 0 })
  hydrationDaysStreak!: number

  @Column({ name: 'anomalies_survived', default: 0 })
  anomaliesSurvived!: number

  // Предыдущие средние для отслеживания улучшений
  @Column({ name: 'prev_avg_sleep', type: 'float', nullable: true })
  prevAvgSleep!: number | null

  @Column({ name: 'prev_avg_mood', type: 'float', nullable: true })
  prevAvgMood!: number | null

  @Column({ name: 'prev_avg_activity', type: 'float', nullable: true })
  prevAvgActivity!: number | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}