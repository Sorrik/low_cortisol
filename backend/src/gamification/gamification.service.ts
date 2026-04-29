// backend/src/gamification/gamification.service.ts

import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository }   from '@nestjs/typeorm'
import { Repository }         from 'typeorm'
import { UserGamification, BadgeId } from './gamification.entity'
import { BADGES, LEVEL_THRESHOLDS, getLevelByPoints, STREAK_BADGES } from './badges.config'

export interface DailyHealthSnapshot {
  date:             string
  // Наличие данных за день
  hasSleep:         boolean
  hasStress:        boolean
  hasMood:          boolean
  hasActivity:      boolean
  hasWater:         boolean
  hasNutrition:     boolean
  // Значения
  sleepHours?:      number
  sleepQuality?:    number
  stressLevel?:     number
  moodScore?:       number
  activityMinutes?: number
  waterMl?:         number
  // Личные нормы из профиля
  sleepGoalHours?:  number
  baselineStress?:  number
  // Скользящие средние (за последние 14 дней до сегодня)
  prevAvgSleep?:    number
  prevAvgMood?:     number
  prevAvgActivity?: number
}

export interface GamificationUpdateResult {
  newBadges:    BadgeId[]
  levelUp:      boolean
  newLevel?:    string
  pointsEarned: number
}

