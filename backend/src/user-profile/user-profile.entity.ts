// backend/src/user-profile/user-profile.entity.ts

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn,
} from 'typeorm'
import { User } from '../users/user.entity'

export type GoalType        = 'sleep' | 'stress' | 'energy' | 'mood' | 'weight'
export type SleepChronotype = 'early_bird' | 'night_owl' | 'no_routine'
export type ActivityLevel   = 'sedentary' | 'light' | 'moderate' | 'active'
export type SportType       = 'running' | 'gym' | 'yoga' | 'cycling' | 'swimming' | 'team_sports' | 'martial_arts' | 'home_workout' | 'none'
export type Gender          = 'male' | 'female'
/** Цель по питанию — определяет смещение target_calories относительно TDEE. */
export type NutritionGoal   = 'lose_weight' | 'maintain' | 'muscle_gain'

/**
 * Устаревший тип возрастных диапазонов. Сохранён для миграционной
 * совместимости (старые записи в БД могут иметь только age_range, без
 * точного age). При новой регистрации не используется — заполняется age.
 * @deprecated используйте поле age
 */
export type AgeRange        = '18-25' | '26-35' | '36-45' | '46+'

@Entity('user_profiles')
export class UserProfile {

  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', unique: true })
  userId!: string

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User

  /**
   * Возраст в годах (новое основное поле). Хранится числом для точного
   * расчёта BMR/TDEE по формуле Mifflin-St Jeor.
   */
  @Column({ type: 'int', nullable: true })
  age!: number | null

  /**
   * Вес в килограммах. Хранится как numeric(5,2) с шагом 0.1 кг — для
   * долгосрочного отслеживания изменений и точного Mifflin-St Jeor.
   */
  @Column({
    name: 'weight_kg',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: {
      to:   (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
    },
  })
  weightKg!: number | null

  /** Рост в сантиметрах. */
  @Column({ name: 'height_cm', type: 'int', nullable: true })
  heightCm!: number | null

  /**
   * @deprecated после переключения онбординга на точный возраст — поле
   * сохраняется только для миграционной совместимости со старыми записями.
   * Новые регистрации заполняют age, а ageRange остаётся null.
   */
  @Column({ name: 'age_range', type: 'varchar', nullable: true })
  ageRange!: AgeRange | null

  @Column({ type: 'varchar', nullable: true })
  gender!: Gender | null

  @Column({ type: 'varchar', nullable: true })
  name!: string | null

  /**
   * Цель по питанию — определяет, в каком режиме рассчитываются
   * пороги калорий: дефицит (−15%), поддержание (0), профицит (+10%).
   */
  @Column({ name: 'nutrition_goal', type: 'varchar', nullable: true })
  nutritionGoal!: NutritionGoal | null

  @Column({ type: 'simple-array', nullable: true })
  goals!: GoalType[]

  @Column({ name: 'primary_goal', type: 'varchar', nullable: true })
  primaryGoal!: GoalType | null

  @Column({ type: 'varchar', nullable: true })
  chronotype!: SleepChronotype | null

  @Column({ name: 'sleep_goal_hours', type: 'float', nullable: true, default: 8.0 })
  sleepGoalHours!: number | null

  @Column({ name: 'activity_level', type: 'varchar', nullable: true })
  activityLevel!: ActivityLevel | null

  @Column({ name: 'sport_types', type: 'simple-array', nullable: true })
  sportTypes!: SportType[]

  @Column({ name: 'workouts_per_week', type: 'int', nullable: true })
  workoutsPerWeek!: number | null

  @Column({ name: 'avg_workout_duration_min', type: 'int', nullable: true })
  avgWorkoutDurationMin!: number | null

  @Column({ name: 'sport_goal', type: 'varchar', nullable: true })
  sportGoal!: 'lose_weight' | 'build_muscle' | 'improve_endurance' | 'stay_healthy' | 'reduce_stress' | null

  @Column({ name: 'baseline_stress', type: 'int', nullable: true })
  baselineStress!: number | null

  @Column({ name: 'onboarding_completed', default: false })
  onboardingCompleted!: boolean

  @Column({ name: 'onboarding_completed_at', type: 'timestamptz', nullable: true })
  onboardingCompletedAt!: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}