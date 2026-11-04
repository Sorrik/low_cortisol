"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { UtensilsCrossed, RefreshCw } from "lucide-react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
import { getNutritionRecords, deleteNutritionRecord } from "@/lib/health-api"
import { getProfile as getOnboardingProfile } from "@/lib/onboarding-api"
import type { NutritionRecord } from "@/types/health"

const COLOR = "oklch(0.72 0.16 80)"
const KCAL_GOAL_DEFAULT = 2000

const PFC_COLORS = {
  proteins: "oklch(0.7 0.18 150)", // зелёный
  fats: "oklch(0.78 0.14 70)", // жёлтый
  carbs: "oklch(0.65 0.18 30)", // оранжевый
}

function aggregateByDay(records: NutritionRecord[], days: number) {
  const map = new Map<string, { kcal: number; proteins: number; fats: number; carbs: number }>()
  for (const r of records) {
    const day = r.date.slice(0, 10)
    const existing = map.get(day) ?? { kcal: 0, proteins: 0, fats: 0, carbs: 0 }
    map.set(day, {
      kcal: existing.kcal + r.kcal,
      proteins: existing.proteins + r.proteins,
      fats: existing.fats + r.fats,
      carbs: existing.carbs + r.carbs,
    })
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([date, agg]) => ({
      date: formatShortDay(date),
      kcal: agg.kcal,
      proteins: Math.round(agg.proteins),
      fats: Math.round(agg.fats),
      carbs: Math.round(agg.carbs),
    }))
}

export default function NutritionPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [range, setRange] = useState<7 | 30>(7)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["nutrition"],
    queryFn: getNutritionRecords,
  })
  const records: NutritionRecord[] = data ?? []

  // Профиль с calorieTargets — для персональной цели вместо хардкода 2000.
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile"],
    queryFn:  getOnboardingProfile,
    staleTime: 1000 * 60 * 5,
  })
  const kcalGoal = userProfile?.calorieTargets?.targetCalories ?? KCAL_GOAL_DEFAULT

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNutritionRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["fullStreak"] })
    },
    onError: () => toast.error("Не удалось удалить запись"),
  })

  const todayRecords = records.filter((r) => r.date.slice(0, 10) === todayDateStr)
  const todayKcal = todayRecords.reduce((s, r) => s + r.kcal, 0)
  const hasTodayRecord = todayRecords.length > 0

  function handleHeroAction() {
    setAddOpen(true)
  }
  function handleCloseDialog(open: boolean) {
    if (!open) {
      setAddOpen(false)
      queryClient.invalidateQueries({ queryKey: ["nutrition"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["fullStreak"] })
    }
  }
  function handleDelete(row: NutritionRecord) {
    deleteMutation.mutate(row.id)
  }

  const chartData = aggregateByDay(records, range)
  const trendInput = chartData.map((d) => ({ value: d.kcal }))
  const trend = computeTrend(trendInput)
  const avgKcal =
    chartData.length > 0 ? Math.round(chartData.reduce((s, d) => s + d.kcal, 0) / chartData.length) : 0
  const totalP = chartData.reduce((s, d) => s + d.proteins, 0)
  const totalF = chartData.reduce((s, d) => s + d.fats, 0)
  const totalC = chartData.reduce((s, d) => s + d.carbs, 0)
  const totalPFC = totalP + totalF + totalC
  const pPct = totalPFC > 0 ? Math.round((totalP / totalPFC) * 100) : 0
  const fPct = totalPFC > 0 ? Math.round((totalF / totalPFC) * 100) : 0
  const cPct = totalPFC > 0 ? Math.round((totalC / totalPFC) * 100) : 0

  const has30 = records.length >= 14
  const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date))

  if (isLoading) return <LoadingState />
  if (isError) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background">
        <AmbientBg color={COLOR} />
        <div className="text-center">
          <p className="mb-4 text-foreground/60">Не удалось загрузить данные питания</p>
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
          icon={UtensilsCrossed}
          title="Питание"
          color={COLOR}
          hasTodayRecord={hasTodayRecord}
          onAction={handleHeroAction}
          subtitle={
            hasTodayRecord
              ? `Сегодня: ${todayKcal} ккал · ${todayRecords.length} ${todayRecords.length === 1 ? "приём" : "приёмов"} пищи`
              : "Сегодня записи питания не добавлены"
          }
        />

        {chartData.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                label={`Среднее за ${chartData.length} дн.`}
                value={`${avgKcal}`}
                hint={`ккал · цель ${kcalGoal}`}
                accent={COLOR}
              />
              <TrendCard trend={trend.trend} percent={trend.percent} />
              <StatCard
                label="Приёмов пищи"
                value={records.length}
                hint="За всё время"
                accent="oklch(0.7 0.15 220)"
              />
            </div>

            {/* PFC balance bar */}
            {totalPFC > 0 && (
              <div className="rounded-3xl border border-edge-soft bg-surface-subtle p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Баланс БЖУ</h3>
                  <span className="text-xs text-foreground/40">За {chartData.length} дн.</span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-surface-card">
                  <div style={{ width: `${pPct}%`, backgroundColor: PFC_COLORS.proteins }} />
                  <div style={{ width: `${fPct}%`, backgroundColor: PFC_COLORS.fats }} />
                  <div style={{ width: `${cPct}%`, backgroundColor: PFC_COLORS.carbs }} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                  <PfcLegend color={PFC_COLORS.proteins} label="Белки" grams={totalP} percent={pPct} />
                  <PfcLegend color={PFC_COLORS.fats} label="Жиры" grams={totalF} percent={fPct} />
                  <PfcLegend color={PFC_COLORS.carbs} label="Углеводы" grams={totalC} percent={cPct} />
                </div>
              </div>
            )}
          </>
        )}

        <ChartCard
          title="Динамика"
          subtitle="Макронутриенты по дням, грамм"
          toolbar={<RangeToggle range={range} onChange={setRange} allow30={has30} />}
        >
          {chartData.length === 0 ? (
            <EmptyChartState icon={UtensilsCrossed} onAdd={handleHeroAction} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "var(--chart-axis)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "var(--chart-axis)", fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
                <Tooltip
                  cursor={{ fill: "var(--chart-grid)" }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ color: "var(--chart-axis)" }}
                  itemStyle={{ color: "var(--foreground)" }}
                  formatter={(v: number, name: string) => [`${v}г`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--chart-axis)" }} />
                <Bar dataKey="proteins" stackId="a" fill={PFC_COLORS.proteins} name="Белки" />
                <Bar dataKey="fats" stackId="a" fill={PFC_COLORS.fats} name="Жиры" />
                <Bar dataKey="carbs" stackId="a" fill={PFC_COLORS.carbs} name="Углеводы" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div>
          <CollapsibleHistory
            records={sortedRecords}
            isFetching={isFetching}
            emptyAction={handleHeroAction}
            renderRow={(rec) => <NutritionRow key={rec.id} record={rec} onDelete={handleDelete} />}
          />
        </div>
      </div>

      {addOpen && (
        <AddRecordDialog
          metric="food"
          open={true}
          onOpenChange={handleCloseDialog}
        />
      )}
    </div>
  )
}

