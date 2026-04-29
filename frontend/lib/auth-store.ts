// In-memory access-token store. Refresh-токен живёт в HttpOnly cookie на бэке —
// его JS не видит, и это намеренно (защита от XSS). На hard refresh страницы
// токен в памяти теряется и восстанавливается через POST /auth/refresh.
//
// Дизайн без zustand/jotai чтобы не добавлять зависимость ради одной фичи.

import { useSyncExternalStore } from "react"

export interface StoredUser {
  id: string
  email: string
  firstName: string
  lastName: string
}

interface AuthState {
  accessToken: string | null
  user: StoredUser | null
}

let state: AuthState = { accessToken: null, user: null }
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

export function getAccessToken(): string | null {
  return state.accessToken
}

export function getUser(): StoredUser | null {
  return state.user
}

export function setAuth(accessToken: string, user: StoredUser): void {
  state = { accessToken, user }
  // user — НЕ secret (только email + имя для UI); кладём в localStorage,
  // чтобы UI не моргал пустым аватаром на hard refresh пока ждём /refresh.
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("user", JSON.stringify(user))
    } catch {
      /* quota / private mode — не критично */
    }
  }
  notify()
}

export function setAccessToken(accessToken: string | null): void {
  state = { ...state, accessToken }
  notify()
}

export function clearAuth(): void {
  state = { accessToken: null, user: null }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem("user")
      // legacy: убираем старый ключ от прошлой реализации
      window.localStorage.removeItem("access_token")
    } catch {
      /* noop */
    }
  }
  notify()
}

// Восстанавливает user из localStorage при первом импорте (для мгновенного
// рендера UI). accessToken НЕ восстанавливаем — он только из /auth/refresh.
export function hydrateUserFromStorage(): void {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem("user")
    if (raw) state = { ...state, user: JSON.parse(raw) as StoredUser }
  } catch {
    /* noop */
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): AuthState {
  return state
}

function getServerSnapshot(): AuthState {
  return { accessToken: null, user: null }
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
