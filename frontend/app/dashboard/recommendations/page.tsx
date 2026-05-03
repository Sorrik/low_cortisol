"use client"

import { useEffect, useState } from "react"
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
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AnomalyBanner } from "@/components/dashboard/anomaly-banner"
import { getAccessToken } from "@/lib/auth-store"
import { getInsights } from "@/lib/health-api"
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
  sleep: { icon: Moon, label: "Сон", color: "text-indigo-400", bgColor: "bg-indigo-500/10" },
  food: { icon: UtensilsCrossed, label: "Питание", color: "text-amber-400", bgColor: "bg-amber-500/10" },
  mood: { icon: Smile, label: "Настроение", color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
  stress: { icon: Brain, label: "Стресс", color: "text-rose-400", bgColor: "bg-rose-500/10" },
  activity: { icon: Flame, label: "Активность", color: "text-orange-400", bgColor: "bg-orange-500/10" },
  water: { icon: Droplets, label: "Вода", color: "text-sky-400", bgColor: "bg-sky-500/10" },
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
    label: "Требует внимания",
    icon: AlertCircle,
    color: "text-rose-400",
    bgColor: "bg-rose-500/5",
    borderColor: "border-rose-500/30",
    badgeBg: "bg-rose-500/10",
  },
  attention: {
    label: "Можно улучшить",
    icon: AlertTriangle,
    color: "text-amber-400",
    bgColor: "bg-amber-500/5",
    borderColor: "border-amber-500/30",
    badgeBg: "bg-amber-500/10",
  },
  good: {
    label: "Хорошие показатели",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/5",
    borderColor: "border-emerald-500/30",
    badgeBg: "bg-emerald-500/10",
  },
}

function getReasonText(rec: Recommendation) {
  const metric = metricConfig[rec.metric as MetricType] ?? metricConfig.mood
  const severity = rec.severity as SeverityType

  if (severity === "alert") {
    return `${metric.label}: показатель требует внимания и может сильнее влиять на общее состояние.`
  }

  if (severity === "attention") {
    return `${metric.label}: есть потенциал для улучшения в ближайшие дни.`
  }

  return `${metric.label}: показатель сейчас выглядит стабильным, важно сохранить этот уровень.`
}

function getReferencedSources(text: string, sources: ArticleSource[]) {
  const indexes = Array.from(new Set(
    Array.from(text.matchAll(/\[(\d+)\]/g)).map(match => Number(match[1])),
  ))

  return indexes
    .map(index => sources.find(source => source.index === index))
    .filter((source): source is ArticleSource => Boolean(source))
}

function getLocalizedPhaseMessage(phase: InsightsResponse["phase"]) {
  const fallback = phaseLabels[phase.mode] ?? phaseLabels.learning

  if (phase.mode === "cold_start") {
    return `${fallback.desc} Нужно ещё ${phase.records_needed} дн. наблюдений, чтобы перейти к следующему этапу.`
  }

  if (phase.mode === "learning") {
    return `${fallback.desc} Нужно ещё ${phase.records_needed} дн., чтобы включить полностью персональную модель.`
  }

  return fallback.desc
}

function CitedText({ text, sources = [] }: { text: string; sources?: ArticleSource[] }) {
  const sourceMap = new Map(sources.map(source => [source.index, source]))
  const parts = text.split(/(\[\d+\])/g)

  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^\[(\d+)\]$/)
        if (!match) return <span key={index}>{part}</span>

        const source = sourceMap.get(Number(match[1]))
        if (!source) {
          return <span key={index}>{part}</span>
        }

        return (
          <a
            key={index}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            title={`${source.title} (${source.year})`}
          >
            {part}
          </a>
        )
      })}
    </>
  )
}

const confidenceConfig: Record<NonNullable<NonNullable<Recommendation['trigger_signal']>['confidence']>, { label: string; color: string }> = {
  high:   { label: "Высокая",  color: "text-emerald-400" },
  medium: { label: "Средняя",  color: "text-amber-400"   },
  low:    { label: "Низкая",   color: "text-rose-400"    },
}

const sourceLabels: Record<NonNullable<Recommendation['trigger_signal']>['source'], string> = {
  rule:        "правило",
  ml_shap:     "ML-модель (SHAP)",
  llm:         "LLM-обобщение",
  consistency: "расхождение в данных",
  fallback:    "резервное правило",
}

