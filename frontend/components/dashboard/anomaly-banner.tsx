"use client"

import { useState } from "react"
import { ChevronDown, ShieldCheck } from "lucide-react"
import type { AnomalyMetric, AnomalyReport } from "@/types/health"
import { cn } from "@/lib/utils"

const METRIC_LABELS: Record<AnomalyMetric, string> = {
  sleep: "Сон",
  stress: "Стресс",
  mood: "Настроение",
  activity: "Активность",
  water: "Вода",
  nutrition: "Питание",
}

function getGapLabel(gapDays: number) {
  const mod10 = gapDays % 10
  const mod100 = gapDays % 100

  if (mod10 === 1 && mod100 !== 11) return "день"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня"
  return "дней"
}

type AccuracyLevel = "high" | "medium" | "low"

interface AccuracyConfig {
  level:      AccuracyLevel
  label:      string
  badgeClass: string
  iconClass:  string
  bgClass:    string
  barClass:   string
  hint:       string
}

function computeAccuracy(quality: number, gapDays: number): AccuracyConfig {
  if (quality < 50 || gapDays >= 5) {
    return {
      level:      "low",
      label:      "Низкая",
      badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      iconClass:  "bg-rose-500/12 text-rose-400",
      bgClass:    "border-rose-500/20",
      barClass:   "bg-rose-500",
      hint:       "Данных мало — рекомендации могут быть менее точными. Постарайся регулярно вести трекинг.",
    }
  }

  if (quality < 75 || gapDays >= 2) {
    return {
      level:      "medium",
      label:      "Средняя",
      badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      iconClass:  "bg-amber-500/12 text-amber-400",
      bgClass:    "border-amber-500/20",
      barClass:   "bg-amber-500",
      hint:       "Свежие пропуски в данных немного снижают надёжность прогноза.",
    }
  }

  return {
    level:      "high",
    label:      "Высокая",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    iconClass:  "bg-emerald-500/12 text-emerald-400",
    bgClass:    "border-emerald-500/20",
    barClass:   "bg-emerald-500",
    hint:       "Данные полные — прогноз построен на надёжной основе.",
  }
}

interface AnomalyBannerProps {
  report: AnomalyReport
  className?: string
}

export function AnomalyBanner({ report, className }: AnomalyBannerProps) {
  const [expanded, setExpanded] = useState(false)

  const quality = report.dataQuality
  const gapDays = report.gapDays
  const accuracy = computeAccuracy(quality, gapDays)

  // Пропуски в трекинге по конкретным метрикам — единственный
  // вид аномалий, который мы оставили в этом виджете. Метрические
  // отклонения (spike/drop/trend) показываются в карточках рекомендаций,
  // дублировать их здесь не нужно.
  const gapAnomalies = report.anomalies.filter(item => item.type === "gap")

  // Если точность высокая и нет пропусков по метрикам — виджет не нужен.
  if (accuracy.level === "high" && gapAnomalies.length === 0) {
    return null
  }

  return (
    <section className={cn("rounded-2xl border bg-card", accuracy.bgClass, className)}>
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex w-full items-center justify-between gap-4 rounded-2xl p-6 text-left transition-colors hover:bg-surface-hover/40"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", accuracy.iconClass)}>
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">Точность прогноза</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{accuracy.hint}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              accuracy.badgeClass,
            )}
          >
            {accuracy.label}
          </span>
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-border/60 px-6 py-5">
          <div className="rounded-xl border border-border/70 bg-background/60 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Полнота данных</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  За последние 7 дней
                </p>
              </div>
              <span className="text-sm font-semibold text-foreground">{quality}%</span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full transition-all", accuracy.barClass)}
                style={{ width: `${quality}%` }}
              />
            </div>

            {gapDays >= 1 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Последняя запись была {gapDays} {getGapLabel(gapDays)} назад.
              </p>
            ) : null}
          </div>

          {gapAnomalies.length > 0 ? (
            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <p className="text-sm font-medium text-foreground">Пропуски по метрикам</p>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                {gapAnomalies.map((anomaly, index) => (
                  <li key={`${anomaly.metric}-${index}`} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                    <span>
                      <span className="font-medium text-foreground">{METRIC_LABELS[anomaly.metric]}</span>
                      {" — "}
                      {anomaly.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
