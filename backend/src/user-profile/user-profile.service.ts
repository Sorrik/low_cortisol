// backend/src/user-profile/user-profile.service.ts

import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository }       from 'typeorm'
import { UserProfile }      from './user-profile.entity'
import {
  CompleteOnboardingDto,
  OnboardingStep1Dto, OnboardingStep2Dto,
  OnboardingStep3Dto, OnboardingStep4Dto,
  OnboardingStep5Dto, UserProfileResponseDto,
} from './dto/onboarding.dto'

@Injectable()
export class UserProfileService {

  constructor(
    @InjectRepository(UserProfile)
    private readonly repo: Repository<UserProfile>,
  ) {}

  // ── Получить или создать ──────────────────────────────────

  async getOrCreate(userId: string): Promise<UserProfile> {
    let p = await this.repo.findOne({ where: { userId } })
    if (!p) {
      p = this.repo.create({ userId, onboardingCompleted: false })
      await this.repo.save(p)
    }
    return p
  }

  async getProfile(userId: string): Promise<UserProfileResponseDto> {
    return this._toDto(await this.getOrCreate(userId))
  }

  async isOnboardingCompleted(userId: string): Promise<boolean> {
    const p = await this.repo.findOne({ where: { userId } })
    return p?.onboardingCompleted ?? false
  }

  // ── Пошаговые сохранения ──────────────────────────────────

  async saveStep1(userId: string, dto: OnboardingStep1Dto) {
    const p = await this.getOrCreate(userId)
    p.ageRange = dto.ageRange
    p.gender   = dto.gender
    if (dto.name) p.name = dto.name
    return this._toDto(await this.repo.save(p))
  }

  async saveStep2(userId: string, dto: OnboardingStep2Dto) {
    const p = await this.getOrCreate(userId)
    p.goals       = dto.goals
    p.primaryGoal = dto.primaryGoal
    return this._toDto(await this.repo.save(p))
  }

  async saveStep3(userId: string, dto: OnboardingStep3Dto) {
    const p = await this.getOrCreate(userId)
    p.chronotype     = dto.chronotype
    p.sleepGoalHours = dto.sleepGoalHours
    return this._toDto(await this.repo.save(p))
  }

  async saveStep4(userId: string, dto: OnboardingStep4Dto) {
    const p = await this.getOrCreate(userId)
    p.activityLevel        = dto.activityLevel
    p.sportTypes           = dto.sportTypes
    p.workoutsPerWeek      = dto.workoutsPerWeek
    p.avgWorkoutDurationMin= dto.avgWorkoutDurationMin
    p.sportGoal            = dto.sportGoal as any ?? null
    return this._toDto(await this.repo.save(p))
  }

  async saveStep5(userId: string, dto: OnboardingStep5Dto) {
    const p = await this.getOrCreate(userId)
    p.baselineStress = dto.baselineStress
    return this._toDto(await this.repo.save(p))
  }

  // ── Завершить онбординг ───────────────────────────────────

  async completeOnboarding(userId: string, dto: CompleteOnboardingDto) {
    const p = await this.getOrCreate(userId)

    p.ageRange             = dto.ageRange
    p.gender               = dto.gender
    p.name                 = dto.name ?? p.name
    p.goals                = dto.goals
    p.primaryGoal          = dto.primaryGoal
    p.chronotype           = dto.chronotype
    p.sleepGoalHours       = dto.sleepGoalHours
    p.activityLevel        = dto.activityLevel
    p.sportTypes           = dto.sportTypes
    p.workoutsPerWeek      = dto.workoutsPerWeek
    p.avgWorkoutDurationMin= dto.avgWorkoutDurationMin
    p.sportGoal            = dto.sportGoal as any ?? null
    p.baselineStress       = dto.baselineStress
    p.onboardingCompleted  = true
    p.onboardingCompletedAt= new Date()

    return this._toDto(await this.repo.save(p))
  }

  // ── Данные для ML-сервиса ─────────────────────────────────
  // ML использует их для адаптации порогов под пользователя:
  // - sleepGoalHours → личная норма вместо дефолтных 8ч
  // - baselineStress → начальный уровень (инициализация модели)
  // - workoutsPerWeek × avgWorkoutDurationMin → недельная нагрузка
  //   влияет на норму активности и нетто-гидратацию

  async getProfileForMl(userId: string) {
    const p = await this.repo.findOne({ where: { userId } })
    return {
      sleepGoalHours:        p?.sleepGoalHours        ?? 8.0,
      baselineStress:        p?.baselineStress         ?? 5,
      chronotype:            p?.chronotype             ?? 'no_routine',
      primaryGoal:           p?.primaryGoal            ?? 'mood',
      activityLevel:         p?.activityLevel          ?? 'light',
      workoutsPerWeek:       p?.workoutsPerWeek        ?? 0,
      avgWorkoutDurationMin: p?.avgWorkoutDurationMin  ?? 0,
      sportGoal:             p?.sportGoal              ?? null,
      weeklyTrainingMinutes: ((p?.workoutsPerWeek ?? 0) * (p?.avgWorkoutDurationMin ?? 0)),
    }
  }

  // ── Mapper ────────────────────────────────────────────────

  private _toDto(p: UserProfile): UserProfileResponseDto {
    return {
      id:                    p.id,
      userId:                p.userId,
      name:                  p.name,
      ageRange:              p.ageRange,
      gender:                p.gender,
      goals:                 p.goals ?? [],
      primaryGoal:           p.primaryGoal,
      chronotype:            p.chronotype,
      sleepGoalHours:        p.sleepGoalHours,
      activityLevel:         p.activityLevel,
      sportTypes:            p.sportTypes ?? [],
      workoutsPerWeek:       p.workoutsPerWeek,
      avgWorkoutDurationMin: p.avgWorkoutDurationMin,
      sportGoal:             p.sportGoal,
      baselineStress:        p.baselineStress,
      onboardingCompleted:   p.onboardingCompleted,
    }
  }
}