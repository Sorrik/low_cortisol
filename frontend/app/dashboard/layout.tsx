"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { getAccessToken, setAuth, clearAuth, hydrateUserFromStorage } from "@/lib/auth-store"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

// Bootstrap: при загрузке dashboard access-токен в памяти отсутствует
// (мы намеренно не храним его в localStorage). Если HttpOnly refresh-cookie
// валидна, /auth/refresh вернёт новый access. Иначе — на /login.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    hydrateUserFromStorage()

    if (getAccessToken()) {
      setReady(true)
      return
    }

    let cancelled = false
    axios
      .post<{ access_token: string; user: any }>(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true, timeout: 10_000 },
      )
      .then((res) => {
        if (cancelled) return
        if (res.data?.access_token && res.data?.user) {
          setAuth(res.data.access_token, res.data.user)
          setReady(true)
        } else {
          throw new Error("invalid refresh response")
        }
      })
      .catch(() => {
        if (cancelled) return
        clearAuth()
        router.replace("/login")
      })

    return () => {
      cancelled = true
    }
  }, [router])

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background">
      <DashboardSidebar />
      <main className="lg:pl-64">
        <div className="min-h-svh pb-20 lg:pb-0">
          {children}
        </div>
      </main>
    </div>
  )
}
