"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Sparkles, Moon, UtensilsCrossed, Smile, Brain, Flame, Droplets,
  RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, AlertCircle, Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button }   from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { getInsights } from "@/lib/health-api"
import { getAccessToken } from "@/lib/auth-store"
import { AnomalyBanner } from "@/components/dashboard/anomaly-banner"
import type { InsightsResponse, Recommendation, ArticleSource } from "@/types/health"
import { useEffect, useState } from "react"

// ── Config maps ───────────────────────────────────────────────

type MetricType   = "sleep" | "food" | "mood" | "stress" | "activity" | "water"
type SeverityType = "alert" | "attention" | "good"

const metricConfig: Record<MetricType, {
  icon: LucideIcon; label: string; color: string; bgColor: string
}> = {
  sleep:    { icon: Moon,            label: "Сон",        color: "text-indigo-400", bgColor: "bg-indigo-500/10"  },
  food:     { icon: UtensilsCrossed, label: "Питание",     color: "text-amber-400",  bgColor: "bg-amber-500/10"   },
  mood:     { icon: Smile,           label: "Настроение", color: "text-emerald-400",bgColor: "bg-emerald-500/10" },
  stress:   { icon: Brain,           label: "Стресс",     color: "text-rose-400",  bgColor: "bg-rose-500/10"    },
  activity: { icon: Flame,           label: "Активность", color: "text-orange-400", bgColor: "bg-orange-500/10"  },
  water:    { icon: Droplets,        label: "Вода",       color: "text-sky-400",    bgColor: "bg-sky-500/10"     },
}

const severityConfig: Record<SeverityType, {
  label: string; icon: LucideIcon
  color: string; bgColor: string; borderColor: string; badgeBg: string
}> = {
  alert: {
    label: "Требует внимания", icon: AlertCircle,
    color: "text-rose-400",    bgColor: "bg-rose-500/5",
    borderColor: "border-rose-500/30", badgeBg: "bg-rose-500/10",
  },
  attention: {
    label: "Можно улучшить",   icon: AlertTriangle,
    color: "text-amber-400",   bgColor: "bg-amber-500/5",
    borderColor: "border-amber-500/30", badgeBg: "bg-amber-500/10",
  },
  good: {
    label: "Всё отлично",      icon: CheckCircle2,
    color: "text-emerald-400", bgColor: "bg-emerald-500/5",
    borderColor: "border-emerald-500/30", badgeBg: "bg-emerald-500/10",
  },
}

// ── Вспомогательные компоненты (CitedText, RecommendationCard, StatsCard, ProgressSection, CategorySection) ──
// ... (оставляем без изменений, так как они работают корректно) ...

function CitedText({ text, sources = [] }: { text: string; sources?: ArticleSource[] }) {
  const sourceMap = new Map(sources.map(s => [s.index, s]))
  const parts = text.split(/(\[\d+\])/g)

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/)
        if (!match) return <span key={i}>{part}</span>
        const source = sourceMap.get(parseInt(match[1]))
        const href   = source?.url ?? "#"
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer" 
             className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors mx-0.5">
            {part}
          </a>
        )
      })}
    </>
  )
}

function RecommendationCard({ rec, sources }: { rec: Recommendation; sources: ArticleSource[] }) {
  const metric   = metricConfig[rec.metric as MetricType]       ?? metricConfig.mood
  const severity = severityConfig[rec.severity as SeverityType] ?? severityConfig.good
  const Icon     = metric.icon
  const SevIcon  = severity.icon
  return (
    <div className={`rounded-2xl border ${severity.borderColor} ${severity.bgColor} transition-all duration-300 hover:scale-[1.01] hover:shadow-lg`}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${metric.bgColor}`}>
              <Icon className={`h-5 w-5 ${metric.color}`} />
            </div>
            <div>
              <span className={`text-xs font-semibold uppercase tracking-wider ${metric.color}`}>{metric.label}</span>
              <h3 className="text-base font-semibold text-foreground mt-0.5 leading-tight">{rec.title}</h3>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 rounded-full ${severity.badgeBg} px-3 py-1.5 shrink-0`}>
            <SevIcon className={`h-3.5 w-3.5 ${severity.color}`} />
            <span className={`text-xs font-medium ${severity.color}`}>{severity.label}</span>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <CitedText text={rec.description} sources={sources} />
        </p>
      </div>
    </div>
  )
}

