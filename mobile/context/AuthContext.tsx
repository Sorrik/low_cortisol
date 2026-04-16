// context/AuthContext.tsx
import React, { createContext, useContext } from 'react'
import { useRouter }    from 'expo-router'
import { useAuthStore } from '@/store/auth.store'
import { login, register } from '@/lib/health-api'
import type { AuthState } from '@/store/auth.store'
import { getOnboardingStatus } from '@/lib/onboarding-api'

interface AuthContextValue {
  signIn:  (email: string, password: string) => Promise<void>
  signUp:  (data: {
    firstName: string
    lastName:  string
    email:     string
    password:  string
  }) => Promise<void>
  signOut: () => Promise<void>
  token:   string | null
  userId:  string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router  = useRouter()
  
  const setAuth = useAuthStore((s: AuthState) => s.setAuth)
  const logout  = useAuthStore((s: AuthState) => s.logout)
  const token   = useAuthStore((s: AuthState) => s.token)
  const userId  = useAuthStore((s: AuthState) => s.userId)

async function signIn(email: string, password: string) {
  const { access_token, userId } = await login(email, password)
  await setAuth(access_token, userId)
  try {
    const { completed } = await getOnboardingStatus()
    router.replace(completed ? '/(tabs)' : '/onboarding')
  } catch {
    router.replace('/(tabs)')
  }
}

async function signUp(data: { firstName: string; lastName: string; email: string; password: string }) {
  const { access_token, userId } = await register(
    data.email, 
    data.password, 
    data.firstName, 
    data.lastName
  )
  
  await setAuth(access_token, userId)
  router.replace('/onboarding')
}

async function signOut() {
  await logout()
  router.replace('/auth/login')
}

  return (
    <AuthContext.Provider value={{ signIn, signUp, signOut, token, userId }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}