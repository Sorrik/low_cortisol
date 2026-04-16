"use client"

// frontend/components/dashboard/anomaly-banner.tsx
//
// Показывает:
// 1. Алерт если есть критические аномалии
// 2. Предупреждение о пропуске данных
// 3. Плашку качества данных (если < 60%)

import { AlertTriangle, AlertCircle, Clock, TrendingDown, Zap, Droplets } from "lucide-react"
import type { AnomalyReport, Anomaly, AnomalyMetric } from "@/types/health"
import { cn } from "@/lib/utils"

// ── Иконки по метрике ─────────────────────────────────────────

const METRIC_ICONS: Record<AnomalyMetric, React.ComponentType<{ className?: string }>> = {
  sleep:     ({ className }) => <span className={className}>🌙</span>,
  stress:    ({ className }) => <span className={className}>🧠</span>,
  mood:      ({ className }) => <span className={className}>😔</span>,
  activity:  ({ className }) => <span className={className}>🏃</span>,
  water:     ({ className }) => <span className={className}>💧</span>,
  nutrition: ({ className }) => <span className={className}>🥗</span>,
}

const METRIC_LABELS: Record<AnomalyMetric, string> = {
  sleep:     'Сон',
  stress:    'Стресс',
  mood:      'Настроение',
  activity:  'Активность',
  water:     'Вода',
  nutrition: 'Питание',
}

// ── Карточка одной аномалии ───────────────────────────────────

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const Icon      = METRIC_ICONS[anomaly.metric] ?? AlertCircle
  const isCrit    = anomaly.severity === 'critical'
  const isGap     = anomaly.type === 'gap'
  const isTrend   = anomaly.type === 'trend'

  return (
    <div className={cn(
      "flex items-start gap-3 rounded-lg px-4 py-3 border",
      isCrit
        ? "bg-rose-500/8 border-rose-500/20"
        : "bg-amber-500/8 border-amber-500/20"
    )}>
      <div className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md mt-0.5",
        isCrit ? "bg-rose-500/15" : "bg-amber-500/15"
      )}>
        {isGap
          ? <Clock className={cn("h-4 w-4", isCrit ? "text-rose-400" : "text-amber-400")} />
          : isTrend
            ? <TrendingDown className={cn("h-4 w-4", isCrit ? "text-rose-400" : "text-amber-400")} />
            : <Icon className="text-lg leading-none" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            isCrit ? "text-rose-400" : "text-amber-400"
          )}>
            {isGap ? "Пропуск данных" : METRIC_LABELS[anomaly.metric]}
          </span>
          {anomaly.type !== 'gap' && (
            <span className={cn(
              "text-[10px] rounded-full px-1.5 py-0.5",
              isCrit ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"
            )}>
              {anomaly.type === 'spike' ? 'выброс ↑'
                : anomaly.type === 'drop' ? 'падение ↓'
                : 'тренд ↓'}
            </span>
          )}
        </div>
        <p className="text-sm text-foreground leading-snug">{anomaly.message}</p>
        {anomaly.value != null && anomaly.norm != null && anomaly.type !== 'gap' && (
          <p className="text-xs text-muted-foreground mt-1">
            Значение: <span className="font-medium">{anomaly.value}</span>
            {" · "}
            Ваша норма: <span className="font-medium">{anomaly.norm}</span>
            {anomaly.deviation != null && ` · Отклонение: ${anomaly.deviation}%`}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Data quality bar ──────────────────────────────────────────

function DataQualityBar({ quality, gapDays }: { quality: number; gapDays: number }) {
  if (quality >= 60 && gapDays < 2) return null

  const color = quality >= 60 ? "bg-amber-500" : quality >= 30 ? "bg-orange-500" : "bg-rose-500"
  const label = quality >= 60
    ? "Данных достаточно"
    : quality >= 30
      ? "Мало данных — прогноз менее точный"
      : "Критически мало данных"

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{quality}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${quality}%` }}
        />
      </div>
      {gapDays >= 2 && (
        <p className="text-xs text-muted-foreground">
          Последние данные: {gapDays} {gapDays === 1 ? "день" : gapDays < 5 ? "дня" : "дней"} назад
        </p>
      )}
    </div>
  )
}

// ── Главный компонент ─────────────────────────────────────────

interface AnomalyBannerProps {
  report: AnomalyReport
  className?: string
}

export function AnomalyBanner({ report, className }: AnomalyBannerProps) {
  // Ничего не показываем если всё хорошо
  if (!report.hasAnomalies && report.dataQuality >= 60 && report.gapDays < 2) {
    return null
  }

  const criticals = report.anomalies.filter(a => a.severity === 'critical')
  const warnings  = report.anomalies.filter(a => a.severity === 'warning')

  // Показываем максимум 3 аномалии чтобы не перегружать
  const shown = [
    ...criticals.slice(0, 2),
    ...warnings.slice(0, Math.max(0, 3 - criticals.length)),
  ]

  return (
    <div className={cn("flex flex-col gap-3", className)}>

      {/* Заголовок если есть аномалии */}
      {report.hasAnomalies && (
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn(
            "h-4 w-4",
            report.hasCritical ? "text-rose-400" : "text-amber-400"
          )} />
          <span className="text-sm font-semibold text-foreground">
            {report.hasCritical
              ? "Обнаружены критические отклонения"
              : "Обнаружены отклонения от нормы"}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {report.anomalies.length} {report.anomalies.length === 1 ? "аномалия" : "аномалии"}
          </span>
        </div>
      )}

      {/* Карточки аномалий */}
      {shown.map((anomaly, i) => (
        <AnomalyCard key={`${anomaly.metric}-${anomaly.type}-${i}`} anomaly={anomaly} />
      ))}

      {/* Если аномалий больше 3 */}
      {report.anomalies.length > 3 && (
        <p className="text-xs text-muted-foreground text-center">
          + ещё {report.anomalies.length - 3} отклонения
        </p>
      )}

      {/* Качество данных */}
      <DataQualityBar quality={report.dataQuality} gapDays={report.gapDays} />

    </div>
  )
}