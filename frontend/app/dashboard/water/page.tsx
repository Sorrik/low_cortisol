"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Droplets, RefreshCw, Pencil } from "lucide-react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
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
import { getWaterRecords, deleteWaterRecord } from "@/lib/health-api"
import type { WaterRecord } from "@/types/health"

const COLOR = "oklch(0.7 0.15 220)"
const GOAL = 8

function aggregateByDay(records: WaterRecord[], days: number) {
  const map = new Map<string, number>()
  for (const r of records) {
    const day = r.date.slice(0, 10)
    map.set(day, (map.get(day) ?? 0) + r.glasses)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([date, glasses]) => ({
      date: formatShortDay(date),
      glasses,
    }))
}

export default function WaterPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<WaterRecord | null>(null)
  const [range, setRange] = useState<7 | 30>(7)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["water"],
    queryFn: getWaterRecords,
  })
  const records: WaterRecord[] = data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWaterRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["water"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["fullStreak"] })
    },
    onError: () => toast.error("Не удалось удалить запись"),
  })

  const todayRecords = records.filter((r) => r.date.slice(0, 10) === todayDateStr)
  const todayGlasses = todayRecords.reduce((s, r) => s + r.glasses, 0)
  const hasTodayRecord = todayRecords.length > 0

  function handleHeroAction() {
    // Hero на странице воды всегда добавляет — в день можно делать много записей
    setEditRecord(null)
    setAddOpen(true)
  }
  function handleEdit(row: WaterRecord) {
    setEditRecord(row)
    setAddOpen(true)
  }
  function handleCloseDialog(open: boolean) {
    if (!open) {
      setAddOpen(false)
      setEditRecord(null)
      queryClient.invalidateQueries({ queryKey: ["water"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["fullStreak"] })
    }
  }
  function handleDelete(row: WaterRecord) {
    deleteMutation.mutate(row.id)
  }

  const chartData = aggregateByDay(records, range)
  const trendInput = chartData.map((d) => ({ value: d.glasses }))
  const trend = computeTrend(trendInput)
  const avg = chartData.length > 0 ? chartData.reduce((s, d) => s + d.glasses, 0) / chartData.length : 0
  const goalsMet = chartData.filter((d) => d.glasses >= GOAL).length
  const has30 = records.length >= 14
  const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date))

  if (isLoading) return <LoadingState />
  if (isError) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background">
        <AmbientBg color={COLOR} />
        <div className="text-center">
          <p className="mb-4 text-foreground/60">Не удалось загрузить данные воды</p>
          <Button onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Повторить
          </Button>
        </div>
      </div>
    )
  }

  const todayPct = Math.min(100, Math.round((todayGlasses / GOAL) * 100))

  return (
    <div className="relative min-h-screen bg-background">
      <AmbientBg color={COLOR} />

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <BackToDashboard />

        <MetricHero
          icon={Droplets}
          title="Вода"
          color={COLOR}
          hasTodayRecord={hasTodayRecord}
          onAction={handleHeroAction}
          subtitle={
            hasTodayRecord
              ? `Сегодня: ${todayGlasses}/${GOAL} стаканов · ${todayPct}% от цели`
              : "Сегодня запись не добавлена"
          }
        />

        {chartData.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label={`Среднее за ${chartData.length} дн.`}
              value={avg.toFixed(1)}
              hint={`Цель: ${GOAL} стак.`}
              accent={COLOR}
            />
            <TrendCard trend={trend.trend} percent={trend.percent} />
            <StatCard
              label="Норма выполнена"
              value={`${goalsMet}/${chartData.length}`}
              hint={`${Math.round((goalsMet / chartData.length) * 100)}% дней`}
              accent="oklch(0.7 0.18 150)"
            />
          </div>
        )}

        <ChartCard
          title="Динамика"
          subtitle="Стаканов воды по дням"
          toolbar={<RangeToggle range={range} onChange={setRange} allow30={has30} />}
        >
          {chartData.length === 0 ? (
            <EmptyChartState icon={Droplets} onAdd={handleHeroAction} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="waterBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLOR} stopOpacity="1" />
                    <stop offset="100%" stopColor={COLOR} stopOpacity="0.4" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "var(--chart-axis)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  domain={[0, Math.max(GOAL + 2, Math.ceil(avg) + 2)]}
                  tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={25}
                />
                <ReferenceLine
                  y={GOAL}
                  stroke="oklch(0.7 0.18 150)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: `цель ${GOAL}`, position: "right", fill: "oklch(0.7 0.18 150)", fontSize: 10 }}
                />
                <Tooltip
                  cursor={{ fill: "var(--chart-grid)" }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ color: "var(--chart-axis)" }}
                  itemStyle={{ color: "var(--foreground)" }}
                  formatter={(v: number) => [`${v} стак.`, "Вода"]}
                />
                <Bar dataKey="glasses" fill="url(#waterBar)" radius={[6, 6, 0, 0]} name="Стаканы" />
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
              <WaterRow key={rec.id} record={rec} onEdit={handleEdit} onDelete={handleDelete} />
            )}
          />
        </div>
      </div>

      {addOpen && (
        <AddRecordDialog
          metric="water"
          open={true}
          onOpenChange={handleCloseDialog}
          mode={editRecord ? "edit" : "add"}
          recordId={editRecord?.id}
          recordDate={editRecord?.date.slice(0, 10)}
          defaultValues={editRecord ? { glasses: editRecord.glasses } : undefined}
        />
      )}
    </div>
  )
}

function WaterRow({
  record,
  onEdit,
  onDelete,
}: {
  record: WaterRecord
  onEdit: (r: WaterRecord) => void
  onDelete: (r: WaterRecord) => void
}) {
  const goalMet = record.glasses >= GOAL
  return (
    <div className="group flex items-center justify-between gap-3 rounded-2xl border border-edge-subtle bg-surface-subtle px-4 py-3 transition-all hover:border-edge-medium hover:bg-surface-card">
      <div className="flex min-w-0 items-center gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-edge-soft"
          style={{ backgroundColor: `color-mix(in oklch, ${COLOR} 14%, transparent)` }}
        >
          <Droplets className="h-4 w-4" style={{ color: COLOR }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium capitalize text-foreground">{formatFullDate(record.date)}</span>
            {record.date.slice(0, 10) === todayDateStr && (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-emerald-400">
                сегодня
              </span>
            )}
            {goalMet && (
              <span className="rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-cyan-400">
                норма
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs">
            <span className={goalMet ? "text-cyan-400" : "text-foreground/60"}>
              <span className="font-medium">{record.glasses}</span> из {GOAL} стаканов
              {record.amountMl && <span className="ml-1 text-foreground/40">· {record.amountMl} мл</span>}
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
        <button onClick={() => onEdit(record)} aria-label="Редактировать" className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/40 transition-colors hover:bg-surface-strong hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <DeleteConfirmButton
          title="Удалить запись воды?"
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