function StatsCard({ icon: Icon, label, value, sublabel, color, bgColor }: {
  icon: LucideIcon; label: string; value: string | number
  sublabel?: string; color: string; bgColor: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bgColor}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums text-foreground">{value}</span>
        {sublabel && <span className="text-sm text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  )
}

function ProgressSection({ phase }: { phase: InsightsResponse["phase"] }) {
  const total = phase.total_records + phase.records_needed
  const progress = total > 0 ? Math.round((phase.total_records / total) * 100) : 0

  const phaseLabels: Record<string, { label: string; desc: string }> = {
    cold_start: { label: "Начальный этап",      desc: "Собираем первые данные о вашем здоровье"          },
    learning:   { label: "Этап обучения",       desc: "Модель анализирует ваши паттерны"    },
    personal:   { label: "Персональная модель", desc: "Рекомендации полностью адаптированы"      },
  }

  const info = phaseLabels[phase.mode] ?? phaseLabels.learning

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{info.label}</span>
        </div>
        <span className="text-sm font-medium text-muted-foreground">{phase.total_records} из {total} дней</span>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="mt-3 text-sm text-muted-foreground">{phase.message}</p>
    </div>
  )
}

function CategorySection({ title, icon: Icon, recommendations, sources, color, bgColor }: {
  title: string; icon: LucideIcon
  recommendations: Recommendation[]; sources: ArticleSource[]
  color: string; bgColor: string
}) {
  if (recommendations.length === 0) return null
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgColor}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <div className="grid gap-4">
        {recommendations.map((rec, i) => (
          <RecommendationCard key={`${rec.metric}-${i}`} rec={rec} sources={sources} />
        ))}
      </div>
    </div>
  )
}

function SkeletonCard() {
  return <div className="h-40 w-full rounded-2xl bg-secondary animate-pulse" />
}

// ── Page ──────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const [mounted,  setMounted]  = useState(false)
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    setMounted(true)
    setHasToken(!!getAccessToken())
  }, [])

  const {
    data:    insights,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["insights"],
    queryFn:  getInsights,
    // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: не запускаем запрос, пока не подтвержден токен
    enabled:  hasToken, 
    staleTime: 1000 * 60 * 5,
    retry: 1, 
    refetchOnWindowFocus: false,
  })

  const sources         = insights?.sources         ?? []
  const recommendations = insights?.recommendations ?? []
  const anomalyReport   = insights?.anomalyReport
  
  const alertRecs     = recommendations.filter(r => r.severity === "alert")
  const attentionRecs = recommendations.filter(r => r.severity === "attention")
  const goodRecs      = recommendations.filter(r => r.severity === "good")

  // До монтирования: SSR и первый рендер клиента дают одинаковый результат → нет hydration mismatch
  if (!mounted) {
    return <div className="min-h-screen bg-background" />
  }

  if (!hasToken) {
    return <div className="p-20 text-center text-muted-foreground">Проверка авторизации...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Рекомендации</h1>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching || isLoading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              <span>Обновить</span>
            </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        {isError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-500 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Не удалось загрузить данные. Проверьте соединение.
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            icon={TrendingUp} label="Прогноз дня"
            value={insights?.predicted_mood != null ? insights.predicted_mood.toFixed(1) : "—"} sublabel="/10"
            color="text-primary" bgColor="bg-primary/10"
          />
          <StatsCard
            icon={AlertCircle}   label="Критично"
            value={isLoading ? "—" : alertRecs.length}
            color="text-rose-400"    bgColor="bg-rose-500/10"
          />
          <StatsCard
            icon={AlertTriangle} label="Улучшить"
            value={isLoading ? "—" : attentionRecs.length}
            color="text-amber-400"   bgColor="bg-amber-500/10"
          />
          <StatsCard
            icon={CheckCircle2}  label="В норме"
            value={isLoading ? "—" : goodRecs.length}
            color="text-emerald-400" bgColor="bg-emerald-500/10"
          />
        </div>

        {insights?.phase && <ProgressSection phase={insights.phase} />}
        {anomalyReport && (<AnomalyBanner report={anomalyReport} />)}

        {/* Recommendations Content */}
        {isLoading ? (
          <div className="space-y-4">
            <SkeletonCard /><SkeletonCard />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">Добавьте больше записей за сегодня, чтобы получить советы</p>
          </div>
        ) : (
          <div className="space-y-10">
            <CategorySection title="Требует внимания" icon={AlertCircle} recommendations={alertRecs} sources={sources} color="text-rose-400" bgColor="bg-rose-500/10" />
            <CategorySection title="Можно улучшить" icon={AlertTriangle} recommendations={attentionRecs} sources={sources} color="text-amber-400" bgColor="bg-amber-500/10" />
            <CategorySection title="Хорошие показатели" icon={CheckCircle2} recommendations={goodRecs} sources={sources} color="text-emerald-400" bgColor="bg-emerald-500/10" />
          </div>
        )}
      </main>
    </div>
  )
}