export interface GamificationDto {
  streakAny:       number    // текущий стрик — любые данные
  streakFull:      number    // текущий стрик — все 6 метрик
  streakNorm:      number    // текущий стрик — выполнение нормы
  longestAny:      number
  longestFull:     number
  longestNorm:     number
  totalPoints:     number
  level:           number
  levelName:       string
  nextLevelAt:     number | null
  badges:          BadgeId[]
  badgeDates:      Record<string, string>
  recentBadges:    BadgeId[]
  totalEntries:    number
  streakFreezeUsed: boolean
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name)

  constructor(
    @InjectRepository(UserGamification)
    private readonly repo: Repository<UserGamification>,
  ) {}

  async getOrCreate(userId: string): Promise<UserGamification> {
    let g = await this.repo.findOne({ where: { userId } })
    if (!g) {
      g = this.repo.create({
        userId,
        streakAnyCurrent: 0, streakAnyLongest: 0,
        streakFullCurrent: 0, streakFullLongest: 0,
        streakNormCurrent: 0, streakNormLongest: 0,
        lastEntryDate: null, lastFullDate: null, lastNormDate: null,
        streakFreezeUsed: false,
        totalPoints: 0, level: 1, levelName: 'Новичок',
        badges: [], badgeDates: {} as Record<BadgeId, string>,
        totalEntries: 0,
        calmDaysStreak: 0, goodSleepStreak: 0,
        moodRisingDays: 0, hydrationDaysStreak: 0,
        anomaliesSurvived: 0,
        prevAvgSleep: null, prevAvgMood: null, prevAvgActivity: null,
      })
      await this.repo.save(g)
    }
    return g
  }

  async getStats(userId: string): Promise<GamificationDto> {
    const g = await this.getOrCreate(userId)
    return this._toDto(g)
  }

  async processDay(
    userId: string,
    snap: DailyHealthSnapshot,
  ): Promise<GamificationUpdateResult> {
    const g = await this.getOrCreate(userId)
    const today = snap.date
    const prevBadges = new Set(g.badges)
    const newBadges: BadgeId[] = []
    let pts = 0

    const award = (id: BadgeId) => {
      if (!prevBadges.has(id) && !newBadges.includes(id)) {
        newBadges.push(id)
        g.badges = [...g.badges, id]
        g.badgeDates = { ...g.badgeDates, [id]: today }
        pts += BADGES[id].points
      }
    }

    // 1. Стрик ANY (с учетом заморозки)
    const hasAny = snap.hasSleep || snap.hasStress || snap.hasMood ||
                   snap.hasActivity || snap.hasWater || snap.hasNutrition

    if (hasAny) {
      const diff = this._daysDiff(g.lastEntryDate, today)
      
      // Если пропустили 1 день (diff=2), используем заморозку
      if (diff === 2 && !g.streakFreezeUsed) {
        g.streakFreezeUsed = true
        g.streakAnyCurrent += 1
      } else if (diff > 1) {
        // Если пропустили больше или заморозка уже была — сброс
        g.streakAnyCurrent = 1
        g.streakFreezeUsed = false
      } else if (diff === 1) {
        g.streakAnyCurrent += 1
      } else if (diff === 0 && g.streakAnyCurrent === 0) {
        g.streakAnyCurrent = 1
      }

      g.lastEntryDate = today
      g.streakAnyLongest = Math.max(g.streakAnyLongest, g.streakAnyCurrent)
      g.totalEntries++
      pts += 5

      for (const threshold of STREAK_BADGES.any) {
        if (g.streakAnyCurrent >= threshold) award(`streak_any_${threshold}` as BadgeId)
      }
    }

    // 2. Стрик FULL (без заморозки)
    const hasFull = snap.hasSleep && snap.hasStress && snap.hasMood &&
                    snap.hasActivity && snap.hasWater && snap.hasNutrition
    if (hasFull) {
      g.streakFullCurrent = this._calculateActiveStreak(g.streakFullCurrent, g.lastFullDate, today)
      g.lastFullDate = today
      g.streakFullLongest = Math.max(g.streakFullLongest, g.streakFullCurrent)
      pts += 5
      for (const threshold of STREAK_BADGES.full) {
        if (g.streakFullCurrent >= threshold) award(`streak_full_${threshold}` as BadgeId)
      }
    }

    // 3. Стрик NORM
    const sleepNorm = snap.sleepGoalHours ?? 8
    const stressNorm = snap.baselineStress ?? 5
    const normMet = (snap.sleepHours ?? 0) >= sleepNorm * 0.9 && (snap.stressLevel ?? 99) <= stressNorm
    
    if (normMet && snap.hasSleep && snap.hasStress) {
      g.streakNormCurrent = this._calculateActiveStreak(g.streakNormCurrent, g.lastNormDate, today)
      g.lastNormDate = today
      g.streakNormLongest = Math.max(g.streakNormLongest, g.streakNormCurrent)
      pts += 3
      for (const threshold of STREAK_BADGES.norm) {
        if (g.streakNormCurrent >= threshold) award(`streak_norm_${threshold}` as BadgeId)
      }
    }

    // 4. Специальные счетчики (обнуляются при любой записи, если условие не выполнено)
// --- 4. Специальные счётчики (с защитой от undefined) ---
    if (snap.hasSleep && snap.sleepHours !== undefined) {
      const qualityOk = snap.sleepQuality === undefined || snap.sleepQuality >= 7
      g.goodSleepStreak = (snap.sleepHours >= sleepNorm * 0.9 && qualityOk) ? g.goodSleepStreak + 1 : 0
    }
    if (snap.hasStress && snap.stressLevel !== undefined) {
      g.calmDaysStreak = (snap.stressLevel <= stressNorm) ? g.calmDaysStreak + 1 : 0
    }
    if (snap.hasMood && snap.moodScore !== undefined) {
      g.moodRisingDays = (snap.moodScore >= 6) ? g.moodRisingDays + 1 : 0
    }
    if (snap.hasWater && snap.waterMl !== undefined) {
      g.hydrationDaysStreak = (snap.waterMl >= 1500) ? g.hydrationDaysStreak + 1 : 0
    }

    // ── 5. Бейджи за достижение целей ────────────────────────

    // Первая запись
    if (g.totalEntries === 1) award('first_entry')

    // Сон
    if (g.goodSleepStreak >= 7)  award('sleep_week')
    if (g.goodSleepStreak >= 14) award('sleep_champ')

    // Улучшение сна (среднее выросло на 1ч+)
    if (snap.prevAvgSleep != null && snap.sleepHours != null) {
      const improved = snap.prevAvgSleep > 0 && snap.sleepHours >= snap.prevAvgSleep + 1
      if (improved) award('sleep_improver')
    }

    // Стресс
    if (g.calmDaysStreak >= 7)  award('calm_week')
    if (g.calmDaysStreak >= 30) award('zen_master')

    // Настроение
    if (g.moodRisingDays >= 5)  award('mood_rising')
    if (g.moodRisingDays >= 14) award('mood_stable')

    // Улучшение настроения
    if (snap.prevAvgMood != null && snap.moodScore != null) {
      const improved = snap.prevAvgMood > 0 && snap.moodScore >= snap.prevAvgMood + 2
      if (improved) award('mood_improver')
    }

    // Активность
    if (snap.prevAvgActivity != null && snap.activityMinutes != null) {
      const improved = snap.prevAvgActivity > 10 &&
                       snap.activityMinutes >= snap.prevAvgActivity * 1.2
      if (improved) award('activity_improver')
    }

    // Вода
    if (g.hydrationDaysStreak >= 7) award('hydration_week')

    // Completionist (30 дней подряд full)
    if (g.streakFullCurrent >= 30) award('completionist')

    // Аномалии (вызывается снаружи через notifyAnomalySurvived)
    if (g.anomaliesSurvived >= 3) award('anomaly_3_survived')

    // Обновляем предыдущие средние для следующего дня
    if (snap.prevAvgSleep    != null) g.prevAvgSleep    = snap.prevAvgSleep
    if (snap.prevAvgMood     != null) g.prevAvgMood     = snap.prevAvgMood
    if (snap.prevAvgActivity != null) g.prevAvgActivity = snap.prevAvgActivity

    // 5. Уровень
    g.totalPoints += pts
    const prevLevel = g.level
    const levelInfo = getLevelByPoints(g.totalPoints)
    if (levelInfo.level > g.level) {
      g.level = levelInfo.level
      g.levelName = levelInfo.name
      award(levelInfo.badge)
    }

    await this.repo.save(g)
    const levelUp = levelInfo.level > prevLevel
    return {
      newBadges,
      levelUp,
      newLevel: levelUp ? levelInfo.name : undefined,
      pointsEarned: pts,
    }
  }

  // Публичный: принимает снапшоты за ВСЕ дни (asc), пересчитывает только streak-счётчики
  async recalculateStreaks(
    userId: string,
    snapshots: DailyHealthSnapshot[],
  ): Promise<void> {
    const g = await this.getOrCreate(userId)
    // Сброс streak-полей (points / badges / totalEntries — не трогаем)
    g.streakAnyCurrent  = 0; g.streakAnyLongest  = 0
    g.streakFullCurrent = 0; g.streakFullLongest = 0
    g.streakNormCurrent = 0; g.streakNormLongest = 0
    g.lastEntryDate     = null
    g.lastFullDate      = null
    g.lastNormDate      = null
    g.streakFreezeUsed  = false
    g.calmDaysStreak    = 0; g.goodSleepStreak   = 0
    g.moodRisingDays    = 0; g.hydrationDaysStreak = 0

    for (const snap of snapshots) {
      this._applyStreakOnly(g, snap)
    }
    await this.repo.save(g)
    this.logger.log(`[gamification] streaks recalculated for ${userId} over ${snapshots.length} days`)
  }

  // Приватный: та же streak-логика что в processDay(), но без pts/award/totalEntries
  private _applyStreakOnly(g: UserGamification, snap: DailyHealthSnapshot): void {
    const today      = snap.date
    const sleepNorm  = snap.sleepGoalHours ?? 8
    const stressNorm = snap.baselineStress ?? 5

    const hasAny = snap.hasSleep || snap.hasStress || snap.hasMood ||
                   snap.hasActivity || snap.hasWater || snap.hasNutrition
    if (hasAny) {
      const diff = this._daysDiff(g.lastEntryDate, today)
      if (diff === 2 && !g.streakFreezeUsed) {
        g.streakFreezeUsed = true
        g.streakAnyCurrent += 1
      } else if (diff > 1) {
        g.streakAnyCurrent = 1
        g.streakFreezeUsed = false
      } else if (diff === 1) {
        g.streakAnyCurrent += 1
      } else if (diff === 0 && g.streakAnyCurrent === 0) {
        g.streakAnyCurrent = 1
      }
      g.lastEntryDate    = today
      g.streakAnyLongest = Math.max(g.streakAnyLongest, g.streakAnyCurrent)
    }

    const hasFull = snap.hasSleep && snap.hasStress && snap.hasMood &&
                    snap.hasActivity && snap.hasWater && snap.hasNutrition
    if (hasFull) {
      g.streakFullCurrent = this._calculateActiveStreak(g.streakFullCurrent, g.lastFullDate, today)
      g.lastFullDate      = today
      g.streakFullLongest = Math.max(g.streakFullLongest, g.streakFullCurrent)
    }

    const normMet = (snap.sleepHours ?? 0) >= sleepNorm * 0.9 &&
                    (snap.stressLevel ?? 99) <= stressNorm
    if (normMet && snap.hasSleep && snap.hasStress) {
      g.streakNormCurrent = this._calculateActiveStreak(g.streakNormCurrent, g.lastNormDate, today)
      g.lastNormDate      = today
      g.streakNormLongest = Math.max(g.streakNormLongest, g.streakNormCurrent)
    }

    // Специальные счётчики
    if (snap.hasSleep && snap.sleepHours !== undefined) {
      const qualityOk = snap.sleepQuality === undefined || snap.sleepQuality >= 7
      g.goodSleepStreak = (snap.sleepHours >= sleepNorm * 0.9 && qualityOk)
        ? g.goodSleepStreak + 1 : 0
    }
    if (snap.hasStress && snap.stressLevel !== undefined)
      g.calmDaysStreak = snap.stressLevel <= stressNorm ? g.calmDaysStreak + 1 : 0
    if (snap.hasMood && snap.moodScore !== undefined)
      g.moodRisingDays = snap.moodScore >= 6 ? g.moodRisingDays + 1 : 0
    if (snap.hasWater && snap.waterMl !== undefined)
      g.hydrationDaysStreak = snap.waterMl >= 1500 ? g.hydrationDaysStreak + 1 : 0
  }

  // Помощник для расчета "живого" стрика без заморозки
  private _calculateActiveStreak(current: number, lastDate: string | null, today: string): number {
    const diff = this._daysDiff(lastDate, today)
    if (diff === 0) return current === 0 ? 1 : current
    if (diff === 1) return current + 1
    return 1
  }

  private _daysDiff(dateA: string | null, dateB: string): number {
    if (!dateA) return 999
    const a = new Date(dateA)
    const b = new Date(dateB)
    // Сброс времени для сравнения только дат
    a.setHours(0, 0, 0, 0)
    b.setHours(0, 0, 0, 0)
    return Math.round((b.getTime() - a.getTime()) / 86400000)
  }

  private _getTodayIso(): string {
    return new Date().toISOString().split('T')[0]
  }

  private _toDto(g: UserGamification): GamificationDto {
    const today = this._getTodayIso()
    const diffAny = this._daysDiff(g.lastEntryDate, today)
    const diffFull = this._daysDiff(g.lastFullDate, today)
    const diffNorm = this._daysDiff(g.lastNormDate, today)

    // Если прошло > 1 дня и нет активной заморозки, визуально стрик = 0
    const isAnyActive = diffAny <= 1 || (diffAny === 2 && g.streakFreezeUsed)
    
    const nextLevel = LEVEL_THRESHOLDS.find(l => l.level === g.level + 1)
    
    return {
      streakAny: isAnyActive ? g.streakAnyCurrent : 0,
      streakFull: diffFull <= 1 ? g.streakFullCurrent : 0,
      streakNorm: diffNorm <= 1 ? g.streakNormCurrent : 0,
      longestAny: g.streakAnyLongest,
      longestFull: g.streakFullLongest,
      longestNorm: g.streakNormLongest,
      totalPoints: g.totalPoints,
      level: g.level,
      levelName: g.levelName,
      nextLevelAt: nextLevel ? nextLevel.minPoints - g.totalPoints : null,
      badges: g.badges ?? [],
      badgeDates: g.badgeDates ?? {},
      recentBadges: Object.entries(g.badgeDates ?? {})
        .sort(([, a], [, b]) => b.localeCompare(a))
        .slice(0, 3).map(([id]) => id as BadgeId),
      totalEntries: g.totalEntries,
      streakFreezeUsed: g.streakFreezeUsed,
    }
  }
  // ── Вызывается когда пользователь восстановился после аномалии ──

  async notifyAnomalySurvived(userId: string, date: string): Promise<void> {
    const g = await this.getOrCreate(userId)
    g.anomaliesSurvived++
    if (!g.badges.includes('anomaly_survived')) {
      g.badges     = [...g.badges, 'anomaly_survived']
      g.badgeDates = { ...g.badgeDates, anomaly_survived: date }
      g.totalPoints += BADGES.anomaly_survived.points
      this.logger.log(`[gamification] ${userId} → бейдж anomaly_survived`)
    }
    if (g.anomaliesSurvived >= 3 && !g.badges.includes('anomaly_3_survived')) {
      g.badges     = [...g.badges, 'anomaly_3_survived']
      g.badgeDates = { ...g.badgeDates, anomaly_3_survived: date }
      g.totalPoints += BADGES.anomaly_3_survived.points
    }
    await this.repo.save(g)
  }
}
