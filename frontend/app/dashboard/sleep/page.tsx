"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Moon,
  RefreshCw,
  Pencil,
} from "lucide-react"
import {
  Area,
  ComposedChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
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
import { getSleepRecords, deleteSleepRecord } from "@/lib/health-api"
import type { SleepRecord } from "@/types/health"

const COLOR = "oklch(0.65 0.18 260)"

function aggregateByDay(records: SleepRecord[], days: number) {
  const map = new Map<string, SleepRecord[]>()
  for (const r of records) {
    const day = r.date.slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(r)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([date, recs]) => ({
      date: formatShortDay(date),
      hours: recs[recs.length - 1].hours,
      quality: Math.round(recs.reduce((s, r) => s + r.quality, 0) / recs.length),
    }))
}

export default function SleepPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<SleepRecord | null>(null)
  const [range, setRange] = useState<7 | 30>(7)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["sleep"],
    queryFn: getSleepRecords,
  })
  const records: SleepRecord[] = data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSleepRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sleep"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["fullStreak"] })
    },
    onError: () => toast.error("Не удалось удалить запись"),
  })

  const todayRecord = records.find((r) => r.date.slice(0, 10) === todayDateStr)

  function handleHeroAction() {
    setEditRecord(todayRecord ?? null)
    setAddOpen(true)
  }
  function handleEdit(row: SleepRecord) {
    setEditRecord(row)
    setAddOpen(true)
  }
  function handleCloseDialog(open: boolean) {
    if (!open) {
      setAddOpen(false)
      setEditRecord(null)
      queryClient.invalidateQueries({ queryKey: ["sleep"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["fullStreak"] })
    }
  }
  function handleDelete(row: SleepRecord) {
    deleteMutation.mutate(row.id)
  }

  const chartData = aggregateByDay(records, range)
  const trendData = chartData.map((d) => ({ value: d.hours }))
  const trend = computeTrend(trendData)
  const avg = chartData.length > 0 ? chartData.reduce((s, d) => s + d.hours, 0) / chartData.length : 0
  const best = chartData.reduce((m, d) => Math.max(m, d.hours), 0)
  const has30 = records.length >= 14
  const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date))

  if (isLoading) {
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

  if (isError) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background">
        <AmbientBg color={COLOR} />
        <div className="text-center">
          <p className="mb-4 text-foreground/60">Не удалось загрузить данные сна</p>
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
          icon={Moon}
          title="Сон"
          color={COLOR}
          hasTodayRecord={Boolean(todayRecord)}
          onAction={handleHeroAction}
          subtitle={
            todayRecord
              ? `Сегодня: ${todayRecord.hours.toFixed(1)}ч, качество ${todayRecord.quality}/10`
              : "Запись за сегодня не добавлена"
          }
        />

        {chartData.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label={`Среднее за ${chartData.length} дн.`}
              value={`${avg.toFixed(1)}ч`}
              hint="Цель: 8ч"
              accent={COLOR}
            />
            <TrendCard trend={trend.trend} percent={trend.percent} />
            <StatCard label="Лучший день" value={`${best.toFixed(1)}ч`} hint="За выбранный период" accent="oklch(0.7 0.18 150)" />
          </div>
        )}

        <ChartCard
          title="Динамика"
          subtitle="Часы сна и качество"
          toolbar={<RangeToggle range={range} onChange={setRange} allow30={has30} />}
        >
          {chartData.length === 0 ? (
            <EmptyChartState icon={Moon} onAdd={handleHeroAction} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="sleepHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLOR} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={COLOR} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "var(--chart-axis)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="hours" tick={{ fill: "var(--chart-axis)", fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 12]} width={30} />
                <YAxis yAxisId="quality" orientation="right" hide domain={[0, 10]} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ color: "var(--chart-axis)" }}
                  itemStyle={{ color: "var(--foreground)" }}
                  formatter={(value: number, name: string) =>
                    name === "Часы" ? [`${value}ч`, name] : [`${value}/10`, name]
                  }
                />
                <Area yAxisId="hours" type="monotone" dataKey="hours" stroke={COLOR} strokeWidth={2.5} fill="url(#sleepHours)" name="Часы" />
                <Line yAxisId="quality" type="monotone" dataKey="quality" stroke="oklch(0.75 0.15 80)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3, fill: "oklch(0.75 0.15 80)" }} name="Качество" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div>
          <CollapsibleHistory
            records={sortedRecords}
            isFetching={isFetching}
            emptyAction={handleHeroAction}
            renderRow={(rec) => (
              <SleepRow key={rec.id} record={rec} onEdit={handleEdit} onDelete={handleDelete} />
            )}
          />
        </div>
      </div>

      {addOpen && (
        <AddRecordDialog
          metric="sleep"
          open={true}
          onOpenChange={handleCloseDialog}
          mode={editRecord ? "edit" : "add"}
          recordId={editRecord?.id}
          recordDate={editRecord?.date.slice(0, 10)}
          defaultValues={
            editRecord
              ? {
                  bedTime: editRecord.bedTime ?? "23:00",
                  wakeTime: editRecord.wakeTime ?? "07:00",
                  quality: editRecord.quality,
                  interruptions: editRecord.interruptions ?? 0,
                  notes: editRecord.notes ?? "",
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

function SleepRow({
  record,
  onEdit,
  onDelete,
}: {
  record: SleepRecord
  onEdit: (r: SleepRecord) => void
  onDelete: (r: SleepRecord) => void
}) {
  const qualityColor =
    record.quality >= 8 ? "text-emerald-400" : record.quality >= 5 ? "text-amber-400" : "text-rose-400"

  return (
    <div className="group flex items-center justify-between gap-3 rounded-2xl border border-edge-subtle bg-surface-subtle px-4 py-3 transition-all hover:border-edge-medium hover:bg-surface-card">
      <div className="flex min-w-0 items-center gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-edge-soft"
          style={{ backgroundColor: `color-mix(in oklch, ${COLOR} 12%, transparent)` }}
        >
          <Moon className="h-4 w-4" style={{ color: COLOR }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium capitalize text-foreground">
              {formatFullDate(record.date)}
            </span>
            {record.date.slice(0, 10) === todayDateStr && (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-emerald-400">
                сегодня
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs">
            <span className="text-foreground/60">
              <span className="font-medium text-foreground">{record.hours.toFixed(1)}ч</span> сна
            </span>
            <span className={qualityColor}>
              <span className="font-medium">{record.quality}/10</span> качество
            </span>
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
          title="Удалить запись сна?"
          onConfirm={() => onDelete(record)}
        />
      </div>
    </div>
  )
}
