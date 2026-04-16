// backend/src/user-profile/user-profile.controller.ts

import {
  Controller, Get, Post, Patch, Body,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard }      from '../auth/jwt-auth.guard'
import { UserProfileService } from './user-profile.service'
import {
  CompleteOnboardingDto,
  OnboardingStep1Dto,
  OnboardingStep2Dto,
  OnboardingStep3Dto,
  OnboardingStep4Dto,
  OnboardingStep5Dto,
} from './dto/onboarding.dto'

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class UserProfileController {

  constructor(private readonly profileService: UserProfileService) {}

  // GET /profile — получить профиль текущего пользователя
  @Get()
  getProfile(@Request() req: any) {
    return this.profileService.getProfile(req.user.userId)
  }

  // GET /profile/onboarding-status — прошёл ли онбординг
  // Фронт проверяет это после логина и редиректит если нет
  @Get('onboarding-status')
  async onboardingStatus(@Request() req: any) {
    const completed = await this.profileService.isOnboardingCompleted(req.user.userId)
    return { completed }
  }

  // POST /profile/onboarding — завершить онбординг одним запросом
  // Фронт собирает все шаги и отправляет в конце
  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  completeOnboarding(@Request() req: any, @Body() dto: CompleteOnboardingDto) {
    return this.profileService.completeOnboarding(req.user.userId, dto)
  }

  // PATCH /profile/onboarding/step/1 — сохранить шаг (для пошагового режима)
  @Patch('onboarding/step/1')
  saveStep1(@Request() req: any, @Body() dto: OnboardingStep1Dto) {
    return this.profileService.saveStep1(req.user.userId, dto)
  }

  @Patch('onboarding/step/2')
  saveStep2(@Request() req: any, @Body() dto: OnboardingStep2Dto) {
    return this.profileService.saveStep2(req.user.userId, dto)
  }

  @Patch('onboarding/step/3')
  saveStep3(@Request() req: any, @Body() dto: OnboardingStep3Dto) {
    return this.profileService.saveStep3(req.user.userId, dto)
  }

  @Patch('onboarding/step/4')
  saveStep4(@Request() req: any, @Body() dto: OnboardingStep4Dto) {
    return this.profileService.saveStep4(req.user.userId, dto)
  }

  @Patch('onboarding/step/5')
  saveStep5(@Request() req: any, @Body() dto: OnboardingStep5Dto) {
    return this.profileService.saveStep5(req.user.userId, dto)
  }
}