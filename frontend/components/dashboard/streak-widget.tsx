"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Flame, Trophy, TrendingUp, ChevronRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { getFullStreakData, getUserLevel, getAchievements } from "@/lib/health-api"
import { STREAK_MILESTONES } from "@/types/health"

function getDayWord(n: number): string {
  if (n === 1) return "день"
  if (n >= 2 && n <= 4) return "дня"
  return "дней"
}

export function StreakWidget({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState<"any" | "all" | "goals">("any")

  const { data: streakData } = useQuery({
    queryKey:  ["fullStreak"],
    queryFn:   getFullStreakData,
    staleTime: 1000 * 60 * 5,
  })

  const { data: levelInfo } = useQuery({
    queryKey:  ["userLevel"],
    queryFn:   getUserLevel,
    staleTime: 1000 * 60 * 5,
  })

  const { data: achievements = [] } = useQuery({
    queryKey:  ["achievements"],
    queryFn:   getAchievements,
    staleTime: 1000 * 60 * 5,
  })

  if (!streakData || !levelInfo) {
    return (
      <div className={cn("rounded-2xl border border-border bg-card h-48 animate-pulse", className)} />
    )
  }

  const tabs = [
    { id: "any"   as const, label: "Данные",   streak: streakData.anyData    },
    { id: "all"   as const, label: "6 метрик", streak: streakData.allMetrics },
    { id: "goals" as const, label: "Норма",    streak: streakData.goalsMet   },
  ]

  const activeStreak   = tabs.find(t => t.id === activeTab)!.streak
  const nextMilestone  = STREAK_MILESTONES.find(t => t > activeStreak.current) ?? 100
  const prevMilestone  = [...STREAK_MILESTONES].reverse().find(t => t <= activeStreak.current) ?? 0
  const milestoneProgress = ((activeStreak.current - prevMilestone) / (nextMilestone - prevMilestone)) * 100

  const levelProgress  = (levelInfo.xp / levelInfo.nextLevelXp) * 100
  const unlockedBadges = achievements.filter(a => a.unlockedAt).length
  const totalBadges    = achievements.length
  const isOnFire       = activeStreak.current >= 7

  return (
    <div className={cn("rounded-2xl border border-border bg-card overflow-hidden", className)}>

      {/* Header */}
      <div className="relative px-5 pt-5 pb-4">
        {isOnFire && (
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 via-transparent to-amber-500/5" />
        )}

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl",
                isOnFire ? "bg-gradient-to-br from-orange-500/20 to-amber-500/20" : "bg-secondary"
              )}>
                <Flame className={cn(
                  "h-6 w-6",
                  activeStreak.current > 0 ? "text-orange-400" : "text-muted-foreground"
                )} />
              </div>
              {isOnFire && (
                <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-amber-950">
                  <Sparkles className="h-3 w-3" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tabular-nums text-foreground">
                  {activeStreak.current}
                </span>
                <span className="text-sm text-muted-foreground">
                  {getDayWord(activeStreak.current)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Лучший: {activeStreak.best} {getDayWord(activeStreak.best)}
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/achievements"
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium
                       text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">Достижения</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Tabs */}
        <div className="relative mt-4 flex gap-1 rounded-lg bg-secondary/50 p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Progress to next milestone */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted-foreground">
            До {nextMilestone} {getDayWord(nextMilestone)}
          </span>
          <span className="font-medium text-orange-400">
            +{nextMilestone - activeStreak.current}
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500"
            style={{ width: `${Math.min(milestoneProgress, 100)}%` }}
          />
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Level + Badges */}
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Уровень</span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-lg font-bold text-foreground">{levelInfo.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={levelProgress} className="h-1.5 flex-1" />
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {levelInfo.xp}/{levelInfo.nextLevelXp}
            </span>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-medium text-muted-foreground">Достижения</span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-lg font-bold text-foreground">{unlockedBadges}</span>
            <span className="text-xs text-muted-foreground">из {totalBadges}</span>
          </div>
          <Progress value={totalBadges > 0 ? (unlockedBadges / totalBadges) * 100 : 0} className="h-1.5" />
        </div>
      </div>

    </div>
  )
}