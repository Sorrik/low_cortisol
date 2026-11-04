"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ArrowLeft,
  ChevronDown,
  Minus,
  Plus,
  Pencil,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"

// ── Ambient background, окрашенный под цвет метрики ─────────────────
export function AmbientBg({ color = "oklch(0.65 0.18 260)" }: { color?: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full opacity-[0.04] blur-3xl"
        style={{ backgroundColor: color }}
      />
      <div
        className="absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full opacity-[0.03] blur-3xl"
        style={{ backgroundColor: color }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  )
}

// ── Back link к дашборду ────────────────────────────────────────────
export function BackToDashboard() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-2 text-sm text-foreground/40 transition-colors hover:text-foreground/70"
    >
      <ArrowLeft className="h-4 w-4" />
      К дашборду
    </Link>
  )
}

// ── Hero-карточка с иконкой, заголовком и кнопкой действия ──────────
export function MetricHero({
  icon: Icon,
  title,
  subtitle,
  color,
  hasTodayRecord,
  onAction,
}: {
  icon: LucideIcon
  title: string
  subtitle: ReactNode
  color: string
  hasTodayRecord: boolean
  onAction: () => void
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-edge-soft bg-gradient-to-br from-surface-strong to-transparent p-6 sm:p-8 shadow-hero-elevated animate-fade-in-up">
      <div
        className="absolute -right-20 -top-20 h-60 w-60 rounded-full opacity-[0.12] blur-3xl"
        style={{ backgroundColor: color }}
      />
      <div
        className="absolute left-0 right-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-edge-medium"
            style={{ backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)` }}
          >
            <Icon className="h-7 w-7" style={{ color }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-foreground/40">{subtitle}</p>
          </div>
        </div>
        <Button
          onClick={onAction}
          className="gap-2 rounded-2xl px-5 py-6 font-medium text-white"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklch, ${color} 90%, white), ${color})`,
          }}
        >
          {hasTodayRecord ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {hasTodayRecord ? "Изменить сегодня" : "Добавить запись"}
        </Button>
      </div>
    </div>
  )
}

// ── Stat-карточка (число + лейбл + хинт) ────────────────────────────
export function StatCard({
  label,
  value,
  hint,
  accent,
  icon: Icon,
}: {
  label: string
  value: ReactNode
  hint?: string
  accent?: string
  icon?: LucideIcon
}) {
  return (
    <div className="rounded-3xl border border-edge-soft bg-surface-subtle p-4 shadow-card-elevated">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground/40">{label}</p>
        {Icon && <Icon className="h-3.5 w-3.5 text-foreground/30" />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className="text-2xl font-semibold tabular-nums"
          style={{ color: accent ?? "var(--foreground)" }}
        >
          {value}
        </span>
      </div>
      {hint && <p className="mt-1 text-[10px] text-foreground/30">{hint}</p>}
    </div>
  )
}

// ── Тренд (для стресса можно invert=true: вниз=хорошо) ──────────────
export function TrendCard({
  trend,
  percent,
  inverted = false,
}: {
  trend: "up" | "down" | "stable"
  percent: number
  inverted?: boolean
}) {
  const goodIsUp = !inverted
  const isGood =
    trend === "stable"
      ? null
      : goodIsUp
        ? trend === "up"
        : trend === "down"

  const config = {
    up: {
      Icon: TrendingUp,
      color: isGood === null ? "text-foreground/40" : isGood ? "text-emerald-400" : "text-rose-400",
      label: `+${percent}%`,
      hint: inverted ? "Растёт — плохо" : "Растёт",
    },
    down: {
      Icon: TrendingDown,
      color: isGood === null ? "text-foreground/40" : isGood ? "text-emerald-400" : "text-rose-400",
      label: `-${percent}%`,
      hint: inverted ? "Падает — хорошо" : "Падает",
    },
    stable: {
      Icon: Minus,
      color: "text-foreground/40",
      label: "Стабильно",
      hint: "Без изменений",
    },
  }[trend]

  const { Icon } = config
  return (
    <div className="rounded-3xl border border-edge-soft bg-surface-subtle p-4 shadow-card-elevated">
      <p className="text-xs font-medium text-foreground/40">Тренд</p>
      <div className="mt-2 flex items-baseline gap-2">
        <Icon className={`h-5 w-5 ${config.color}`} />
        <span className={`text-2xl font-semibold tabular-nums ${config.color}`}>{config.label}</span>
      </div>
      <p className="mt-1 text-[10px] text-foreground/30">{config.hint}</p>
    </div>
  )
}

// ── Переключатель 7д / 30д ──────────────────────────────────────────
export function RangeToggle({
  range,
  onChange,
  allow30,
}: {
  range: 7 | 30
  onChange: (r: 7 | 30) => void
  allow30: boolean
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface-card p-1">
      <button
        onClick={() => onChange(7)}
        className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
          range === 7 ? "bg-surface-hover text-foreground" : "text-foreground/40 hover:text-foreground/70"
        }`}
      >
        7 дней
      </button>
      <button
        onClick={() => allow30 && onChange(30)}
        disabled={!allow30}
        className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
          range === 30
            ? "bg-surface-hover text-foreground"
            : allow30
              ? "text-foreground/40 hover:text-foreground/70"
              : "cursor-not-allowed text-foreground/20"
        }`}
      >
        30 дней
      </button>
    </div>
  )
}

