"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Sparkles, Moon, UtensilsCrossed, Smile,
  Brain, Flame, Droplets, RefreshCw,
  TrendingUp, BookOpen, ExternalLink,
  AlertTriangle, CheckCircle2, AlertCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Badge }   from "@/components/ui/badge"
import { Button }  from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getInsights }       from "@/lib/health-api"
import type { InsightsResponse, MetricType, Recommendation, ArticleSource} from "@/types/health"

// ── Icon & label maps ─────────────────────────────────────────

const metricIcons: Record<MetricType, LucideIcon> = {
  sleep:    Moon,
  food:     UtensilsCrossed,
  mood:     Smile,
  stress:   Brain,
  activity: Flame,
  water:    Droplets,
}

const metricLabels: Record<MetricType, string> = {
  sleep:    "Сон",
  food:     "Питание",
  mood:     "Настроение",
  stress:   "Стресс",
  activity: "Активность",
  water:    "Вода",
}

const metricColors: Record<MetricType, string> = {
  sleep:    "oklch(0.70 0.15 260)",
  food:     "oklch(0.75 0.15 55)",
  mood:     "oklch(0.75 0.14 145)",
  stress:   "oklch(0.65 0.22 25)",
  activity: "oklch(0.72 0.19 30)",
  water:    "oklch(0.70 0.12 230)",
}

const severityConfig = {
  alert: {
    label:     "Важно",
    icon:      AlertCircle,
    border:    "border-l-rose-500",
    badge:     "bg-rose-500/10 text-rose-400 border-rose-500/30",
    iconColor: "text-rose-400",
  },
  attention: {
    label:     "Внимание",
    icon:      AlertTriangle,
    border:    "border-l-amber-500",
    badge:     "bg-amber-500/10 text-amber-400 border-amber-500/30",
    iconColor: "text-amber-400",
  },
  good: {
    label:     "Хорошо",
    icon:      CheckCircle2,
    border:    "border-l-emerald-500",
    badge:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    iconColor: "text-emerald-400",
  },
}

// ── Citation parser ───────────────────────────────────────────
// Превращает [1] [2] [3] в кликабельные ссылки на конкретные статьи

// СТАЛО — явно указываем тип
function CitedText({
  text,
  sources = [],
}: {
  text:     string
  sources?: ArticleSource[]
}) {
  // Строим карту index → source для быстрого поиска
  const sourceMap = new Map(sources.map(s => [s.index, s]))

  const parts = text.split(/(\[\d+\])/g)

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/)
        if (!match) return <span key={i}>{part}</span>

        const index  = parseInt(match[1])
        const source = sourceMap.get(index)

        // Если есть конкретная статья — прямая ссылка на Europe PMC
        // Если нет — общий поиск (fallback)
        const href  = source?.url
          ?? `https://europepmc.org/search?query=${encodeURIComponent("sleep mood stress health cortisol")}&resulttype=core`
        const title = source
          ? `${source.title} (${source.year})`
          : "Открыть источник"

        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={title}
            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs font-semibold
                       bg-primary/15 text-primary hover:bg-primary/25 transition-colors
                       no-underline mx-0.5 cursor-pointer"
          >
            {part}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )
      })}
    </>
  )
}

// ── Recommendation Card ───────────────────────────────────────

