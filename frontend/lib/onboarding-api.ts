// frontend/lib/onboarding-api.ts

import api from './api'
import { OnboardingData, UserProfile } from '@/types/onboarding'

export async function getProfile(): Promise<UserProfile> {
  const res = await api.get<UserProfile>('/profile')
  return res.data
}

export async function getOnboardingStatus(): Promise<{ completed: boolean }> {
  const res = await api.get<{ completed: boolean }>('/profile/onboarding-status')
  return res.data
}

export async function completeOnboarding(data: OnboardingData): Promise<UserProfile> {
  const res = await api.post<UserProfile>('/profile/onboarding', data)
  return res.data
}

export async function saveOnboardingStep(
  step: 1 | 2 | 3 | 4 | 5,
  data: Partial<OnboardingData>,
): Promise<UserProfile> {
  const res = await api.patch<UserProfile>(`/profile/onboarding/step/${step}`, data)
  return res.data
}
