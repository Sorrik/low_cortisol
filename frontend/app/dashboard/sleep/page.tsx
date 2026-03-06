"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { Moon, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Bar,
  Line,
  ComposedChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MetricPageHeader } from "@/components/dashboard/metric-page-header"
import { HistoryTable }     from "@/components/dashboard/history-table"
import { AddRecordDialog }  from "@/components/dashboard/add-record-dialog"
import { getSleepRecords, deleteSleepRecord } from "@/lib/health-api"
import type { SleepRecord } from "@/types/health"

const COLOR    = "oklch(0.70 0.15 260)"
const todayStr = new Date().toISOString().split("T")[0]

function formatDay(date: string) {
  return new Date(date).toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
  })
}

function aggregateByDay(records: SleepRecord[]) {
  const map = new Map<string, SleepRecord[]>()

  for (const r of records) {
    const day = r.date.slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(r)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, recs]) => ({
      date:    formatDay(date),
      hours:   recs[recs.length - 1].hours,
      quality: Math.round(recs.reduce((s, r) => s + r.quality, 0) / recs.length),
    }))
}

export default function SleepPage() {
  const [addOpen,    setAddOpen]    = useState(false)
  const [editRecord, setEditRecord] = useState<SleepRecord | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["sleep"],
    queryFn:  getSleepRecords,
  })

  const records: SleepRecord[] = data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSleepRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sleep"] })
    },
    onError: () => {
      alert("Не удалось удалить запись")
    },
  })

  // Запись за сегодня — если есть, кнопка «Добавить» открывает редактирование
  const todayRecord = records.find((r) => r.date.slice(0, 10) === todayStr)

  function handleOpenAdd() {
    if (todayRecord) {
      setEditRecord(todayRecord)
    } else {
      setEditRecord(null)
    }
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
    }
  }

  function handleDelete(row: SleepRecord) {
    if (!confirm("Удалить запись сна?")) return
    deleteMutation.mutate(row.id)
  }

  const chartData = aggregateByDay(records)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-secondary" />
          <div className="h-8 w-32 animate-pulse rounded-md bg-secondary" />
        </div>
        <div className="space-y-4">
          <div className="h-72 animate-pulse rounded-lg border bg-card p-6" />
          <div className="h-64 animate-pulse rounded-lg border bg-card p-6" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-destructive-foreground">{"Не удалось загрузить данные сна."}</p>
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
        title="Сон"
        icon={Moon}
        color={COLOR}
        onAdd={handleOpenAdd}
      />

      <Tabs defaultValue="7days">
        <TabsList>
          <TabsTrigger value="7days">{"7 дней"}</TabsTrigger>
          <TabsTrigger value="30days" disabled={records.length < 30}>
            {"30 дней"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="7days">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {"Часы сна и качество"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {chartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      {"Нет данных за последние 7 дней"}
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                      />
                      <YAxis
                        yAxisId="hours"
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                        domain={[0, 12]}
                        label={{
                          value: "ч",
                          position: "insideTopLeft",
                          fill: "var(--color-muted-foreground)",
                          fontSize: 11,
                        }}
                      />
                      <YAxis
                        yAxisId="quality"
                        orientation="right"
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                        domain={[0, 10]}
                        label={{
                          value: "кач.",
                          position: "insideTopRight",
                          fill: "var(--color-muted-foreground)",
                          fontSize: 11,
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          color: "var(--color-foreground)",
                        }}
                        formatter={(value: number, name: string) =>
                          name === "Часы" ? [`${value}ч`, name] : [`${value}/10`, name]
                        }
                      />
                      <Bar
                        yAxisId="hours"
                        dataKey="hours"
                        fill={COLOR}
                        radius={[4, 4, 0, 0]}
                        name="Часы"
                      />
                      <Line
                        yAxisId="quality"
                        type="monotone"
                        dataKey="quality"
                        stroke="var(--color-chart-4)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Качество"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="30days">
          <Card className="border-border bg-card">
            <CardContent className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">
                {"Данные за 30 дней появятся позже"}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">{"История"}</h2>
        <HistoryTable
          columns={[
            { key: "hours",   label: "Часы",     render: (v) => `${v}ч` },
            { key: "quality", label: "Качество", render: (v) => `${v}/10` },
            { key: "notes",   label: "Заметки",  render: (v) => (v as string) || "—" },
          ]}
          data={records}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      </div>

      {addOpen && (
        <AddRecordDialog
          metric="sleep"
          open={true}
          onOpenChange={handleCloseDialog}
          mode={editRecord ? "edit" : "add"}
          recordId={editRecord?.id}
          defaultValues={editRecord ? {
            bedTime:       editRecord.bedTime       ?? "23:00",
            wakeTime:      editRecord.wakeTime      ?? "07:00",
            quality:       editRecord.quality,
            interruptions: editRecord.interruptions ?? 0,
            notes:         editRecord.notes         ?? "",
          } : undefined}
        />
      )}
    </div>
  )
}