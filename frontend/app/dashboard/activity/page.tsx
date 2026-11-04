"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Flame,
  RefreshCw,
  Pencil,
  Footprints,
  Bike,
  Dumbbell,
  Activity as ActivityIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { Button } from "@/components/ui/button"
import { AddRecordDialog } from "@/components/dashboard/add-record-dialog"
import {
  AmbientBg,
  BackToDashboard,
  ChartCard,
  CollapsibleHistory,
  DeleteConfirmButton,
  EmptyChartState,
  MetricHero,
  RangeToggle,
  StatCard,
  TrendCard,
  CHART_TOOLTIP_STYLE,
  computeTrend,
  formatFullDate,
  formatShortDay,
  todayDateStr,
} from "@/components/dashboard/metric-page-shell"
import { getActivityRecords, deleteActivityRecord } from "@/lib/health-api"
import type { ActivityRecord } from "@/types/health"

const COLOR = "oklch(0.72 0.2 40)"

const TYPE_LABELS: Record<ActivityRecord["type"], string> = {
  walk: "Ходьба",
  run: "Бег",
  yoga: "Йога",
  gym: "Зал",
  sport: "Спорт",
  other: "Другое",
}

const TYPE_ICONS: Record<ActivityRecord["type"], LucideIcon> = {
  walk: Footprints,
  run: Footprints,
  yoga: ActivityIcon,
  gym: Dumbbell,
  sport: Bike,
  other: Flame,
}

const INTENSITY_LABELS: Record<NonNullable<ActivityRecord["intensity"]>, { label: string; color: string }> = {
  light: { label: "Лёгкая", color: "bg-emerald-500/15 text-emerald-400" },
  moderate: { label: "Средняя", color: "bg-amber-500/15 text-amber-400" },
  vigorous: { label: "Высокая", color: "bg-rose-500/15 text-rose-400" },
}

function aggregateByDay(records: ActivityRecord[], days: number) {
  const map = new Map<string, { duration: number; steps: number }>()
  for (const r of records) {
    const day = r.date.slice(0, 10)
    const existing = map.get(day) ?? { duration: 0, steps: 0 }
    map.set(day, {
      duration: existing.duration + r.duration,
      steps: existing.steps + (r.steps ?? 0),
    })
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([date, agg]) => ({
      date: formatShortDay(date),
      duration: agg.duration,
      steps: agg.steps,
    }))
}

