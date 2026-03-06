"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { UtensilsCrossed, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricPageHeader } from "@/components/dashboard/metric-page-header"
import { HistoryTable } from "@/components/dashboard/history-table"
import { AddRecordDialog } from "@/components/dashboard/add-record-dialog"
import { getNutritionRecords, deleteNutritionRecord } from "@/lib/health-api"
import type { NutritionRecord } from "@/types/health"

const COLOR = "oklch(0.75 0.15 55)"

function formatDay(date: string) {
  return new Date(date).toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
  })
}

// Суммирует все приёмы пищи за каждый день
function aggregateByDay(records: NutritionRecord[]) {
  const map = new Map<string, { kcal: number; proteins: number; fats: number; carbs: number }>()

  for (const r of records) {
    const day = r.date.slice(0, 10)
    const existing = map.get(day) ?? { kcal: 0, proteins: 0, fats: 0, carbs: 0 }
    map.set(day, {
      kcal:     existing.kcal     + r.kcal,
      proteins: existing.proteins + r.proteins,
      fats:     existing.fats     + r.fats,
      carbs:    existing.carbs    + r.carbs,
    })
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, agg]) => ({
      date:     formatDay(date),
      kcal:     agg.kcal,
      proteins: Math.round(agg.proteins),
      fats:     Math.round(agg.fats),
      carbs:    Math.round(agg.carbs),
    }))
}

export default function NutritionPage() {
  const [addOpen, setAddOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["nutrition"],
    queryFn:  getNutritionRecords,
  })

  const records: NutritionRecord[] = data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNutritionRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition"] })
    },
    onError: () => {
      alert("Не удалось удалить запись")
    },
  })

  async function handleDelete(row: NutritionRecord) {
    if (!confirm("Удалить запись питания?")) return
    deleteMutation.mutate(row.id)
  }

  // График — один столбик на день (сумма всех приёмов пищи)
  const chartData = aggregateByDay(records)

  // Среднее ккал в день из агрегированных данных
  const avgKcal = chartData.length > 0
    ? Math.round(chartData.reduce((sum, d) => sum + d.kcal, 0) / chartData.length)
    : 0

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
        <p className="text-destructive-foreground">{"Не удалось загрузить данные питания."}</p>
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
        title="Питание"
        icon={UtensilsCrossed}
        color={COLOR}
        onAdd={() => setAddOpen(true)}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Avg kcal card */}
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <span className="text-3xl font-bold text-foreground">{avgKcal}</span>
            <span className="mt-1 text-center text-sm text-muted-foreground">{"средних ккал в день"}</span>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="border-border bg-card lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {"Макронутриенты за 7 дней"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">{"Нет данных за последние 7 дней"}</p>
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
                      formatter={(value: number, name: string) => [`${value}г`, name]}
                    />
                    <Legend />
                    <Bar dataKey="proteins" stackId="a" fill="var(--color-chart-1)" name="Белки" />
                    <Bar dataKey="fats"     stackId="a" fill="var(--color-chart-2)" name="Жиры" />
                    <Bar dataKey="carbs"    stackId="a" fill="var(--color-chart-4)" name="Углеводы" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* История — сырые записи (каждый приём пищи отдельно) */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">{"История"}</h2>
        <HistoryTable
          columns={[
            {
              key: "mealName",
              label: "Блюдо",
              render: (v) => (v as string) || "—",
            },
            {
              key: "kcal",
              label: "Ккал",
            },
            {
              key: "proteins",
              label: "Белки",
              render: (v) => `${v}г`,
            },
            {
              key: "fats",
              label: "Жиры",
              render: (v) => `${v}г`,
            },
            {
              key: "carbs",
              label: "Углеводы",
              render: (v) => `${v}г`,
            },
          ]}
          data={records}
          onEdit={() => {}}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      </div>

      <AddRecordDialog
        metric="food"
        open={addOpen}
        onOpenChange={(open) => setAddOpen(open)}
      />
    </div>
  )
}