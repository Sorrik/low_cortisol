// context/AuthContext.tsx
import React, { createContext, useContext } from 'react'
import { useRouter }    from 'expo-router'
import { useAuthStore } from '@/store/auth.store'
import { login, register, logoutApi } from '@/lib/health-api'
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
    // Only login() throws here — caller shows "wrong credentials" on failure
    const { access_token, refresh_token, userId } = await login(email, password)
    await setAuth(access_token, refresh_token, userId)
    // Navigation errors must not bubble up as "wrong credentials"
    try {
      const { completed } = await getOnboardingStatus()
      router.replace(completed ? '/(tabs)' : '/onboarding')
    } catch {
      try { router.replace('/(tabs)') } catch { /* token is saved, next render will redirect */ }
    }
  }

  async function signUp(data: { firstName: string; lastName: string; email: string; password: string }) {
    // Only register() throws here — caller shows register error on failure
    const { access_token, refresh_token, userId } = await register(
      data.email,
      data.password,
      data.firstName,
      data.lastName,
    )
    await setAuth(access_token, refresh_token, userId)
    try {
      router.replace('/onboarding')
    } catch { /* token is saved, next render will redirect */ }
  }

  async function signOut() {
    // Сообщаем серверу обнулить refreshTokenHash; ошибки тут глушим
    await logoutApi()
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
