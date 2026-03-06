"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { Brain, RefreshCw } from "lucide-react"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricPageHeader } from "@/components/dashboard/metric-page-header"
import { HistoryTable } from "@/components/dashboard/history-table"
import { AddRecordDialog } from "@/components/dashboard/add-record-dialog"
import { getStressRecords, deleteStressRecord } from "@/lib/health-api"
import type { StressRecord } from "@/types/health"

function formatDay(date: string) {
  return new Date(date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric" })
}

function getStressLabel(level: number) {
  if (level <= 3) return "Низкий"
  if (level <= 6) return "Средний"
  return "Высокий"
}

// Среднее значение стресса за день
function aggregateByDay(records: StressRecord[]) {
  const map = new Map<string, number[]>()

  for (const r of records) {
    const day = r.date.slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(r.level)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, levels]) => ({
      date:  formatDay(date),
      level: Math.round(levels.reduce((s, v) => s + v, 0) / levels.length),
    }))
}

export default function StressPage() {
  const [addOpen, setAddOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stress"],
    queryFn:  getStressRecords,
  })

  const records: StressRecord[] = data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStressRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stress"] })
    },
    onError: () => {
      alert("Не удалось удалить запись")
    },
  })

  async function handleDelete(row: StressRecord) {
    if (!confirm("Удалить запись?")) return
    deleteMutation.mutate(row.id)
  }

  // График — один столбик на день (среднее)
  const chartData = aggregateByDay(records)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-secondary" />
          <div className="h-8 w-32 animate-pulse rounded-md bg-secondary" />
        </div>
        <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-destructive-foreground">{"Не удалось загрузить данные стресса."}</p>
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
        title="Стресс"
        icon={Brain}
        color="oklch(0.72 0.17 145)"
        onAdd={() => setAddOpen(true)}
      />

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {"Уровень стресса за 7 дней"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">{"Нет данных за последние 7 дней"}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="stressGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.65 0.22 25)" stopOpacity={0.5} />
                      <stop offset="50%" stopColor="oklch(0.80 0.16 85)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="oklch(0.72 0.17 145)" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                      color: "var(--color-foreground)",
                    }}
                    formatter={(value: number) => [
                      `${value}/10 (${getStressLabel(value)})`,
                      "Стресс",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="level"
                    stroke="oklch(0.80 0.16 85)"
                    strokeWidth={2}
                    fill="url(#stressGradient)"
                    dot={{ r: 4, fill: "oklch(0.80 0.16 85)" }}
                    name="Стресс"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* История — сырые записи */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">{"История"}</h2>
        <HistoryTable
          columns={[
            {
              key: "level",
              label: "Уровень",
              render: (v) => `${v}/10 (${getStressLabel(v as number)})`,
            },
            {
              key: "notes",
              label: "Заметки",
              render: (v) => (v as string) || "—",
            },
          ]}
          data={records}
          onEdit={() => {}}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      </div>

      <AddRecordDialog
        metric="stress"
        open={addOpen}
        onOpenChange={(open) => setAddOpen(open)}
      />
    </div>
  )
}