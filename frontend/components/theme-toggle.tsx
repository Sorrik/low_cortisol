"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"

const options = [
  { value: "light", icon: Sun, label: "Светлая" },
  { value: "system", icon: Monitor, label: "Система" },
  { value: "dark", icon: Moon, label: "Тёмная" },
] as const

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className={cn("h-9 rounded-xl bg-surface-card", className)} />
  }

  return (
    <div
      role="radiogroup"
      aria-label="Тема оформления"
      className={cn(
        "flex items-center gap-0.5 rounded-xl border border-edge-soft bg-surface-subtle p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon
        const active = theme === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setTheme(opt.value)}
            className={cn(
              "flex h-7 flex-1 items-center justify-center rounded-lg transition-all",
              active
                ? "bg-surface-hover text-foreground shadow-sm"
                : "text-foreground/40 hover:text-foreground/70",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        )
      })}
    </div>
  )
}
