"use client"

import { useQuery }         from "@tanstack/react-query"
import { useState, useMemo } from "react"
import Link                  from "next/link"
import {
  Trophy, Flame, Target, TrendingUp, TrendingDown,
  ChevronLeft, Moon, Droplets, Smile, User, Award,
  Star, Crown, Lock, CheckCircle2, Sparkles, Filter,
  Brain, Zap, BarChart3, Footprints, LayoutGrid, Activity,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn }       from "@/lib/utils"
import { Button }   from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge }    from "@/components/ui/badge"
import { getAchievements, getFullStreakData, getUserLevel } from "@/lib/health-api"
import type { Achievement, FullStreakData, UserLevelInfo } from "@/types/health"
import { STREAK_MILESTONES, LEVEL_CONFIG } from "@/types/health"

// ── Icon Map ─────────────────────────────────────────────────

const iconMap: Record<string, LucideIcon> = {
  flame: Flame, moon: Moon, droplets: Droplets, smile: Smile,
  brain: Brain, "trending-up": TrendingUp, "trending-down": TrendingDown,
  target: Target, user: User, award: Award, star: Star, crown: Crown,
  zap: Zap, "bar-chart": BarChart3, footprints: Footprints,
  "layout-grid": LayoutGrid, activity: Activity,
}

// ── Category config ───────────────────────────────────────────

const categoryConfig: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  streak:      { label: "Стрики",    icon: Flame,     color: "text-orange-400" },
  goal:        { label: "Цели",      icon: Target,    color: "text-emerald-400" },
  improvement: { label: "Улучшения", icon: TrendingUp,color: "text-blue-400"   },
  anomaly:     { label: "Аномалии",  icon: Activity,  color: "text-violet-400" },
  level:       { label: "Уровни",    icon: Award,     color: "text-amber-400"  },
}

// ── Rarity config ─────────────────────────────────────────────

const rarityConfig: Record<string, {
  label: string; bg: string; border: string; text: string; glow: string
}> = {
  common:    { label:"Обычный",    bg:"bg-zinc-500/10",   border:"border-zinc-500/30",   text:"text-zinc-400",   glow:""                      },
  rare:      { label:"Редкий",     bg:"bg-blue-500/10",   border:"border-blue-500/30",   text:"text-blue-400",   glow:"shadow-blue-500/20"    },
  epic:      { label:"Эпический",  bg:"bg-violet-500/10", border:"border-violet-500/30", text:"text-violet-400", glow:"shadow-violet-500/20"  },
  legendary: { label:"Легендарный",bg:"bg-amber-500/10",  border:"border-amber-500/30",  text:"text-amber-400",  glow:"shadow-amber-500/30"   },
}

// ── Helpers ───────────────────────────────────────────────────

function getDayWord(n: number): string {
  if (n === 1) return "день"
  if (n >= 2 && n <= 4) return "дня"
  return "дней"
}

// ── Streak Card ───────────────────────────────────────────────

function StreakCard({ title, description, current, best, icon: Icon, color }: {
  title: string; description: string
  current: number; best: number
  icon: LucideIcon; color: string
}) {
  const nextMilestone = STREAK_MILESTONES.find(t => t > current) ?? 100
  const progress      = (current / nextMilestone) * 100

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", color)}>
            <Icon className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-4xl font-bold tabular-nums text-foreground">{current}</span>
        <span className="text-sm text-muted-foreground">{getDayWord(current)}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Лучший результат: {best} {getDayWord(best)}
      </p>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">До {nextMilestone} {getDayWord(nextMilestone)}</span>
          <span className="font-medium text-primary">{nextMilestone - current} осталось</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    </div>
  )
}

// ── Level Card ────────────────────────────────────────────────

