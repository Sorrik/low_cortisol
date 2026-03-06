"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { Smile, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricPageHeader }  from "@/components/dashboard/metric-page-header"
import { HistoryTable }      from "@/components/dashboard/history-table"
import { AddRecordDialog }   from "@/components/dashboard/add-record-dialog"
import { getMoodRecords, deleteMoodRecord } from "@/lib/health-api"
import type { MoodRecord } from "@/types/health"

const COLOR = "oklch(0.75 0.14 145)"

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

function formatDay(date: string) {
  return new Date(date).toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
  })
}

function aggregateByDay(records: MoodRecord[]) {
  const map = new Map<string, number[]>()
  for (const r of records) {
    const day = r.date.slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(r.value)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, values]) => ({
      date:  formatDay(date),
      value: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
    }))
}

// Бэкенд хранит 1-10, форма использует 1-5 (MoodPicker)
// При редактировании конвертируем обратно: 10→5
function valueToFormScale(v: number): number {
  return Math.max(1, Math.min(5, Math.round(v / 2)))
}

export default function MoodPage() {
  const [addOpen,    setAddOpen]    = useState(false)
  const [editRecord, setEditRecord] = useState<MoodRecord | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["mood"],
    queryFn:  getMoodRecords,
  })

  const records: MoodRecord[] = data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMoodRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mood"] })
    },
    onError: () => {
      alert("Не удалось удалить запись")
    },
  })

  async function handleDelete(row: MoodRecord) {
    if (!confirm("Удалить запись настроения?")) return
    deleteMutation.mutate(row.id)
  }

  function handleEdit(row: MoodRecord) {
    setEditRecord(row)
    setAddOpen(true)
  }

  function handleCloseDialog(open: boolean) {
    if (!open) {
      setAddOpen(false)
      setEditRecord(null)
    }
  }

  const chartData = aggregateByDay(records)

  const avg = chartData.length > 0
    ? Math.round(chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length)
    : null

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-secondary" />
          <div className="h-8 w-40 animate-pulse rounded-md bg-secondary" />
        </div>
        <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-destructive-foreground">{"Не удалось загрузить данные настроения."}</p>
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
        title="Настроение"
        icon={Smile}
        color={COLOR}
        onAdd={() => { setEditRecord(null); setAddOpen(true) }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <span className="text-4xl">{avg ? moodEmoji(avg) : "—"}</span>
            <span className="mt-2 text-3xl font-bold text-foreground">
              {avg ? `${avg}/10` : "—"}
            </span>
            <span className="mt-1 text-sm text-muted-foreground">
              {avg ? moodLabel(avg) : "Нет данных"}
            </span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              {"среднее за 7 дней"}
            </span>
          </CardContent>
        </Card>

        <Card className="border-border bg-card lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {"Настроение за 7 дней"}
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
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                    />
                    <YAxis
                      domain={[1, 10]}
                      ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                    />
                    <ReferenceLine
                      y={7}
                      stroke="var(--color-primary)"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: "норма",
                        position: "right",
                        fill: "var(--color-primary)",
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
                      formatter={(value: number) => [
                        `${moodEmoji(value)} ${value}/10 — ${moodLabel(value)}`,
                        "Настроение",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={COLOR}
                      strokeWidth={3}
                      dot={{ r: 5, fill: COLOR }}
                      activeDot={{ r: 7 }}
                      name="Настроение"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">{"История"}</h2>
        <HistoryTable
          columns={[
            {
              key: "value",
              label: "Настроение",
              render: (v) => `${moodEmoji(v as number)} ${v}/10 — ${moodLabel(v as number)}`,
            },
            {
              key: "notes",
              label: "Заметки",
              render: (v) => (v as string) || "—",
            },
          ]}
          data={records}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      </div>

      {addOpen && (
        <AddRecordDialog
          metric="mood"
          open={true}
          onOpenChange={handleCloseDialog}
          mode={editRecord ? "edit" : "add"}
          recordId={editRecord?.id}
          defaultValues={editRecord ? {
            // конвертируем из 1-10 (БД) в 1-5 (форма)
            value: valueToFormScale(editRecord.value),
            notes: editRecord.notes ?? "",
          } : undefined}
        />
      )}
    </div>
  )
}