"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { Droplets, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricPageHeader } from "@/components/dashboard/metric-page-header"
import { HistoryTable } from "@/components/dashboard/history-table"
import { AddRecordDialog } from "@/components/dashboard/add-record-dialog"
import { getWaterRecords, deleteWaterRecord } from "@/lib/health-api"
import type { WaterRecord } from "@/types/health"

const COLOR = "oklch(0.70 0.12 230)"

function formatDay(date: string) {
  return new Date(date).toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
  })
}

// Суммирует все записи воды за день
function aggregateByDay(records: WaterRecord[]) {
  const map = new Map<string, number>()

  for (const r of records) {
    const day = r.date.slice(0, 10)
    map.set(day, (map.get(day) ?? 0) + r.glasses)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, glasses]) => ({
      date:    formatDay(date),
      glasses,
    }))
}

export default function WaterPage() {
  const [addOpen, setAddOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["water"],
    queryFn:  getWaterRecords,
  })

  const records: WaterRecord[] = data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWaterRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["water"] })
    },
    onError: () => {
      alert("Не удалось удалить запись")
    },
  })

  async function handleDelete(row: WaterRecord) {
    if (!confirm("Удалить запись воды?")) return
    deleteMutation.mutate(row.id)
  }

  // График — один столбик на день (сумма)
  const chartData = aggregateByDay(records)

  // Среднее стаканов в день из агрегированных данных
  const avgGlasses = chartData.length > 0
    ? Math.round(chartData.reduce((sum, d) => sum + d.glasses, 0) / chartData.length)
    : 0

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-secondary" />
          <div className="h-8 w-24 animate-pulse rounded-md bg-secondary" />
        </div>
        <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-destructive-foreground">{"Не удалось загрузить данные воды."}</p>
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
        title="Вода"
        icon={Droplets}
        color={COLOR}
        onAdd={() => setAddOpen(true)}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Avg card */}
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <span className="text-3xl font-bold text-foreground">{avgGlasses}</span>
            <span className="mt-1 text-center text-sm text-muted-foreground">
              {"среднее стаканов в день"}
            </span>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="border-border bg-card lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {"Потребление воды за 7 дней"}
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
                      domain={[0, Math.max(12, avgGlasses + 2)]}
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px",
                        color: "var(--color-foreground)",
                      }}
                      formatter={(value: number) => [`${value} стак.`, "Вода"]}
                    />
                    <ReferenceLine
                      y={8}
                      stroke="var(--color-primary)"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{
                        value: "Цель: 8",
                        position: "right",
                        fill: "var(--color-primary)",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="glasses"
                      fill={COLOR}
                      radius={[4, 4, 0, 0]}
                      name="Стаканы"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* История — сырые записи */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">{"История"}</h2>
        <HistoryTable
          columns={[
            {
              key: "glasses",
              label: "Стаканы",
              render: (v) => (
                <span className={(v as number) >= 8 ? "text-primary font-medium" : ""}>
                  {`${v} из 8`}
                </span>
              ),
            },
          ]}
          data={records}
          onEdit={() => {}}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      </div>

      <AddRecordDialog
        metric="water"
        open={addOpen}
        onOpenChange={(open) => setAddOpen(open)}
      />
    </div>
  )
}