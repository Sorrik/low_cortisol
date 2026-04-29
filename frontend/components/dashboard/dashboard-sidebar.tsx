"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Moon,
  UtensilsCrossed,
  Smile,
  Brain,
  Flame,
  Droplets,
  Sparkles,
  User,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { LowCorLogo } from "@/components/lowcor-logo"
import { Button } from "@/components/ui/button"
import { getProfile } from "@/lib/health-api"
import api from "@/lib/api"
import { clearAuth } from "@/lib/auth-store"

const navItems = [
  { href: "/dashboard", label: "Обзор", icon: LayoutDashboard },
  { href: "/dashboard/sleep", label: "Сон", icon: Moon },
  { href: "/dashboard/nutrition", label: "Питание", icon: UtensilsCrossed },
  { href: "/dashboard/mood", label: "Настроение", icon: Smile },
  { href: "/dashboard/stress", label: "Стресс", icon: Brain },
  { href: "/dashboard/activity", label: "Активность", icon: Flame },
  { href: "/dashboard/water", label: "Вода", icon: Droplets },
  { href: "/dashboard/recommendations", label: "Рекомендации", icon: Sparkles },
  { href: "/dashboard/profile", label: "Профиль", icon: User },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [firstName, setFirstName] = useState<string>("")

  useEffect(() => {
    getProfile()
      .then((user) => setFirstName(user.firstName ?? ""))
      .catch(() => {})
  }, [])

  async function handleLogout() {
    try {
      // Сообщаем серверу обнулить refreshTokenHash и стереть HttpOnly cookie.
      // Если запрос упадёт (например, токен уже истёк) — всё равно чистим клиент.
      await api.post("/auth/logout")
    } catch {
      /* ignore */
    } finally {
      clearAuth()
      router.push("/login")
    }
  }

  const avatarLetter = firstName ? firstName[0].toUpperCase() : "?"

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-svh w-64 flex-col border-r border-border bg-card lg:flex">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6">
          <LowCorLogo className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold tracking-tight text-foreground">LowCor</span>
        </div>

        {/* User */}
        <div className="mx-4 mb-4 rounded-lg bg-secondary px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
              {avatarLetter}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {firstName || "..."}
              </span>
              <Link
                href="/dashboard/profile"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {"Просмотр профиля"}
              </Link>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="border-t border-border p-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            {"Выйти"}
          </Button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card lg:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.slice(0, 7).map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="sr-only lg:not-sr-only">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