function RecommendationCard({
  rec,
  sources,
  index,
}: {
  rec:     Recommendation
  sources: ArticleSource[]
  index:   number
}) {
  const Icon     = metricIcons[rec.metric]
  const severity = severityConfig[rec.severity as keyof typeof severityConfig] ?? severityConfig.good
  const SevIcon  = severity.icon
  const color    = metricColors[rec.metric]

  const hasCitations = /\[\d+\]/.test(rec.description)

  // Статьи которые упоминаются именно в этой рекомендации
  const citedIndices = [...rec.description.matchAll(/\[(\d+)\]/g)]
    .map(m => parseInt(m[1]))
  const citedSources = sources.filter(s => citedIndices.includes(s.index))

  return (
    <div
      className={`
        group relative rounded-xl border border-border bg-card
        border-l-4 ${severity.border}
        shadow-lg transition-all duration-200
        hover:-translate-y-0.5 hover:shadow-xl hover:border-border/80
      `}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="p-5">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)` }}
            >
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {metricLabels[rec.metric]}
            </span>
          </div>

          <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${severity.badge}`}>
            <SevIcon className={`h-3 w-3 ${severity.iconColor}`} />
            {severity.label}
          </div>
        </div>

        {/* Title */}
        <h3 className="mb-2 text-sm font-bold leading-snug text-foreground">
          {rec.title}
        </h3>

        {/* Description с кликабельными ссылками */}
        <p className="text-sm leading-relaxed text-muted-foreground">
          <CitedText text={rec.description} sources={sources} />
        </p>

        {/* Источники конкретно для этой карточки */}
        {citedSources.length > 0 && (
          <div className="mt-4 border-t border-border/50 pt-3 flex flex-col gap-1.5">
            {citedSources.map(source => (
              <a
                key={source.pmid}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 group/link"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center
                                 rounded bg-primary/15 text-[10px] font-bold text-primary">
                  {source.index}
                </span>
                <span className="text-xs text-muted-foreground/70 group-hover/link:text-muted-foreground
                                 transition-colors leading-tight line-clamp-1">
                  {source.title}
                  {source.year && <span className="ml-1 text-muted-foreground/40">({source.year})</span>}
                </span>
                <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground/30
                                        group-hover/link:text-primary transition-colors mt-0.5" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Phase / Forecast Block ────────────────────────────────────

function PhaseBlock({ insights }: { insights: InsightsResponse }) {
  const { phase, predicted_mood, confidence_lower, confidence_upper } = insights

  const needed   = (phase.total_records + phase.records_needed) || 1
  const progress = Math.min(100, Math.round((phase.total_records / needed) * 100))

  const phaseLabels: Record<string, { label: string; color: string; desc: string }> = {
    cold_start: { label: "Начало",       color: "text-slate-400",   desc: "Собираем первые данные"        },
    learning:   { label: "Обучение",     color: "text-amber-400",   desc: "Модель учится на ваших данных" },
    personal:   { label: "Персональная", color: "text-emerald-400", desc: "Модель настроена под вас"      },
  }

  const phaseInfo = phaseLabels[phase.mode] ?? phaseLabels.learning

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {predicted_mood && (
            <div className="flex items-center gap-4 border-b border-border sm:border-b-0 sm:border-r p-5 sm:min-w-[220px]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Прогноз настроения
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tabular-nums text-foreground">
                    {predicted_mood.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">/10</span>
                </div>
                {confidence_lower && confidence_upper && (
                  <p className="text-xs text-muted-foreground/60">
                    {confidence_lower.toFixed(1)}–{confidence_upper.toFixed(1)} диапазон
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-1 flex-col justify-center gap-3 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${phaseInfo.color}`}>{phaseInfo.label}</span>
                <span className="text-xs text-muted-foreground">—</span>
                <span className="text-xs text-muted-foreground">{phaseInfo.desc}</span>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                {phase.total_records} / {needed} дней
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground/60">
              <span>Старт</span>
              {phase.records_needed > 0 && (
                <span>Ещё {phase.records_needed} дней до персональной модели</span>
              )}
              <span>Персональная</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Summary stats ─────────────────────────────────────────────

function SummaryRow({ recommendations }: { recommendations: Recommendation[] }) {
  const counts = {
    alert:     recommendations.filter(r => r.severity === "alert").length,
    attention: recommendations.filter(r => r.severity === "attention").length,
    good:      recommendations.filter(r => r.severity === "good").length,
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: "Важных",   count: counts.alert,     color: "text-rose-400",    bg: "bg-rose-500/10"    },
        { label: "Внимания", count: counts.attention, color: "text-amber-400",   bg: "bg-amber-500/10"   },
        { label: "Хороших",  count: counts.good,      color: "text-emerald-400", bg: "bg-emerald-500/10" },
      ].map(({ label, count, color, bg }) => (
        <div key={label} className={`flex flex-col items-center rounded-xl ${bg} border border-border py-3`}>
          <span className={`text-2xl font-bold tabular-nums ${color}`}>{count}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border border-l-4 border-l-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-secondary" />
          <div className="h-3 w-20 animate-pulse rounded bg-secondary" />
        </div>
        <div className="h-6 w-16 animate-pulse rounded-full bg-secondary" />
      </div>
      <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-secondary" />
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-secondary" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-secondary" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-secondary" />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const { data: insights, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["insights"],
    queryFn:  getInsights,
  })

  const sortOrder: Record<string, number> = { alert: 0, attention: 1, good: 2 }
  const sortedRecs = insights?.recommendations
    ? [...insights.recommendations].sort(
        (a, b) => (sortOrder[a.severity] ?? 3) - (sortOrder[b.severity] ?? 3)
      )
    : []

  const sources: ArticleSource[] = insights?.sources ?? []
  const hasCitations = sortedRecs.some(r => /\[\d+\]/.test(r.description))

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Рекомендации</h1>
            <p className="text-sm text-muted-foreground">
              Персональные советы на основе ваших данных и научных исследований
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>

      {/* Phase block */}
      {insights?.phase && <PhaseBlock insights={insights} />}

      {/* Summary */}
      {sortedRecs.length > 0 && <SummaryRow recommendations={sortedRecs} />}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Не удалось загрузить рекомендации. Попробуйте позже.
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : sortedRecs.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center justify-center gap-3 rounded-xl
                          border border-dashed border-border py-20 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">Рекомендации появятся после накопления данных</p>
          </div>
        ) : (
          sortedRecs.map((rec, i) => (
            <RecommendationCard key={`${rec.metric}-${i}`} rec={rec} sources={sources} index={i} />
          ))
        )}
      </div>

      {/* Sources footer — все статьи списком */}
      {sources.length > 0 && hasCitations && (
        <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground/60" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
              Научные источники (Europe PMC)
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {sources.map(source => (
              <a
                key={source.pmid}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 group rounded-lg p-2 hover:bg-secondary/40 transition-colors"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded
                                 bg-primary/15 text-xs font-bold text-primary mt-0.5">
                  {source.index}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground group-hover:text-foreground
                                transition-colors leading-relaxed">
                    {source.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    PubMed · PMID: {source.pmid}
                    {source.year && ` · ${source.year}`}
                  </p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30
                                        group-hover:text-primary transition-colors mt-0.5" />
              </a>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}