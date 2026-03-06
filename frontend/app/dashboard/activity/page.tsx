"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { Flame, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricPageHeader } from "@/components/dashboard/metric-page-header"
import { HistoryTable } from "@/components/dashboard/history-table"
import { AddRecordDialog } from "@/components/dashboard/add-record-dialog"
import { getActivityRecords, deleteActivityRecord } from "@/lib/health-api"
import type { ActivityRecord } from "@/types/health"

const COLOR = "oklch(0.72 0.19 30)"

const TYPE_LABELS: Record<string, string> = {
  walk:    "Ходьба",
  run:     "Бег",
  gym:     "Зал",
  yoga:    "Йога",
  sport:   "Спорт",
  other:   "Другое",
}

function formatDay(date: string) {
  return new Date(date).toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
  })
}

// Агрегация по дням: суммирует duration и steps
function aggregateByDay(records: ActivityRecord[]) {
  const map = new Map<string, { duration: number; steps: number }>()

  for (const r of records) {
    const day = r.date.slice(0, 10)
    const existing = map.get(day) ?? { duration: 0, steps: 0 }
    map.set(day, {
      duration: existing.duration + r.duration,
      steps:    existing.steps + (r.steps ?? 0),
    })
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, agg]) => ({
      date:     formatDay(date),
      duration: agg.duration,
      steps:    agg.steps,
    }))
}

export default function ActivityPage() {
  const [addOpen, setAddOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["activity"],
    queryFn:  getActivityRecords,
  })

  const records: ActivityRecord[] = data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteActivityRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity"] })
    },
    onError: () => {
      alert("Не удалось удалить запись")
    },
  })

  async function handleDelete(row: ActivityRecord) {
    if (!confirm("Удалить запись активности?")) return
    deleteMutation.mutate(row.id)
  }

  // График — агрегированный по дням
  const chartData = aggregateByDay(records)

  // Сумма за последние 7 дней (по агрегированным данным)
  const weeklyTotal = chartData.reduce((sum, d) => sum + d.duration, 0)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-secondary" />
          <div className="h-8 w-40 animate-pulse rounded-md bg-secondary" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="h-36 animate-pulse rounded-lg border border-border bg-card" />
          <div className="h-36 animate-pulse rounded-lg border border-border bg-card lg:col-span-3" />
        </div>
        <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-destructive-foreground">{"Не удалось загрузить данные активности."}</p>
        <Button onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {"Повторить"}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
      <MetricPageHeader
        title="Активность"
        icon={Flame}
        color={COLOR}
        onAdd={() => setAddOpen(true)}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Weekly total */}
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <span className="text-3xl font-bold text-foreground">{weeklyTotal}</span>
            <span className="mt-1 text-sm text-muted-foreground">{"минут за последние 7 дней"}</span>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="border-border bg-card lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {"Активность за 7 дней"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    {"Нет данных за последние 7 дней"}
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px",
                        color: "var(--color-foreground)",
                      }}
                      formatter={(value: number) => [`${value} мин`, "Активность"]}
                    />
                    <Bar
                      dataKey="duration"
                      fill={COLOR}
                      radius={[4, 4, 0, 0]}
                      name="Минуты"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* История — сырые записи, без агрегации */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">{"История"}</h2>
        <HistoryTable
          columns={[
            {
              key: "type",
              label: "Тип",
              render: (v) => TYPE_LABELS[v as string] ?? (v as string),
            },
            {
              key: "duration",
              label: "Длительность",
              render: (v) => `${v} мин`,
            },
            {
              key: "steps",
              label: "Шаги",
              render: (v) => (v ? (v as number).toLocaleString() : "—"),
            },
          ]}
          data={records}
          onEdit={() => {}}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      </div>

      <AddRecordDialog
        metric="activity"
        open={addOpen}
        onOpenChange={(open) => setAddOpen(open)}
      />
    </div>
  )
}