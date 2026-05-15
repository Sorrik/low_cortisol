"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  Sparkles,
  Moon,
  UtensilsCrossed,
  Smile,
  Brain,
  Flame,
  Droplets,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Zap,
  BookOpen,
  ExternalLink,
  ChevronDown,
  Activity,
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  Info,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AnomalyBanner } from "@/components/dashboard/anomaly-banner"
import { getAccessToken } from "@/lib/auth-store"
import { getInsights, submitRecommendationFeedback } from "@/lib/health-api"
import type { FeedbackRating } from "@/lib/health-api"
import type { ArticleSource, InsightsResponse, Recommendation } from "@/types/health"

type MetricType = "sleep" | "food" | "mood" | "stress" | "activity" | "water"
type SeverityType = "alert" | "attention" | "good"

const phaseLabels: Record<string, { label: string; desc: string; qualityHint: string }> = {
  cold_start: {
    label: "Начальный этап",
    desc: "Система собирает первые данные о вашем состоянии.",
    qualityHint: "Советы строятся на базовых закономерностях и будут уточняться по мере накопления данных.",
  },
  learning: {
    label: "Этап обучения",
    desc: "Модель изучает ваши паттерны и уточняет прогнозы.",
    qualityHint: "Рекомендации уже полезны, но точность персонального прогноза пока повышается.",
  },
  personal: {
    label: "Персональная модель",
    desc: "Рекомендации уже адаптированы под вашу личную историю.",
    qualityHint: "Система опирается на вашу накопленную историю и лучше учитывает личные паттерны.",
  },
}

const metricConfig: Record<MetricType, {
  icon: LucideIcon
  label: string
  color: string
  bgColor: string
}> = {
  sleep: { icon: Moon, label: "Сон", color: "text-violet-400", bgColor: "bg-violet-500/10" },
  food: { icon: UtensilsCrossed, label: "Питание", color: "text-amber-400", bgColor: "bg-amber-500/10" },
  mood: { icon: Smile, label: "Настроение", color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
  stress: { icon: Brain, label: "Стресс", color: "text-rose-400", bgColor: "bg-rose-500/10" },
  activity: { icon: Flame, label: "Активность", color: "text-orange-400", bgColor: "bg-orange-500/10" },
  water: { icon: Droplets, label: "Вода", color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
}

const severityConfig: Record<SeverityType, {
  label: string
  icon: LucideIcon
  color: string
  bgColor: string
  borderColor: string
  badgeBg: string
}> = {
  alert: {
    label: "Критично",
    icon: AlertCircle,
    color: "text-rose-400",
    bgColor: "bg-rose-500/[0.03]",
    borderColor: "border-rose-500/20",
    badgeBg: "bg-rose-500/10",
  },
  attention: {
    label: "Улучшить",
    icon: AlertTriangle,
    color: "text-amber-400",
    bgColor: "bg-amber-500/[0.03]",
    borderColor: "border-amber-500/20",
    badgeBg: "bg-amber-500/10",
  },
  good: {
    label: "В норме",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/[0.03]",
    borderColor: "border-emerald-500/20",
    badgeBg: "bg-emerald-500/10",
  },
}

function getReasonText(rec: Recommendation) {
  const metric = metricConfig[rec.metric as MetricType] ?? metricConfig.mood
  const severity = rec.severity as SeverityType
  if (severity === "alert") return `${metric.label}: показатель требует внимания`
  if (severity === "attention") return `${metric.label}: есть потенциал для улучшения`
  return `${metric.label}: показатель стабилен`
}

function getReferencedSources(text: string, sources: ArticleSource[]) {
  const indexes = Array.from(
    new Set(Array.from(text.matchAll(/\[(\d+)\]/g)).map((match) => Number(match[1]))),
  )
  return indexes
    .map((index) => sources.find((source) => source.index === index))
    .filter((source): source is ArticleSource => Boolean(source))
}

function getLocalizedPhaseMessage(phase: InsightsResponse["phase"]) {
  const fallback = phaseLabels[phase.mode] ?? phaseLabels.learning
  if (phase.mode === "cold_start") return `Нужно ещё ${phase.records_needed} дн. наблюдений`
  if (phase.mode === "learning") return `Ещё ${phase.records_needed} дн. до персональной модели`
  return fallback.desc
}

function CitedText({ text, sources = [] }: { text: string; sources?: ArticleSource[] }) {
  const sourceMap = new Map(sources.map((source) => [source.index, source]))
  const parts = text.split(/(\[\d+\])/g)

  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^\[(\d+)\]$/)
        if (!match) return <span key={index}>{part}</span>
        const source = sourceMap.get(Number(match[1]))
        if (!source) return <span key={index}>{part}</span>

        return (
          <a
            key={index}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-0.5 inline-flex items-center rounded-md bg-surface-strong px-1.5 py-0.5 text-xs font-medium text-cyan-400 transition-colors hover:bg-surface-hover"
            title={`${source.title} (${source.year})`}
          >
            {part}
          </a>
        )
      })}
    </>
  )
}

