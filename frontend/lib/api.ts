// lib/api.ts
import axios, { AxiosError } from "axios"

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
})

// ── Request: добавляем JWT ────────────────────────────────
api.interceptors.request.use((config) => {
  // ← проверка SSR: localStorage не существует на сервере
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// ── Response: обработка ошибок ────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (typeof window !== "undefined") {
        if (error.response?.status === 401) {
          localStorage.removeItem("access_token");
          if (window.location.pathname !== '/login') {
            window.location.href = "/login";
          }
          return Promise.reject(error); // Теперь react-query узнает об ошибке
        }
    }

    // ← логируем для отладки (убрать в проде)
// стало
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
  }
)

export default api
