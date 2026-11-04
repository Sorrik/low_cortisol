"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Smile, RefreshCw, Pencil } from "lucide-react"
import {
  Area,
  AreaChart,
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
import { getMoodRecords, deleteMoodRecord } from "@/lib/health-api"
import type { MoodRecord } from "@/types/health"

const COLOR = "oklch(0.7 0.18 150)"

function moodEmoji(v: number): string {
  if (v <= 2) return "😞"
  if (v <= 4) return "😕"
  if (v <= 6) return "😐"
  if (v <= 8) return "😊"
  return "😄"
}

function moodLabel(v: number): string {
  if (v <= 2) return "Плохо"
  if (v <= 4) return "Так себе"
  if (v <= 6) return "Нейтрально"
  if (v <= 8) return "Хорошо"
  return "Отлично"
}

function moodColor(v: number): string {
  if (v <= 3) return "text-rose-400"
  if (v <= 6) return "text-amber-400"
  return "text-emerald-400"
}

// Бэк хранит 1-10, форма принимает 1-5 → конвертация при редактировании
function valueToFormScale(v: number): number {
  return Math.max(1, Math.min(5, Math.round(v / 2)))
}

function aggregateByDay(records: MoodRecord[], days: number) {
  const map = new Map<string, number[]>()
  for (const r of records) {
    const day = r.date.slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(r.value)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([date, values]) => ({
      date: formatShortDay(date),
      value: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
    }))
}

export default function MoodPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<MoodRecord | null>(null)
  const [range, setRange] = useState<7 | 30>(7)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["mood"],
    queryFn: getMoodRecords,
  })
  const records: MoodRecord[] = data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMoodRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mood"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["fullStreak"] })
    },
    onError: () => toast.error("Не удалось удалить запись"),
  })

  // За сегодня может быть несколько записей — берём последнюю
  const todayRecords = records.filter((r) => r.date.slice(0, 10) === todayDateStr)
  const todayRecord = todayRecords.length > 0 ? todayRecords[todayRecords.length - 1] : null

  function handleHeroAction() {
    setEditRecord(todayRecord)
    setAddOpen(true)
  }
  function handleEdit(row: MoodRecord) {
    setEditRecord(row)
    setAddOpen(true)
  }
  function handleCloseDialog(open: boolean) {
    if (!open) {
      setAddOpen(false)
      setEditRecord(null)
      queryClient.invalidateQueries({ queryKey: ["mood"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["fullStreak"] })
    }
  }
  function handleDelete(row: MoodRecord) {
    deleteMutation.mutate(row.id)
  }

  const chartData = aggregateByDay(records, range)
  const trend = computeTrend(chartData)
  const avg = chartData.length > 0 ? chartData.reduce((s, d) => s + d.value, 0) / chartData.length : 0
  const best = chartData.reduce((m, d) => Math.max(m, d.value), 0)
  const has30 = records.length >= 14
  const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date))

  if (isLoading) return <LoadingState />
  if (isError) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background">
        <AmbientBg color={COLOR} />
        <div className="text-center">
          <p className="mb-4 text-foreground/60">Не удалось загрузить данные настроения</p>
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
          icon={Smile}
          title="Настроение"
          color={COLOR}
          hasTodayRecord={Boolean(todayRecord)}
          onAction={handleHeroAction}
          subtitle={
            todayRecord ? (
              <span className="flex items-center gap-2">
                <span className="text-base">{moodEmoji(todayRecord.value)}</span>
                Сегодня: {todayRecord.value}/10 — {moodLabel(todayRecord.value)}
              </span>
            ) : (
              "Как ты себя чувствуешь сегодня?"
            )
          }
        />

        {chartData.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label={`Среднее за ${chartData.length} дн.`}
              value={
                <span className="flex items-center gap-2">
                  <span className="text-xl">{moodEmoji(Math.round(avg))}</span>
                  {avg.toFixed(1)}
                </span>
              }
              hint={moodLabel(Math.round(avg))}
              accent={COLOR}
            />
            <TrendCard trend={trend.trend} percent={trend.percent} />
            <StatCard
              label="Лучший день"
              value={`${best}/10`}
              hint={moodLabel(best)}
              accent="oklch(0.75 0.15 80)"
            />
          </div>
        )}

        <ChartCard
          title="Динамика"
          subtitle="Настроение по дням"
          toolbar={<RangeToggle range={range} onChange={setRange} allow30={has30} />}
        >
          {chartData.length === 0 ? (
            <EmptyChartState icon={Smile} onAdd={handleHeroAction} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLOR} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={COLOR} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "var(--chart-axis)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 10]} ticks={[2, 4, 6, 8, 10]} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} tickLine={false} axisLine={false} width={25} />
                <ReferenceLine
                  y={7}
                  stroke="var(--chart-grid)"
                  strokeDasharray="4 4"
                  label={{ value: "норма", position: "right", fill: "var(--chart-axis)", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ color: "var(--chart-axis)" }}
                  itemStyle={{ color: "var(--foreground)" }}
                  formatter={(v: number) => [`${moodEmoji(v)} ${v}/10 — ${moodLabel(v)}`, "Настроение"]}
                />
                <Area type="monotone" dataKey="value" stroke={COLOR} strokeWidth={2.5} fill="url(#moodFill)" dot={{ r: 4, fill: COLOR, strokeWidth: 0 }} activeDot={{ r: 6 }} name="Настроение" />
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
              <MoodRow key={rec.id} record={rec} onEdit={handleEdit} onDelete={handleDelete} />
            )}
          />
        </div>
      </div>

      {addOpen && (
        <AddRecordDialog
          metric="mood"
          open={true}
          onOpenChange={handleCloseDialog}
          mode={editRecord ? "edit" : "add"}
          recordId={editRecord?.id}
          recordDate={editRecord?.date.slice(0, 10)}
          defaultValues={
            editRecord
              ? { value: valueToFormScale(editRecord.value), notes: editRecord.notes ?? "" }
              : undefined
          }
        />
      )}
    </div>
  )
}

function MoodRow({
  record,
  onEdit,
  onDelete,
}: {
  record: MoodRecord
  onEdit: (r: MoodRecord) => void
  onDelete: (r: MoodRecord) => void
}) {
  return (
    <div className="group flex items-center justify-between gap-3 rounded-2xl border border-edge-subtle bg-surface-subtle px-4 py-3 transition-all hover:border-edge-medium hover:bg-surface-card">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-edge-soft bg-surface-subtle text-xl">
          {moodEmoji(record.value)}
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
            <span className={moodColor(record.value)}>
              <span className="font-medium">{record.value}/10</span> · {moodLabel(record.value)}
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
          title="Удалить запись настроения?"
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
