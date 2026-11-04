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
  Trophy,
  User,
  LogOut,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { LowCorLogo } from "@/components/lowcor-logo"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { getProfile } from "@/lib/health-api"
import api from "@/lib/api"
import { clearAuth } from "@/lib/auth-store"

type NavItem = { href: string; label: string; icon: LucideIcon }
type NavSection = { label: string | null; items: NavItem[] }

const navSections: NavSection[] = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Обзор", icon: LayoutDashboard }],
  },
  {
    label: "Метрики",
    items: [
      { href: "/dashboard/sleep", label: "Сон", icon: Moon },
      { href: "/dashboard/nutrition", label: "Питание", icon: UtensilsCrossed },
      { href: "/dashboard/mood", label: "Настроение", icon: Smile },
      { href: "/dashboard/stress", label: "Стресс", icon: Brain },
      { href: "/dashboard/activity", label: "Активность", icon: Flame },
      { href: "/dashboard/water", label: "Вода", icon: Droplets },
    ],
  },
  {
    label: "Анализ",
    items: [
      { href: "/dashboard/recommendations", label: "Рекомендации", icon: Sparkles },
      { href: "/dashboard/achievements", label: "Достижения", icon: Trophy },
    ],
  },
  {
    label: "Аккаунт",
    items: [{ href: "/dashboard/profile", label: "Профиль", icon: User }],
  },
]

// Плоский список для мобильной нижней навигации.
const navItems = navSections.flatMap((s) => s.items)

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
      <aside className="fixed left-0 top-0 z-40 hidden h-svh w-64 flex-col border-r border-edge-subtle bg-sidebar/60 backdrop-blur-sm lg:flex">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 pb-5 pt-6">
          <LowCorLogo className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold tracking-tight text-foreground">LowCor</span>
        </div>

        {/* User */}
        <Link
          href="/dashboard/profile"
          className="group mx-3 mb-2 flex items-center gap-3 rounded-xl border border-edge-subtle bg-surface-card px-3 py-2.5 transition-colors hover:bg-surface-strong"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {avatarLetter}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              {firstName || "..."}
            </span>
            <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
              {"Просмотр профиля"}
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {navSections.map((section, i) => (
            <div key={section.label ?? "main"} className={cn(i > 0 && "mt-5")}>
              {section.label && (
                <p className="px-3 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.label}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 font-semibold text-primary"
                            : "font-medium text-muted-foreground hover:bg-surface-strong hover:text-foreground"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                        )}
                        <item.icon
                          className={cn(
                            "h-5 w-5 shrink-0 transition-colors",
                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Theme + Logout */}
        <div className="space-y-2 border-t border-edge-subtle p-3">
          <ThemeToggle />
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
          {navItems.slice(0, 8).map((item) => {
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