// ── Карточка-обёртка для графика ────────────────────────────────────
export function ChartCard({
  title,
  subtitle,
  toolbar,
  children,
}: {
  title: string
  subtitle?: string
  toolbar?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-edge-soft bg-surface-subtle p-5 sm:p-6 shadow-card-elevated">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-foreground/40">{subtitle}</p>}
        </div>
        {toolbar}
      </div>
      <div className="h-72">{children}</div>
    </div>
  )
}

// ── Empty state для графика ─────────────────────────────────────────
export function EmptyChartState({
  icon: Icon,
  text = "Нет данных за выбранный период",
  onAdd,
}: {
  icon: LucideIcon
  text?: string
  onAdd?: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <Icon className="h-8 w-8 text-foreground/20" />
      <p className="text-sm text-foreground/40">{text}</p>
      {onAdd && (
        <button
          onClick={onAdd}
          className="text-xs font-medium text-cyan-400 transition-colors hover:text-cyan-300"
        >
          Добавить первую запись →
        </button>
      )}
    </div>
  )
}

// ── Свёрнутая история с превью первых N и кнопкой «Показать все» ───
export function CollapsibleHistory<T extends { id: string }>({
  records,
  preview = 3,
  renderRow,
  totalLabel,
  emptyAction,
  emptyText = "Пока нет записей",
  isFetching,
}: {
  records: T[]
  preview?: number
  renderRow: (record: T) => ReactNode
  totalLabel?: string
  emptyAction?: () => void
  emptyText?: string
  isFetching?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? records : records.slice(0, preview)

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-edge-strong py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-subtle">
          <Sparkles className="h-6 w-6 text-foreground/20" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground/60">{emptyText}</p>
          <p className="mt-1 text-xs text-foreground/30">Добавьте первую запись, чтобы увидеть прогресс</p>
        </div>
        {emptyAction && (
          <Button
            onClick={emptyAction}
            variant="outline"
            size="sm"
            className="mt-2 gap-2 rounded-xl border-edge-medium bg-surface-subtle hover:bg-surface-card"
          >
            <Plus className="h-4 w-4" />
            Добавить запись
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-base font-semibold text-foreground">История</h2>
        <span className="rounded-full bg-surface-strong px-2 py-0.5 text-xs font-medium text-foreground/40">
          {totalLabel ?? records.length}
        </span>
        {isFetching && <RefreshCw className="ml-1 h-3 w-3 animate-spin text-foreground/30" />}
      </div>
      <div className="space-y-2">{visible.map((r) => renderRow(r))}</div>
      {records.length > preview && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-edge-soft bg-surface-subtle py-3 text-xs font-medium text-foreground/50 transition-all hover:border-edge-strong hover:bg-surface-card hover:text-foreground/80"
        >
          {expanded ? "Свернуть" : `Показать все записи (${records.length})`}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </>
  )
}

// ── Кнопка удаления записи с подтверждением через AlertDialog ──────
export function DeleteConfirmButton({
  onConfirm,
  title = "Удалить запись?",
  description = "Это действие нельзя отменить.",
}: {
  onConfirm: () => void
  title?: string
  description?: string
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          aria-label="Удалить"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/40 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Удалить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Утилиты ─────────────────────────────────────────────────────────
export function computeTrend(
  daily: { value: number }[],
): { trend: "up" | "down" | "stable"; percent: number } {
  if (daily.length < 2) return { trend: "stable", percent: 0 }
  const half = Math.max(1, Math.floor(daily.length / 2))
  const recent = daily.slice(-half)
  const older = daily.slice(0, -half)
  if (older.length === 0) return { trend: "stable", percent: 0 }
  const recentAvg = recent.reduce((s, d) => s + d.value, 0) / recent.length
  const olderAvg = older.reduce((s, d) => s + d.value, 0) / older.length
  if (olderAvg === 0) return { trend: "stable", percent: 0 }
  const change = ((recentAvg - olderAvg) / olderAvg) * 100
  if (Math.abs(change) < 3) return { trend: "stable", percent: 0 }
  return { trend: change > 0 ? "up" : "down", percent: Math.abs(Math.round(change)) }
}

export function formatFullDate(date: string): string {
  return new Date(date.slice(0, 10) + "T00:00:00").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function formatShortDay(date: string): string {
  return new Date(date.slice(0, 10) + "T00:00:00").toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
  })
}

export const todayDateStr = new Date().toISOString().split("T")[0]

// Общие стили для recharts tooltip — используют CSS-переменные, чтобы
// автоматически переключаться между светлой и тёмной темой.
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: "var(--chart-tooltip-bg)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: "12px",
  backdropFilter: "blur(12px)",
  fontSize: 12,
}

// Цвета для recharts grid/axis/labels через CSS-переменные.
export const CHART_GRID = "var(--chart-grid)"
export const CHART_AXIS = "var(--chart-axis)"