function WhyBlock({ rec }: { rec: Recommendation }) {
  const [open, setOpen] = useState(false)
  const ts = rec.trigger_signal
  if (!ts && !rec.rule_id) return null

  const conf = ts?.confidence ? confidenceConfig[ts.confidence] : null
  const fmt = (v?: number | null, digits = 1) =>
    v == null || !Number.isFinite(v) ? "—" : v.toFixed(digits)

  return (
    <div className="mt-4 border-t border-border/60 pt-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="inline-flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          Почему мы это советуем
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="mt-3 space-y-1.5 rounded-lg bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {ts?.source ? (
            <div>
              <span className="text-muted-foreground/70">Источник сигнала: </span>
              <span className="text-foreground">{sourceLabels[ts.source]}</span>
              {rec.rule_id ? (
                <span className="text-muted-foreground/70"> (rule_id: <code className="text-[10px]">{rec.rule_id}</code>)</span>
              ) : null}
            </div>
          ) : rec.rule_id ? (
            <div>
              <span className="text-muted-foreground/70">rule_id: </span>
              <code className="text-[10px] text-foreground">{rec.rule_id}</code>
            </div>
          ) : null}

          {ts?.current_value != null ? (
            <div>
              <span className="text-muted-foreground/70">Сейчас: </span>
              <span className="text-foreground">{fmt(ts.current_value)}</span>
              {ts.personal_baseline != null ? (
                <>
                  <span className="text-muted-foreground/70"> · твоя норма за 30 дней: </span>
                  <span className="text-foreground">{fmt(ts.personal_baseline)}</span>
                </>
              ) : null}
            </div>
          ) : null}

          {ts?.z_score != null ? (
            <div>
              <span className="text-muted-foreground/70">Отклонение от нормы: </span>
              <span className="text-foreground">{ts.z_score >= 0 ? "+" : ""}{fmt(ts.z_score, 2)}σ</span>
            </div>
          ) : null}

          {ts?.shap_contribution != null ? (
            <div>
              <span className="text-muted-foreground/70">Вклад в прогноз настроения: </span>
              <span className="text-foreground">{ts.shap_contribution >= 0 ? "+" : ""}{fmt(ts.shap_contribution, 2)}</span>
            </div>
          ) : null}

          {conf ? (
            <div>
              <span className="text-muted-foreground/70">Уверенность: </span>
              <span className={conf.color}>{conf.label}</span>
            </div>
          ) : null}
        </div>
      ) : null}
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
    <div className={`rounded-2xl border ${severity.borderColor} ${severity.bgColor} transition-all duration-300 hover:scale-[1.01] hover:shadow-lg`}>
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${metric.bgColor}`}>
              <Icon className={`h-5 w-5 ${metric.color}`} />
            </div>
            <div>
              <span className={`text-xs font-semibold uppercase tracking-wider ${metric.color}`}>{metric.label}</span>
              <h3 className="mt-0.5 text-base font-semibold leading-tight text-foreground">{rec.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{getReasonText(rec)}</p>
            </div>
          </div>
          <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 ${severity.badgeBg}`}>
            <SeverityIcon className={`h-3.5 w-3.5 ${severity.color}`} />
            <span className={`text-xs font-medium ${severity.color}`}>{severity.label}</span>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <CitedText text={rec.description} sources={sources} />
        </p>

        <WhyBlock rec={rec} />

        {referencedSources.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
            <span className="text-xs font-medium text-muted-foreground">Источники:</span>
            {referencedSources.map(source => (
              <a
                key={`${source.index}-${source.pmid}`}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                title={source.title}
              >
                [{source.index}]
              </a>
            ))}
          </div>
        ) : null}
      </div>
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
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bgColor}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums text-foreground">{value}</span>
        {sublabel ? <span className="text-sm text-muted-foreground">{sublabel}</span> : null}
      </div>
    </div>
  )
}

function ProgressSection({ phase }: { phase: InsightsResponse["phase"] }) {
  const total = phase.total_records + phase.records_needed
  const progress = total > 0 ? Math.round((phase.total_records / total) * 100) : 0
  const info = phaseLabels[phase.mode] ?? phaseLabels.learning

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{info.label}</span>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {phase.total_records} из {total} дней
        </span>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="mt-3 text-sm text-muted-foreground">{getLocalizedPhaseMessage(phase)}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{info.qualityHint}</p>
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
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgColor}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
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
  if (sources.length === 0) return null

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Источники ({sources.length})</h2>
          <p className="text-sm text-muted-foreground">
            Научные публикации, на которые опираются персональные рекомендации.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sources.map(source => (
          <a
            key={`${source.index}-${source.pmid}`}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-background/50 px-4 py-3 transition-colors hover:bg-background"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <span>[{source.index}]</span>
                <span>PMID {source.pmid}</span>
                {source.year ? <span>{source.year}</span> : null}
              </div>
              <p className="text-sm font-medium leading-5 text-foreground">{source.title}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-sm text-primary">
              Открыть
              <ExternalLink className="h-4 w-4" />
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}

function SkeletonCard() {
  return <div className="h-40 w-full animate-pulse rounded-2xl bg-secondary" />
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

  const alertRecs = recommendations.filter(rec => rec.severity === "alert")
  const attentionRecs = recommendations.filter(rec => rec.severity === "attention")
  const goodRecs = recommendations.filter(rec => rec.severity === "good")

  if (!mounted) {
    return <div className="min-h-screen bg-background" />
  }

  if (!hasToken) {
    return <div className="p-20 text-center text-muted-foreground">Проверяем авторизацию...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
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

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        {isError ? (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
            <AlertCircle className="h-4 w-4" />
            Не удалось загрузить рекомендации. Проверьте подключение и попробуйте снова.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard
            icon={TrendingUp}
            label="Прогноз дня"
            value={insights?.predicted_mood != null ? insights.predicted_mood.toFixed(1) : "—"}
            sublabel="/10"
            color="text-primary"
            bgColor="bg-primary/10"
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

        {insights?.phase ? <ProgressSection phase={insights.phase} /> : null}
        {anomalyReport ? <AnomalyBanner report={anomalyReport} /> : null}

        {isLoading ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              Добавьте больше актуальных записей, чтобы система смогла сформировать персональные советы.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
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
      </main>
    </div>
  )
}
