// lib/api.ts
import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/auth.store'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

const getToken        = () => useAuthStore.getState().token
const getRefreshToken = () => useAuthStore.getState().refreshToken

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// URL-фрагменты, при 401 на которых НЕ нужно делать refresh
const AUTH_PUBLIC_PATHS = ['/auth/login', '/auth/register', '/auth/refresh']

// Один общий refresh-Promise против гонки при параллельных 401
let refreshPromise: Promise<string | null> | null = null

async function performRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  try {
    const res = await axios.post<{ access_token: string; refresh_token: string; user: { id: string } }>(
      `${API_URL}/auth/refresh`,
      { refresh_token: refreshToken },
      { timeout: 10_000, headers: { 'Content-Type': 'application/json' } },
    )
    const { access_token, refresh_token, user } = res.data
    await useAuthStore.getState().setAuth(access_token, refresh_token, user.id)
    return access_token
  } catch {
    await useAuthStore.getState().logout()
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined
    const status   = error.response?.status
    const url      = original?.url ?? ''
    const isPublic = AUTH_PUBLIC_PATHS.some((p) => url.includes(p))

    if (status === 401 && original && !original._retry && !isPublic) {
      original._retry = true
      if (!refreshPromise) refreshPromise = performRefresh().finally(() => { refreshPromise = null })
      const newAccess = await refreshPromise
      if (newAccess) {
        original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${newAccess}` }
        return api.request(original)
      }
    }

    if (error.response) {
      console.error(
        '[API Error]',
        original?.method?.toUpperCase(),
        url,
        error.response.status,
        error.response.data,
      )
    }
    return Promise.reject(error)
  }
)