function PfcLegend({
  color,
  label,
  grams,
  percent,
}: {
  color: string
  label: string
  grams: number
  percent: number
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-foreground/40">{label}</p>
        <p className="text-xs text-foreground">
          <span className="font-medium">{grams}г</span>
          <span className="ml-1 text-foreground/40">· {percent}%</span>
        </p>
      </div>
    </div>
  )
}

function NutritionRow({
  record,
  onDelete,
}: {
  record: NutritionRecord
  onDelete: (r: NutritionRecord) => void
}) {
  return (
    <div className="group flex items-center justify-between gap-3 rounded-2xl border border-edge-subtle bg-surface-subtle px-4 py-3 transition-all hover:border-edge-medium hover:bg-surface-card">
      <div className="flex min-w-0 items-center gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-edge-soft"
          style={{ backgroundColor: `color-mix(in oklch, ${COLOR} 12%, transparent)` }}
        >
          <UtensilsCrossed className="h-4 w-4" style={{ color: COLOR }} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium text-foreground">
              {record.mealName || "Приём пищи"}
            </span>
            <span className="text-xs text-foreground/40">· {formatFullDate(record.date)}</span>
            {record.date.slice(0, 10) === todayDateStr && (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-emerald-400">
                сегодня
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-medium text-foreground">{record.kcal} ккал</span>
            <span style={{ color: PFC_COLORS.proteins }}>Б {Math.round(record.proteins)}г</span>
            <span style={{ color: PFC_COLORS.fats }}>Ж {Math.round(record.fats)}г</span>
            <span style={{ color: PFC_COLORS.carbs }}>У {Math.round(record.carbs)}г</span>
            {record.notes && (
              <span className="truncate text-foreground/30 max-w-[180px]" title={record.notes}>
                · {record.notes}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
        <DeleteConfirmButton
          title="Удалить запись питания?"
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
