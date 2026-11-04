"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Brain, RefreshCw, Pencil } from "lucide-react"
import {
  Area,
  AreaChart,
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
import { getStressRecords, deleteStressRecord } from "@/lib/health-api"
import type { StressRecord } from "@/types/health"

// Цвет страницы — нейтральный амбер (стресс многогранен, не только красный).
// На графике используется градиент по уровню.
const COLOR = "oklch(0.72 0.16 80)"

function stressLabel(level: number): string {
  if (level <= 3) return "Низкий"
  if (level <= 6) return "Средний"
  return "Высокий"
}

function stressColor(level: number): string {
  if (level <= 3) return "text-emerald-400"
  if (level <= 6) return "text-amber-400"
  return "text-rose-400"
}

function stressAccent(level: number): string {
  if (level <= 3) return "oklch(0.7 0.18 150)"
  if (level <= 6) return "oklch(0.72 0.16 80)"
  return "oklch(0.65 0.22 25)"
}

function aggregateByDay(records: StressRecord[], days: number) {
  const map = new Map<string, number[]>()
  for (const r of records) {
    const day = r.date.slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(r.level)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([date, levels]) => ({
      date: formatShortDay(date),
      level: Math.round(levels.reduce((s, v) => s + v, 0) / levels.length),
    }))
}

export default function StressPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<StressRecord | null>(null)
  const [range, setRange] = useState<7 | 30>(7)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["stress"],
    queryFn: getStressRecords,
  })
  const records: StressRecord[] = data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStressRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stress"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["fullStreak"] })
    },
    onError: () => toast.error("Не удалось удалить запись"),
  })

  const todayRecords = records.filter((r) => r.date.slice(0, 10) === todayDateStr)
  const todayRecord = todayRecords.length > 0 ? todayRecords[todayRecords.length - 1] : null

  function handleHeroAction() {
    setEditRecord(todayRecord)
    setAddOpen(true)
  }
  function handleEdit(row: StressRecord) {
    setEditRecord(row)
    setAddOpen(true)
  }
  function handleCloseDialog(open: boolean) {
    if (!open) {
      setAddOpen(false)
      setEditRecord(null)
      queryClient.invalidateQueries({ queryKey: ["stress"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["fullStreak"] })
    }
  }
  function handleDelete(row: StressRecord) {
    deleteMutation.mutate(row.id)
  }

  const chartData = aggregateByDay(records, range)
  // computeTrend ожидает `value`
  const trendInput = chartData.map((d) => ({ value: d.level }))
  const trend = computeTrend(trendInput)
  const avg = chartData.length > 0 ? chartData.reduce((s, d) => s + d.level, 0) / chartData.length : 0
  const max = chartData.reduce((m, d) => Math.max(m, d.level), 0)
  const has30 = records.length >= 14
  const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date))

  if (isLoading) return <LoadingState />
  if (isError) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background">
        <AmbientBg color={COLOR} />
        <div className="text-center">
          <p className="mb-4 text-foreground/60">Не удалось загрузить данные стресса</p>
          <Button onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Повторить
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-background">
      <AmbientBg color={COLOR} />

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <BackToDashboard />

        <MetricHero
          icon={Brain}
          title="Стресс"
          color={COLOR}
          hasTodayRecord={Boolean(todayRecord)}
          onAction={handleHeroAction}
          subtitle={
            todayRecord
              ? `Сегодня: ${todayRecord.level}/10 — ${stressLabel(todayRecord.level)}`
              : "Запись за сегодня не добавлена"
          }
        />

        {chartData.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label={`Среднее за ${chartData.length} дн.`}
              value={`${avg.toFixed(1)}/10`}
              hint={`Цель: ≤4 · ${stressLabel(Math.round(avg))}`}
              accent={stressAccent(Math.round(avg))}
            />
            <TrendCard trend={trend.trend} percent={trend.percent} inverted />
            <StatCard
              label="Максимум"
              value={`${max}/10`}
              hint={stressLabel(max)}
              accent={stressAccent(max)}
            />
          </div>
        )}

        <ChartCard
          title="Динамика"
          subtitle="Средний уровень по дням"
          toolbar={<RangeToggle range={range} onChange={setRange} allow30={has30} />}
        >
          {chartData.length === 0 ? (
            <EmptyChartState icon={Brain} onAdd={handleHeroAction} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="stressGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.65 0.22 25)" stopOpacity={0.45} />
                    <stop offset="50%" stopColor="oklch(0.72 0.16 80)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="oklch(0.7 0.18 150)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "var(--chart-axis)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 10]} ticks={[0, 4, 7, 10]} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} tickLine={false} axisLine={false} width={25} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ color: "var(--chart-axis)" }}
                  itemStyle={{ color: "var(--foreground)" }}
                  formatter={(v: number) => [`${v}/10 — ${stressLabel(v)}`, "Стресс"]}
                />
                <Area type="monotone" dataKey="level" stroke="oklch(0.72 0.16 80)" strokeWidth={2.5} fill="url(#stressGradient)" dot={{ r: 4, fill: "oklch(0.72 0.16 80)", strokeWidth: 0 }} activeDot={{ r: 6 }} name="Стресс" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div>
          <CollapsibleHistory
            records={sortedRecords}
            isFetching={isFetching}
            emptyAction={handleHeroAction}
            renderRow={(rec) => (
              <StressRow key={rec.id} record={rec} onEdit={handleEdit} onDelete={handleDelete} />
            )}
          />
        </div>
      </div>

      {addOpen && (
        <AddRecordDialog
          metric="stress"
          open={true}
          onOpenChange={handleCloseDialog}
          mode={editRecord ? "edit" : "add"}
          recordId={editRecord?.id}
          recordDate={editRecord?.date.slice(0, 10)}
          defaultValues={editRecord ? { level: editRecord.level, notes: editRecord.notes ?? "" } : undefined}
        />
      )}
    </div>
  )
}

function StressRow({
  record,
  onEdit,
  onDelete,
}: {
  record: StressRecord
  onEdit: (r: StressRecord) => void
  onDelete: (r: StressRecord) => void
}) {
  const accent = stressAccent(record.level)
  return (
    <div className="group flex items-center justify-between gap-3 rounded-2xl border border-edge-subtle bg-surface-subtle px-4 py-3 transition-all hover:border-edge-medium hover:bg-surface-card">
      <div className="flex min-w-0 items-center gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-edge-soft"
          style={{ backgroundColor: `color-mix(in oklch, ${accent} 14%, transparent)` }}
        >
          <Brain className="h-4 w-4" style={{ color: accent }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium capitalize text-foreground">{formatFullDate(record.date)}</span>
            {record.date.slice(0, 10) === todayDateStr && (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-emerald-400">
                сегодня
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs">
            <span className={stressColor(record.level)}>
              <span className="font-medium">{record.level}/10</span> · {stressLabel(record.level)}
            </span>
            {record.notes && (
              <span className="truncate text-foreground/30 max-w-[240px]" title={record.notes}>
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
          title="Удалить запись стресса?"
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
