import { api } from './api'

export type GoalType        = 'sleep' | 'stress' | 'energy' | 'mood' | 'weight'
export type SleepChronotype = 'early_bird' | 'night_owl' | 'no_routine'
export type ActivityLevel   = 'sedentary' | 'light' | 'moderate' | 'active'
export type SportType       = 'running' | 'gym' | 'yoga' | 'cycling' | 'swimming' | 'team_sports' | 'martial_arts' | 'home_workout'
export type AgeRange        = '18-25' | '26-35' | '36-45' | '46+'
export type Gender          = 'male' | 'female' | 'other' | 'prefer_not_to_say'

export interface OnboardingData {
  name:                  string
  ageRange:              AgeRange
  gender:                Gender
  goals:                 GoalType[]
  primaryGoal:           GoalType
  chronotype:            SleepChronotype
  sleepGoalHours:        number
  activityLevel:         ActivityLevel
  sportTypes:            SportType[]
  workoutsPerWeek:       number
  avgWorkoutDurationMin: number
  sportGoal:             string | null
  baselineStress:        number
}

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
  sportGoal:             string | null
  baselineStress:        number | null
  onboardingCompleted:   boolean
}

export const getOnboardingStatus = () =>
  api.get<{ completed: boolean }>('/profile/onboarding-status').then(r => r.data)

export const getOnboardingProfile = () =>
  api.get<UserProfile>('/profile').then(r => r.data)

export const completeOnboarding = (data: OnboardingData) =>
  api.post<UserProfile>('/profile/onboarding', data).then(r => r.data)

export const updateStress = (baselineStress: number) =>
  api.patch('/profile/onboarding/step/5', { baselineStress }).then(r => r.data)