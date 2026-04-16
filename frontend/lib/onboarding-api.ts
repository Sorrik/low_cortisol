// frontend/lib/onboarding-api.ts

import { OnboardingData, UserProfile } from '@/types/onboarding'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

function token() {
  return typeof window !== 'undefined' ? localStorage.getItem('access_token') ?? '' : ''
}
function h(): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }
}

export async function getProfile(): Promise<UserProfile> {
  const res = await fetch(`${API}/profile`, { headers: h() })
  if (!res.ok) throw new Error('Failed to fetch profile')
  return res.json()
}

export async function getOnboardingStatus(): Promise<{ completed: boolean }> {
  const res = await fetch(`${API}/profile/onboarding-status`, { headers: h() })
  if (!res.ok) throw new Error('Failed to fetch onboarding status')
  return res.json()
}

export async function completeOnboarding(data: OnboardingData): Promise<UserProfile> {
  const res = await fetch(`${API}/profile/onboarding`, {
    method:  'POST',
    headers: h(),
    body:    JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message ?? 'Onboarding failed')
  }
  return res.json()
}

export async function saveOnboardingStep(
  step: 1 | 2 | 3 | 4 | 5,
  data: Partial<OnboardingData>,
): Promise<UserProfile> {
  const res = await fetch(`${API}/profile/onboarding/step/${step}`, {
    method:  'PATCH',
    headers: h(),
    body:    JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Step ${step} save failed`)
  return res.json()
}