// lib/api.ts
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios"
import { clearAuth, getAccessToken, setAccessToken, setAuth } from "./auth-store"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

const api = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
  // Нужно чтобы браузер автоматически слал HttpOnly refresh-cookie на /auth/refresh
  withCredentials: true,
})

// ── Request: добавляем access-токен из in-memory store ────────
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response: 401 → refresh + retry, с защитой от race condition ──
//
// Если параллельно ушли 5 запросов и все вернули 401, вызываем /auth/refresh
// один раз, остальные ждут результат. После успеха — все ретраются.

let refreshPromise: Promise<string | null> | null = null

const PUBLIC_AUTH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh"]

async function performRefresh(): Promise<string | null> {
  try {
    // Используем raw axios (не наш `api`!), чтобы не уйти в рекурсию interceptor-а.
    const res = await axios.post<{ access_token: string; user: any }>(
      `${API_URL}/auth/refresh`,
      {},
      { withCredentials: true, timeout: 10_000 },
    )
    if (res.data?.access_token && res.data?.user) {
      setAuth(res.data.access_token, res.data.user)
    } else if (res.data?.access_token) {
      setAccessToken(res.data.access_token)
    }
    return res.data?.access_token ?? null
  } catch {
    clearAuth()
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined
    const status = error.response?.status
    const url = original?.url ?? ""
    const isPublicAuth = PUBLIC_AUTH_PATHS.some((p) => url.includes(p))

    if (status === 401 && original && !original._retry && !isPublicAuth) {
      original._retry = true
      if (!refreshPromise) {
        refreshPromise = performRefresh().finally(() => {
          refreshPromise = null
        })
      }
      const newToken = await refreshPromise
      if (newToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` }
        return api.request(original) as Promise<AxiosResponse>
      }
      // refresh не удался — выкидываем на /login
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login"
      }
    }

    if (axios.isAxiosError(error)) {
      console.error(
        "[API Error]",
        error.config?.method?.toUpperCase(),
        error.config?.url,
        error.response?.status,
        error.response?.data,
      )
    } else {
      console.error("[API Error]", error)
    }

    return Promise.reject(error)
  },
)

export default api
