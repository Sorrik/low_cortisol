// backend/src/user-profile/user-profile.service.ts

import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { Cache } from 'cache-manager'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { UserProfile } from './user-profile.entity'
import {
  CompleteOnboardingDto,
  OnboardingStep1Dto,
  OnboardingStep2Dto,
  OnboardingStep3Dto,
  OnboardingStep4Dto,
  OnboardingStep5Dto,
  UserProfileResponseDto,
} from './dto/onboarding.dto'

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(UserProfile)
    private readonly repo: Repository<UserProfile>,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

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

  async saveStep1(userId: string, dto: OnboardingStep1Dto) {
    const p = await this.getOrCreate(userId)
    p.ageRange = dto.ageRange
    p.gender = dto.gender
    if (dto.name) p.name = dto.name
    return this._persistAndInvalidate(p)
  }

  async saveStep2(userId: string, dto: OnboardingStep2Dto) {
    const p = await this.getOrCreate(userId)
    p.goals = dto.goals
    p.primaryGoal = dto.primaryGoal
    return this._persistAndInvalidate(p)
  }

  async saveStep3(userId: string, dto: OnboardingStep3Dto) {
    const p = await this.getOrCreate(userId)
    p.chronotype = dto.chronotype
    p.sleepGoalHours = dto.sleepGoalHours
    return this._persistAndInvalidate(p)
  }

  async saveStep4(userId: string, dto: OnboardingStep4Dto) {
    const p = await this.getOrCreate(userId)
    p.activityLevel = dto.activityLevel
    p.sportTypes = dto.sportTypes
    p.workoutsPerWeek = dto.workoutsPerWeek
    p.avgWorkoutDurationMin = dto.avgWorkoutDurationMin
    p.sportGoal = dto.sportGoal as any ?? null
    return this._persistAndInvalidate(p)
  }

  async saveStep5(userId: string, dto: OnboardingStep5Dto) {
    const p = await this.getOrCreate(userId)
    p.baselineStress = dto.baselineStress
    return this._persistAndInvalidate(p)
  }

  async completeOnboarding(userId: string, dto: CompleteOnboardingDto) {
    const p = await this.getOrCreate(userId)

    p.ageRange = dto.ageRange
    p.gender = dto.gender
    p.name = dto.name ?? p.name
    p.goals = dto.goals
    p.primaryGoal = dto.primaryGoal
    p.chronotype = dto.chronotype
    p.sleepGoalHours = dto.sleepGoalHours
    p.activityLevel = dto.activityLevel
    p.sportTypes = dto.sportTypes
    p.workoutsPerWeek = dto.workoutsPerWeek
    p.avgWorkoutDurationMin = dto.avgWorkoutDurationMin
    p.sportGoal = dto.sportGoal as any ?? null
    p.baselineStress = dto.baselineStress
    p.onboardingCompleted = true
    p.onboardingCompletedAt = new Date()

    return this._persistAndInvalidate(p)
  }

  async getProfileForMl(userId: string) {
    const p = await this.repo.findOne({ where: { userId } })
    return {
      sleepGoalHours: p?.sleepGoalHours ?? 8.0,
      baselineStress: p?.baselineStress ?? 5,
      chronotype: p?.chronotype ?? 'no_routine',
      primaryGoal: p?.primaryGoal ?? 'mood',
      activityLevel: p?.activityLevel ?? 'light',
      workoutsPerWeek: p?.workoutsPerWeek ?? 0,
      avgWorkoutDurationMin: p?.avgWorkoutDurationMin ?? 0,
      sportGoal: p?.sportGoal ?? null,
      weeklyTrainingMinutes: (p?.workoutsPerWeek ?? 0) * (p?.avgWorkoutDurationMin ?? 0),
    }
  }

  private async _persistAndInvalidate(p: UserProfile): Promise<UserProfileResponseDto> {
    const saved = await this.repo.save(p)
    await Promise.allSettled([
      this.cache.del(`predict:${saved.userId}`),
      this.cache.del(`train:${saved.userId}`),
    ])
    return this._toDto(saved)
  }

  private _toDto(p: UserProfile): UserProfileResponseDto {
    return {
      id: p.id,
      userId: p.userId,
      name: p.name,
      ageRange: p.ageRange,
      gender: p.gender,
      goals: p.goals ?? [],
      primaryGoal: p.primaryGoal,
      chronotype: p.chronotype,
      sleepGoalHours: p.sleepGoalHours,
      activityLevel: p.activityLevel,
      sportTypes: p.sportTypes ?? [],
      workoutsPerWeek: p.workoutsPerWeek,
      avgWorkoutDurationMin: p.avgWorkoutDurationMin,
      sportGoal: p.sportGoal,
      baselineStress: p.baselineStress,
      onboardingCompleted: p.onboardingCompleted,
    }
  }
}