const confidenceConfig: Record<NonNullable<NonNullable<Recommendation["trigger_signal"]>["confidence"]>, { label: string; color: string }> = {
  high: { label: "Высокая", color: "text-emerald-400" },
  medium: { label: "Средняя", color: "text-amber-400" },
  low: { label: "Низкая", color: "text-rose-400" },
}

const strengthConfig: Record<NonNullable<Recommendation["causal_chain"]>["strength"], { label: string; color: string; dot: string }> = {
  strong:   { label: "Сильная связь",   color: "text-emerald-400", dot: "bg-emerald-400" },
  moderate: { label: "Умеренная связь", color: "text-amber-400",   dot: "bg-amber-400"   },
  weak:     { label: "Слабая связь",    color: "text-foreground/40", dot: "bg-foreground/30" },
}

function CausalChainBlock({ chain }: { chain: NonNullable<Recommendation["causal_chain"]> }) {
  const s = strengthConfig[chain.strength]
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-medium">
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
        <span className={s.color}>{s.label}</span>
        <span className="text-foreground/30">·</span>
        <span className="text-foreground/40 font-mono">{chain.chain_id}</span>
        <span className="text-foreground/30">·</span>
        <span className="text-foreground/40">{chain.lag}</span>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-500/20">
            <span className="h-1 w-1 rounded-full bg-rose-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-foreground/30 mb-0.5">Триггер</div>
            <p className="text-xs text-foreground/70">{chain.trigger}</p>
          </div>
        </div>

        {chain.mediator && (
          <div className="flex gap-2">
            <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
              <span className="h-1 w-1 rounded-full bg-amber-400" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-foreground/30 mb-0.5">Посредник</div>
              <p className="text-xs text-foreground/70">{chain.mediator}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-500/20">
            <span className="h-1 w-1 rounded-full bg-cyan-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-foreground/30 mb-0.5">Исход</div>
            <p className="text-xs text-foreground/70">{chain.outcome}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function WhyBlock({ rec }: { rec: Recommendation }) {
  const [open, setOpen] = useState(false)
  const ts = rec.trigger_signal
  const chain = rec.causal_chain

  const conf = ts?.confidence ? confidenceConfig[ts.confidence] : null
  const fmt = (v?: number | null, digits = 1) =>
    v == null || !Number.isFinite(v) ? "—" : v.toFixed(digits)

  // Отклонение в процентах от персональной нормы — понятнее, чем σ
  const deviationPct =
    ts?.current_value != null && ts?.personal_baseline != null && ts.personal_baseline !== 0
      ? ((ts.current_value - ts.personal_baseline) / Math.abs(ts.personal_baseline)) * 100
      : null

  const hasTriggerData = ts != null && (ts.current_value != null || ts.personal_baseline != null || conf)

  // Если ни цепочки, ни trigger-сигнала — блок не рендерим
  if (!chain && !hasTriggerData) return null

  return (
    <div className="mt-4 border-t border-edge-soft pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-foreground/40 transition-colors hover:text-foreground/70"
      >
        <span className="inline-flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Почему этот совет
          {chain && (
            <span className={`ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              chain.strength === "strong" ? "bg-emerald-500/10 text-emerald-400"
              : chain.strength === "moderate" ? "bg-amber-500/10 text-amber-400"
              : "bg-surface-strong text-foreground/40"
            }`}>
              цепочка {chain.chain_id}
            </span>
          )}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-3 rounded-2xl bg-surface-subtle p-4 text-xs leading-relaxed">
          {chain && <CausalChainBlock chain={chain} />}

          {chain && hasTriggerData && <div className="border-t border-edge-soft pt-3" />}

          {hasTriggerData && (
            <div className="space-y-2">
              {ts?.current_value != null && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground/40">Сейчас</span>
                  <span className="text-foreground">{fmt(ts.current_value)}</span>
                </div>
              )}
              {ts?.personal_baseline != null && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground/40">Ваша норма (30 дн.)</span>
                  <span className="text-foreground">{fmt(ts.personal_baseline)}</span>
                </div>
              )}
              {deviationPct != null && Math.abs(deviationPct) >= 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground/40">Отклонение</span>
                  <span
                    className={
                      Math.abs(deviationPct) < 10
                        ? "text-emerald-400"
                        : Math.abs(deviationPct) < 25
                          ? "text-amber-400"
                          : "text-rose-400"
                    }
                  >
                    {deviationPct >= 0 ? "+" : ""}
                    {Math.round(deviationPct)}%
                  </span>
                </div>
              )}
              {conf && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground/40">Уверенность</span>
                  <span className={conf.color}>{conf.label}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FeedbackButtons({ rec }: { rec: Recommendation }) {
  const [submitted, setSubmitted] = useState<FeedbackRating | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ruleId =
    (rec as Recommendation & { rule_id?: string | null }).rule_id ||
    `llm.${(rec as Recommendation & { id?: string }).id ?? "unknown"}`

  const handle = async (rating: FeedbackRating) => {
    if (submitted || isSending) return
    setIsSending(true)
    setError(null)
    try {
      await submitRecommendationFeedback({
        ruleId,
        rating,
        recommendationSnapshot: rec as unknown as Record<string, unknown>,
      })
      setSubmitted(rating)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить оценку")
    } finally {
      setIsSending(false)
    }
  }

  if (submitted) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Спасибо за оценку
      </div>
    )
  }

  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-xs text-foreground/30">Полезно?</span>
      <div className="flex gap-1.5">
        <button
          onClick={() => handle("helpful")}
          disabled={isSending}
          aria-label="Полезно"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-edge-soft bg-surface-subtle text-foreground/40 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => handle("not_helpful")}
          disabled={isSending}
          aria-label="Не полезно"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-edge-soft bg-surface-subtle text-foreground/40 transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  )
}

function RecommendationCard({ rec, sources }: { rec: Recommendation; sources: ArticleSource[] }) {
  const metric = metricConfig[rec.metric as MetricType] ?? metricConfig.mood
  const severity = severityConfig[rec.severity as SeverityType] ?? severityConfig.good
  const Icon = metric.icon
  const SeverityIcon = severity.icon
  const referencedSources = getReferencedSources(rec.description, sources)

  return (
    <div
      className={`group rounded-3xl border ${severity.borderColor} ${severity.bgColor} p-5 transition-all shadow-card-elevated hover:border-edge-strong`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${metric.bgColor}`}>
            <Icon className={`h-5 w-5 ${metric.color}`} />
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${metric.color}`}>
              {metric.label}
            </span>
            <h3 className="mt-0.5 text-sm font-semibold leading-tight text-foreground">{rec.title}</h3>
            <p className="mt-1 text-xs text-foreground/40">{getReasonText(rec)}</p>
          </div>
        </div>
        <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 ${severity.badgeBg}`}>
          <SeverityIcon className={`h-3 w-3 ${severity.color}`} />
          <span className={`text-[10px] font-medium ${severity.color}`}>{severity.label}</span>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-foreground/60">
        <CitedText text={rec.description} sources={sources} />
      </p>

      <WhyBlock rec={rec} />

      {referencedSources.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-edge-soft pt-4">
          <BookOpen className="h-3.5 w-3.5 text-foreground/30" />
          {referencedSources.map((source) => (
            <a
              key={`${source.index}-${source.pmid}`}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-surface-card px-2 py-1 text-[10px] font-medium text-foreground/50 transition-colors hover:bg-surface-hover hover:text-foreground/70"
            >
              [{source.index}] PMID {source.pmid}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          ))}
        </div>
      )}

      <FeedbackButtons rec={rec} />
    </div>
  )
}

function StatsCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
  bgColor,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  sublabel?: string
  color: string
  bgColor: string
}) {
  return (
    <div className="rounded-3xl border border-edge-soft bg-surface-subtle p-4 shadow-card-elevated">
      <div className="mb-3 flex items-center gap-2.5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bgColor}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <span className="text-xs font-medium text-foreground/40">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
        {/* Не показываем единицу измерения, если самого значения нет */}
        {sublabel && value !== "—" && <span className="text-sm text-foreground/30">{sublabel}</span>}
      </div>
    </div>
  )
}

function ProgressSection({ phase }: { phase: InsightsResponse["phase"] }) {
  const total = phase.total_records + phase.records_needed
  const progress = total > 0 ? Math.round((phase.total_records / total) * 100) : 0
  const info = phaseLabels[phase.mode] ?? phaseLabels.learning

  return (
    <div className="rounded-3xl border border-edge-soft bg-surface-subtle p-5 shadow-card-elevated">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10">
            <Zap className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <span className="text-sm font-medium text-foreground">{info.label}</span>
            <p className="text-xs text-foreground/40">{getLocalizedPhaseMessage(phase)}</p>
          </div>
        </div>
        <span className="rounded-full bg-surface-strong px-3 py-1 text-xs font-medium text-foreground/60">
          {phase.total_records}/{total} дней
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-surface-strong">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-foreground/40">{info.qualityHint}</p>
    </div>
  )
}

function CategorySection({
  title,
  icon: Icon,
  recommendations,
  sources,
  color,
  bgColor,
}: {
  title: string
  icon: LucideIcon
  recommendations: Recommendation[]
  sources: ArticleSource[]
  color: string
  bgColor: string
}) {
  if (recommendations.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${bgColor}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <span className="rounded-full bg-surface-strong px-2 py-0.5 text-xs font-medium text-foreground/40">
          {recommendations.length}
        </span>
      </div>
      <div className="grid gap-4">
        {recommendations.map((rec, index) => (
          <RecommendationCard key={`${rec.metric}-${index}`} rec={rec} sources={sources} />
        ))}
      </div>
    </div>
  )
}

function SourcesSection({ sources }: { sources: ArticleSource[] }) {
  const [expanded, setExpanded] = useState(false)
  if (sources.length === 0) return null

  const visibleSources = expanded ? sources : sources.slice(0, 3)

  return (
    <div className="rounded-3xl border border-edge-soft bg-surface-subtle p-5 shadow-card-elevated">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
            <BookOpen className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Источники</h2>
            <p className="text-xs text-foreground/40">Научные публикации</p>
          </div>
        </div>
        <span className="rounded-full bg-surface-strong px-3 py-1 text-xs font-medium text-foreground/60">
          {sources.length}
        </span>
      </div>

      <div className="space-y-2">
        {visibleSources.map((source) => (
          <a
            key={`${source.index}-${source.pmid}`}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start justify-between gap-3 rounded-2xl border border-edge-subtle bg-surface-subtle p-3 transition-all hover:border-edge-medium hover:bg-surface-card"
          >
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-medium text-foreground/40">
                <span className="text-cyan-400">[{source.index}]</span>
                <span>PMID {source.pmid}</span>
                {source.year && <span>{source.year}</span>}
              </div>
              <p className="line-clamp-2 text-xs font-medium leading-relaxed text-foreground/70">{source.title}</p>
            </div>
            <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-foreground/30" />
          </a>
        ))}
      </div>

      {sources.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium text-foreground/40 transition-colors hover:bg-surface-card hover:text-foreground/60"
        >
          {expanded ? "Свернуть" : `Показать все ${sources.length}`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="relative h-48 w-full overflow-hidden rounded-3xl border border-edge-subtle bg-surface-subtle">
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  )
}

// Анимированный мульти-шаговый индикатор для загрузки рекомендаций.
// Показывает "Анализирую → Ищу паттерны → Готовлю советы" с плавной
// сменой шагов каждые 1.2с. Циклится пока запрос идёт.
function RecommendationsLoader() {
  const steps = [
    { icon: Activity, label: "Анализирую ваши данные", hint: "Собираю записи за последние недели" },
    { icon: Zap, label: "Ищу паттерны", hint: "Проверяю корреляции между метриками" },
    { icon: Sparkles, label: "Готовлю советы", hint: "Подбираю персональные рекомендации" },
  ]
  const [step, setStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % steps.length)
    }, 1400)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const StepIcon = steps[step].icon

  return (
    <div className="relative overflow-hidden rounded-3xl border border-edge-soft bg-surface-subtle p-8 shadow-card-elevated">
      {/* Pulsing ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.08] blur-3xl animate-pulse-glow" />
      </div>

      <div className="relative flex flex-col items-center gap-6 py-8 text-center">
        {/* Иконка с двойным кольцом-загрузчиком */}
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl border-2 border-amber-400/30 border-t-amber-400 animate-spin" style={{ animationDuration: "1.5s" }} />
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10">
            <StepIcon className="h-7 w-7 text-amber-400 animate-pulse-glow" />
          </div>
        </div>

        {/* Текущий шаг */}
        <div className="min-h-[3.5rem] space-y-1">
          <p key={`label-${step}`} className="text-base font-semibold text-foreground animate-fade-in-up">
            {steps[step].label}
          </p>
          <p key={`hint-${step}`} className="text-xs text-foreground/50 animate-fade-in-up">
            {steps[step].hint}
          </p>
        </div>

        {/* Прогресс-точки */}
        <div className="flex items-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === step
                  ? "w-8 bg-amber-400"
                  : i < step
                    ? "w-1.5 bg-amber-400/60"
                    : "w-1.5 bg-foreground/15"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function RecommendationsPage() {
  const [mounted, setMounted] = useState(false)
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    setMounted(true)
    setHasToken(Boolean(getAccessToken()))
  }, [])

  const { data: insights, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["insights"],
    queryFn: getInsights,
    enabled: hasToken,
    staleTime: 1000 * 60 * 5,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const sources = insights?.sources ?? []
  const recommendations = insights?.recommendations ?? []
  const anomalyReport = insights?.anomalyReport

  const alertRecs = recommendations.filter((rec) => rec.severity === "alert")
  const attentionRecs = recommendations.filter((rec) => rec.severity === "attention")
  const goodRecs = recommendations.filter((rec) => rec.severity === "good")

  if (!mounted) {
    return <div className="min-h-screen bg-background" />
  }

  if (!hasToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-card">
            <Activity className="h-6 w-6 text-foreground/40" />
          </div>
          <p className="text-foreground/40">Проверяем авторизацию...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-background">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-violet-500/[0.03] blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.03] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <header className="sticky top-0 z-10 border-b border-edge-soft bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              aria-label="Назад"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-edge-soft bg-surface-subtle text-foreground/60 transition-colors hover:bg-surface-card hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10">
                <Sparkles className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Рекомендации</h1>
                <p className="text-xs text-foreground/40">Персональные советы</p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching || isLoading}
            className="gap-2 rounded-xl border-edge-medium bg-surface-subtle text-foreground/70 hover:bg-surface-card hover:text-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Обновить</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {isError && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] px-4 py-3">
            <AlertCircle className="h-4 w-4 text-rose-400" />
            <span className="text-sm text-rose-400">Не удалось загрузить рекомендации</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatsCard
            icon={TrendingUp}
            label="Прогноз"
            value={insights?.predicted_mood != null ? insights.predicted_mood.toFixed(1) : "—"}
            sublabel="/10"
            color="text-cyan-400"
            bgColor="bg-cyan-500/10"
          />
          <StatsCard
            icon={AlertCircle}
            label="Критично"
            value={isLoading ? "—" : alertRecs.length}
            color="text-rose-400"
            bgColor="bg-rose-500/10"
          />
          <StatsCard
            icon={AlertTriangle}
            label="Улучшить"
            value={isLoading ? "—" : attentionRecs.length}
            color="text-amber-400"
            bgColor="bg-amber-500/10"
          />
          <StatsCard
            icon={CheckCircle2}
            label="В норме"
            value={isLoading ? "—" : goodRecs.length}
            color="text-emerald-400"
            bgColor="bg-emerald-500/10"
          />
        </div>

        {insights?.phase && <ProgressSection phase={insights.phase} />}
        {anomalyReport && <AnomalyBanner report={anomalyReport} />}

        {isLoading ? (
          <div className="space-y-4">
            <RecommendationsLoader />
            <SkeletonCard />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-edge-strong py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-surface-subtle">
              <Sparkles className="h-8 w-8 text-foreground/20" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground/60">Пока нет рекомендаций</p>
              <p className="mt-1 text-xs text-foreground/30">Добавьте больше записей для персональных советов</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <CategorySection
              title="Требует внимания"
              icon={AlertCircle}
              recommendations={alertRecs}
              sources={sources}
              color="text-rose-400"
              bgColor="bg-rose-500/10"
            />
            <CategorySection
              title="Можно улучшить"
              icon={AlertTriangle}
              recommendations={attentionRecs}
              sources={sources}
              color="text-amber-400"
              bgColor="bg-amber-500/10"
            />
            <CategorySection
              title="Хорошие показатели"
              icon={CheckCircle2}
              recommendations={goodRecs}
              sources={sources}
              color="text-emerald-400"
              bgColor="bg-emerald-500/10"
            />
          </div>
        )}

        <SourcesSection sources={sources} />

        {insights?.disclaimer && (
          <div className="flex items-start gap-3 rounded-2xl border border-edge-soft bg-surface-subtle px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-foreground/30" />
            <p className="text-xs leading-relaxed text-foreground/40">{insights.disclaimer}</p>
          </div>
        )}
      </main>
    </div>
  )
}