export default function ActivityPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<ActivityRecord | null>(null)
  const [range, setRange] = useState<7 | 30>(7)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["activity"],
    queryFn: getActivityRecords,
  })
  const records: ActivityRecord[] = data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteActivityRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["fullStreak"] })
    },
    onError: () => toast.error("Не удалось удалить запись"),
  })

  const todayRecords = records.filter((r) => r.date.slice(0, 10) === todayDateStr)
  const hasTodayRecord = todayRecords.length > 0

  function handleHeroAction() {
    // На странице активности hero всегда добавляет новую запись —
    // в один день может быть несколько тренировок. Редактирование — через ряд истории.
    setEditRecord(null)
    setAddOpen(true)
  }
  function handleEdit(row: ActivityRecord) {
    setEditRecord(row)
    setAddOpen(true)
  }
  function handleCloseDialog(open: boolean) {
    if (!open) {
      setAddOpen(false)
      setEditRecord(null)
      queryClient.invalidateQueries({ queryKey: ["activity"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["fullStreak"] })
    }
  }
  function handleDelete(row: ActivityRecord) {
    deleteMutation.mutate(row.id)
  }

  const chartData = aggregateByDay(records, range)
  const trendInput = chartData.map((d) => ({ value: d.duration }))
  const trend = computeTrend(trendInput)
  const totalMins = chartData.reduce((s, d) => s + d.duration, 0)
  const totalSteps = chartData.reduce((s, d) => s + d.steps, 0)
  const sessionsCount = records.filter((r) => {
    const day = r.date.slice(0, 10)
    return chartData.some((cd) => cd.date === formatShortDay(day))
  }).length
  const has30 = records.length >= 14
  const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date))

  if (isLoading) return <LoadingState />
  if (isError) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background">
        <AmbientBg color={COLOR} />
        <div className="text-center">
          <p className="mb-4 text-foreground/60">Не удалось загрузить данные активности</p>
          <Button onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Повторить
          </Button>
        </div>
      </div>
    )
  }

  const todayTotalMins = todayRecords.reduce((s, r) => s + r.duration, 0)

  return (
    <div className="relative min-h-screen bg-background">
      <AmbientBg color={COLOR} />

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <BackToDashboard />

        <MetricHero
          icon={Flame}
          title="Активность"
          color={COLOR}
          hasTodayRecord={hasTodayRecord}
          onAction={handleHeroAction}
          subtitle={
            hasTodayRecord
              ? `Сегодня: ${todayTotalMins} мин · ${todayRecords.length} ${todayRecords.length === 1 ? "тренировка" : "тренировок"}`
              : "Сегодня тренировок не было"
          }
        />

        {chartData.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label={`За ${chartData.length} дн.`}
              value={`${totalMins} мин`}
              hint={`${sessionsCount} ${sessionsCount === 1 ? "тренировка" : "тренировок"}`}
              accent={COLOR}
            />
            <TrendCard trend={trend.trend} percent={trend.percent} />
            <StatCard
              label="Всего шагов"
              value={totalSteps.toLocaleString("ru-RU")}
              hint={totalSteps > 0 ? `${Math.round(totalSteps / chartData.length).toLocaleString("ru-RU")} в день` : "Шаги не указаны"}
              accent="oklch(0.7 0.15 220)"
            />
          </div>
        )}

        <ChartCard
          title="Динамика"
          subtitle="Минуты активности по дням"
          toolbar={<RangeToggle range={range} onChange={setRange} allow30={has30} />}
        >
          {chartData.length === 0 ? (
            <EmptyChartState icon={Flame} onAdd={handleHeroAction} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="actBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLOR} stopOpacity="1" />
                    <stop offset="100%" stopColor={COLOR} stopOpacity="0.4" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "var(--chart-axis)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "var(--chart-axis)", fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
                <Tooltip
                  cursor={{ fill: "var(--chart-grid)" }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ color: "var(--chart-axis)" }}
                  itemStyle={{ color: "var(--foreground)" }}
                  formatter={(v: number) => [`${v} мин`, "Активность"]}
                />
                <Bar dataKey="duration" fill="url(#actBar)" radius={[6, 6, 0, 0]} name="Минуты" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div>
          <CollapsibleHistory
            records={sortedRecords}
            isFetching={isFetching}
            emptyAction={handleHeroAction}
            renderRow={(rec) => (
              <ActivityRow key={rec.id} record={rec} onEdit={handleEdit} onDelete={handleDelete} />
            )}
          />
        </div>
      </div>

      {addOpen && (
        <AddRecordDialog
          metric="activity"
          open={true}
          onOpenChange={handleCloseDialog}
          mode={editRecord ? "edit" : "add"}
          recordId={editRecord?.id}
          recordDate={editRecord?.date.slice(0, 10)}
          defaultValues={
            editRecord
              ? {
                  type: editRecord.type,
                  duration: editRecord.duration,
                  intensity: editRecord.intensity ?? "moderate",
                  steps: editRecord.steps ?? 0,
                  description: editRecord.notes ?? "",
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

function ActivityRow({
  record,
  onEdit,
  onDelete,
}: {
  record: ActivityRecord
  onEdit: (r: ActivityRecord) => void
  onDelete: (r: ActivityRecord) => void
}) {
  const TypeIcon = TYPE_ICONS[record.type]
  const typeLabel = TYPE_LABELS[record.type]
  const intensity = record.intensity ? INTENSITY_LABELS[record.intensity] : null

  return (
    <div className="group flex items-center justify-between gap-3 rounded-2xl border border-edge-subtle bg-surface-subtle px-4 py-3 transition-all hover:border-edge-medium hover:bg-surface-card">
      <div className="flex min-w-0 items-center gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-edge-soft"
          style={{ backgroundColor: `color-mix(in oklch, ${COLOR} 12%, transparent)` }}
        >
          <TypeIcon className="h-4 w-4" style={{ color: COLOR }} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium text-foreground">{typeLabel}</span>
            <span className="text-xs text-foreground/40">· {formatFullDate(record.date)}</span>
            {record.date.slice(0, 10) === todayDateStr && (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-emerald-400">
                сегодня
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-foreground font-medium">{record.duration} мин</span>
            {intensity && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${intensity.color}`}>
                {intensity.label}
              </span>
            )}
            {record.steps != null && record.steps > 0 && (
              <span className="text-foreground/60">
                · {record.steps.toLocaleString("ru-RU")} шагов
              </span>
            )}
            {record.notes && (
              <span className="truncate text-foreground/30 max-w-[200px]" title={record.notes}>
                · {record.notes}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
        <button onClick={() => onEdit(record)} aria-label="Редактировать" className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/40 transition-colors hover:bg-surface-strong hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <DeleteConfirmButton
          title="Удалить запись активности?"
          onConfirm={() => onDelete(record)}
        />
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="relative min-h-screen bg-background">
      <AmbientBg color={COLOR} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 h-10 w-32 animate-pulse rounded-xl bg-surface-card" />
        <div className="mb-6 h-40 animate-pulse rounded-3xl bg-surface-card" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-3xl bg-surface-card" />
          ))}
        </div>
      </div>
    </div>
  )
}