function LevelCard({ levelInfo }: { levelInfo: UserLevelInfo }) {
  const progress  = (levelInfo.xp / levelInfo.nextLevelXp) * 100
  const levels    = Object.entries(LEVEL_CONFIG)
  const curIdx    = levels.findIndex(([key]) => key === levelInfo.level)

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="relative px-6 py-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <TrendingUp className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Ваш уровень</p>
                <h2 className="text-2xl font-bold text-foreground">{levelInfo.name}</h2>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Всего XP</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{levelInfo.totalXp}</p>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">До следующего уровня</span>
              <span className="font-semibold text-foreground">
                {levelInfo.nextLevelXp - levelInfo.xp} XP
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-secondary overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Level progression */}
          <div className="flex items-center justify-between gap-2">
            {levels.map(([key, config], index) => {
              const isUnlocked = index <= curIdx
              const isCurrent  = index === curIdx
              return (
                <div key={key} className={cn(
                  "flex-1 flex flex-col items-center gap-1.5 py-2 rounded-lg transition-colors",
                  isCurrent && "bg-primary/10",
                  !isUnlocked && "opacity-40"
                )}>
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    isUnlocked ? "bg-primary/20" : "bg-secondary"
                  )}>
                    {isUnlocked
                      ? <CheckCircle2 className={cn("h-4 w-4", isCurrent ? "text-primary" : "text-primary/60")} />
                      : <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </div>
                  <span className={cn("text-[10px] font-medium", isCurrent ? "text-foreground" : "text-muted-foreground")}>
                    {config.name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Badge Card ────────────────────────────────────────────────

function BadgeCard({ badge }: { badge: Achievement }) {
  const Icon     = iconMap[badge.icon] ?? Award
  const rarity   = rarityConfig[badge.rarity]   ?? rarityConfig.common
  const progress = Math.min((badge.progress / badge.maxProgress) * 100, 100)
  const isUnlocked = !!badge.unlockedAt

  return (
    <div className={cn(
      "group relative rounded-2xl border p-4 transition-all duration-300",
      isUnlocked
        ? `${rarity.border} ${rarity.bg} hover:shadow-lg ${rarity.glow}`
        : "border-border bg-card/50 opacity-70 hover:opacity-90"
    )}>
      {!isUnlocked && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/30 backdrop-blur-[1px] z-10">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl shrink-0",
          isUnlocked ? rarity.bg : "bg-secondary"
        )}>
          <Icon className={cn("h-5 w-5", isUnlocked ? rarity.text : "text-muted-foreground")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-sm text-foreground leading-tight">{badge.title}</h4>
            {isUnlocked && <Sparkles className={cn("h-4 w-4 shrink-0", rarity.text)} />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{badge.description}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">{badge.progress}/{badge.maxProgress}</span>
          <span className={cn("font-medium", isUnlocked ? rarity.text : "text-muted-foreground")}>
            +{badge.points} XP
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", isUnlocked ? "bg-primary" : "bg-muted-foreground/40")}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {isUnlocked && badge.unlockedAt && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <Badge variant="secondary" className={cn("text-[10px]", rarity.text)}>
            {rarity.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {new Date(badge.unlockedAt).toLocaleDateString("ru-RU", { day:"numeric", month:"short" })}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Filter Chip ───────────────────────────────────────────────

function FilterChip({ label, count, active, onClick, icon: Icon, color }: {
  label: string; count: number; active: boolean; onClick: () => void
  icon?: LucideIcon; color?: string
}) {
  return (
    <button onClick={onClick} className={cn(
      "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
      active
        ? "bg-primary text-primary-foreground"
        : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
    )}>
      {Icon && <Icon className={cn("h-3.5 w-3.5", active ? "" : color)} />}
      {label}
      <span className={cn(
        "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs",
        active ? "bg-primary-foreground/20" : "bg-background"
      )}>
        {count}
      </span>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function AchievementsPage() {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [showUnlockedOnly, setShowUnlockedOnly] = useState(false)

  const { data: achievements = [], isLoading: loadingA } = useQuery({
    queryKey: ["achievements"], queryFn: getAchievements, staleTime: 1000 * 60 * 5,
  })
  const { data: streakData, isLoading: loadingS } = useQuery({
    queryKey: ["fullStreak"],  queryFn: getFullStreakData, staleTime: 1000 * 60 * 5,
  })
  const { data: levelInfo, isLoading: loadingL } = useQuery({
    queryKey: ["userLevel"],   queryFn: getUserLevel, staleTime: 1000 * 60 * 5,
  })

  const loading = loadingA || loadingS || loadingL

  const filteredBadges = useMemo(() =>
    achievements
      .filter(b => !categoryFilter || b.category === categoryFilter)
      .filter(b => !showUnlockedOnly || b.unlockedAt)
      .sort((a, b) => {
        if (!!a.unlockedAt !== !!b.unlockedAt) return a.unlockedAt ? -1 : 1
        const order = { legendary: 0, epic: 1, rare: 2, common: 3 }
        return order[a.rarity] - order[b.rarity]
      }),
    [achievements, categoryFilter, showUnlockedOnly]
  )

  const unlockedCount = achievements.filter(b => b.unlockedAt).length
  const totalCount    = achievements.length

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="h-8 w-32 animate-pulse rounded-md bg-secondary" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">Достижения</h1>
              <p className="text-xs text-muted-foreground">
                {unlockedCount} из {totalCount} разблокировано
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-amber-400">{unlockedCount}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="space-y-8">

          {/* Level */}
          {levelInfo && <LevelCard levelInfo={levelInfo} />}

          {/* Streaks */}
          {streakData && (
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground mb-4">
                <Flame className="h-5 w-5 text-orange-400" />Стрики
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StreakCard title="Любые данные"   description="Внеси хоть что-то за день"     current={streakData.anyData.current}    best={streakData.anyData.best}    icon={Flame}        color="bg-orange-500/10"  />
                <StreakCard title="Все 6 метрик"   description="Заполни все показатели"         current={streakData.allMetrics.current} best={streakData.allMetrics.best} icon={Target}       color="bg-primary/10"     />
                <StreakCard title="Выполнение нормы" description="Достигай своих целей"         current={streakData.goalsMet.current}   best={streakData.goalsMet.best}   icon={CheckCircle2} color="bg-emerald-500/10" />
              </div>
            </div>
          )}

          {/* Badges */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Trophy className="h-5 w-5 text-amber-400" />Бейджи
              </h2>
              <button
                onClick={() => setShowUnlockedOnly(!showUnlockedOnly)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  showUnlockedOnly ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                )}
              >
                <Filter className="h-3.5 w-3.5" />Только полученные
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              <FilterChip label="Все" count={totalCount} active={categoryFilter === null} onClick={() => setCategoryFilter(null)} />
              {Object.entries(categoryConfig).map(([cat, cfg]) => (
                <FilterChip key={cat} label={cfg.label}
                  count={achievements.filter(b => b.category === cat).length}
                  active={categoryFilter === cat} onClick={() => setCategoryFilter(cat)}
                  icon={cfg.icon} color={cfg.color} />
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBadges.map(badge => <BadgeCard key={badge.id} badge={badge} />)}
            </div>

            {filteredBadges.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-4">
                  <Trophy className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Нет бейджей</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Попробуйте изменить фильтры или продолжайте отслеживать своё здоровье
                </p>
              </div>
            )}
          </div>

          {/* Rarity stats */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Статистика по редкости</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(["common","rare","epic","legendary"] as const).map(rarity => {
                const cfg      = rarityConfig[rarity]
                const count    = achievements.filter(b => b.rarity === rarity).length
                const unlocked = achievements.filter(b => b.rarity === rarity && b.unlockedAt).length
                return (
                  <div key={rarity} className={cn("rounded-xl border p-4", cfg.border, cfg.bg)}>
                    <p className={cn("text-xs font-medium mb-1", cfg.text)}>{cfg.label}</p>
                    <p className="text-2xl font-bold tabular-nums text-foreground">
                      {unlocked}<span className="text-sm text-muted-foreground">/{count}</span>
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}