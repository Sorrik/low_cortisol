"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import Link from "next/link"
import {
  Moon,
  UtensilsCrossed,
  Smile,
  Brain,
  Flame,
  Droplets,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { MetricCard } from "@/components/dashboard/metric-card"
import { StreakWidget } from "@/components/dashboard/streak-widget"
import { AddRecordDialog } from "@/components/dashboard/add-record-dialog"
import { ProfileBackfillBanner } from "@/components/dashboard/profile-backfill-banner"
import {
  getSleepRecords,
  getNutritionRecords,
  getMoodRecords,
  getStressRecords,
  getActivityRecords,
  getWaterRecords,
} from "@/lib/health-api"
import type { MetricType } from "@/types/health"

function getStressColor(level: number | undefined): string {
  if (level === undefined) return "oklch(0.72 0.16 80)"
  if (level <= 3) return "oklch(0.7 0.18 150)"
  if (level <= 6) return "oklch(0.72 0.16 80)"
  return "oklch(0.68 0.2 30)"
}

function aggregateByDay<T extends { date: string }>(
  records: T[],
  aggregate: (dayRecords: T[]) => number,
): { date: string; value: number }[] {
  const map = new Map<string, T[]>()
  for (const r of records) {
    const day = r.date.slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(r)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, recs]) => ({ date, value: aggregate(recs) }))
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  const todayStr = toLocalDateStr(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = toLocalDateStr(yesterday)
  if (dateStr === todayStr) return "Сегодня"
  if (dateStr === yesterdayStr) return "Вчера"
  return date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

export default function DashboardPage() {
  const todayStr = toLocalDateStr(new Date())
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [addMetric, setAddMetric] = useState<MetricType | null>(null)
  const queryClient = useQueryClient()

  const isToday = selectedDate === todayStr

  function goBack() {
    const d = new Date(selectedDate + "T00:00:00")
    d.setDate(d.getDate() - 1)
    setSelectedDate(toLocalDateStr(d))
  }

  function goForward() {
    if (isToday) return
    const d = new Date(selectedDate + "T00:00:00")
    d.setDate(d.getDate() + 1)
    setSelectedDate(toLocalDateStr(d))
  }

  const { data: sleep = [], isLoading: l1 } = useQuery({ queryKey: ["sleep"], queryFn: getSleepRecords })
  const { data: nutrition = [], isLoading: l2 } = useQuery({ queryKey: ["nutrition"], queryFn: getNutritionRecords })
  const { data: mood = [], isLoading: l3 } = useQuery({ queryKey: ["mood"], queryFn: getMoodRecords })
  const { data: stress = [], isLoading: l4 } = useQuery({ queryKey: ["stress"], queryFn: getStressRecords })
  const { data: activity = [], isLoading: l5 } = useQuery({ queryKey: ["activity"], queryFn: getActivityRecords })
  const { data: water = [], isLoading: l6 } = useQuery({ queryKey: ["water"], queryFn: getWaterRecords })

  const loading = l1 || l2 || l3 || l4 || l5 || l6

  function handleDialogClose(open: boolean) {
    if (!open && addMetric) {
      const queryKey = addMetric === "food" ? "nutrition" : addMetric
      queryClient.invalidateQueries({ queryKey: [queryKey] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["fullStreak"] })
      queryClient.invalidateQueries({ queryKey: ["userLevel"] })
      queryClient.invalidateQueries({ queryKey: ["achievements"] })
      setAddMetric(null)
    }
  }

  const daySleepRecs = sleep.filter((r) => r.date.slice(0, 10) === selectedDate)
  const dayNutritionRecs = nutrition.filter((r) => r.date.slice(0, 10) === selectedDate)
  const dayMoodRecs = mood.filter((r) => r.date.slice(0, 10) === selectedDate)
  const dayStressRecs = stress.filter((r) => r.date.slice(0, 10) === selectedDate)
  const dayActivityRecs = activity.filter((r) => r.date.slice(0, 10) === selectedDate)
  const dayWaterRecs = water.filter((r) => r.date.slice(0, 10) === selectedDate)

  const daySleep = daySleepRecs.length > 0
    ? { hours: daySleepRecs[daySleepRecs.length - 1].hours, quality: daySleepRecs[daySleepRecs.length - 1].quality }
    : null

  const dayNutrition = dayNutritionRecs.length > 0
    ? {
        kcal: dayNutritionRecs.reduce((s, r) => s + r.kcal, 0),
        proteins: dayNutritionRecs.reduce((s, r) => s + r.proteins, 0),
        fats: dayNutritionRecs.reduce((s, r) => s + r.fats, 0),
        carbs: dayNutritionRecs.reduce((s, r) => s + r.carbs, 0),
      }
    : null

  const dayMood = dayMoodRecs.length > 0
    ? { value: Math.round(dayMoodRecs.reduce((s, r) => s + r.value, 0) / dayMoodRecs.length) }
    : null

  // Берём последнюю запись, а не среднее: иначе при редактировании создаётся
  // новая запись вместо update.
  const dayStress = dayStressRecs.length > 0
    ? { level: dayStressRecs[dayStressRecs.length - 1].level }
    : null

  const dayActivity = dayActivityRecs.length > 0
    ? {
        duration: dayActivityRecs.reduce((s, r) => s + r.duration, 0),
        steps: dayActivityRecs.reduce((s, r) => s + (r.steps ?? 0), 0),
      }
    : null

  const dayWater = dayWaterRecs.length > 0
    ? { glasses: dayWaterRecs.reduce((s, r) => s + r.glasses, 0) }
    : null

  const sleepSparkline = aggregateByDay(sleep, (rs) => rs[rs.length - 1].hours)
  const nutritionSparkline = aggregateByDay(nutrition, (rs) => rs.reduce((s, r) => s + r.kcal, 0))
  const moodSparkline = aggregateByDay(mood, (rs) => Math.round(rs.reduce((s, r) => s + r.value, 0) / rs.length))
  const stressSparkline = aggregateByDay(stress, (rs) => rs[rs.length - 1].level)
  const activitySparkline = aggregateByDay(activity, (rs) => rs.reduce((s, r) => s + r.duration, 0))
  const waterSparkline = aggregateByDay(water, (rs) => rs.reduce((s, r) => s + r.glasses, 0))

  function getSleepDialogProps() {
    const rec = daySleepRecs[daySleepRecs.length - 1]
    if (!rec) return {}
    return {
      mode: "edit" as const,
      recordId: rec.id,
      recordDate: rec.date.slice(0, 10),
      defaultValues: {
        bedTime: rec.bedTime ?? "23:00",
        wakeTime: rec.wakeTime ?? "07:00",
        quality: rec.quality,
      },
    }
  }

  function getMoodDialogProps() {
    const rec = [...dayMoodRecs].at(-1)
    if (!rec) return {}
    return {
      mode: "edit" as const,
      recordId: rec.id,
      recordDate: rec.date.slice(0, 10),
      defaultValues: {
        value: Math.max(1, Math.min(5, Math.round(rec.value / 2))),
      },
    }
  }

  function getStressDialogProps() {
    const rec = [...dayStressRecs].at(-1)
    if (!rec) return {}
    return {
      mode: "edit" as const,
      recordId: rec.id,
      recordDate: rec.date.slice(0, 10),
      defaultValues: { level: rec.level },
    }
  }

  function getActivityDialogProps() {
    const rec = [...dayActivityRecs].at(-1)
    if (!rec) return {}
    return {
      mode: "edit" as const,
      recordId: rec.id,
      recordDate: rec.date.slice(0, 10),
      defaultValues: {
        duration: rec.duration,
        steps: rec.steps,
      },
    }
  }

  function getWaterDialogProps() {
    const rec = [...dayWaterRecs].at(-1)
    if (!rec) return {}
    return {
      mode: "edit" as const,
      recordId: rec.id,
      recordDate: rec.date.slice(0, 10),
      defaultValues: { glasses: rec.glasses },
    }
  }

  const filledMetrics = [daySleep, dayNutrition, dayMood, dayStress, dayActivity, dayWater].filter(Boolean).length

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-6xl pt-4">
          <div className="mb-10 flex items-center gap-4">
            <div className="h-12 w-12 animate-pulse rounded-2xl bg-surface-card" />
            <div>
              <div className="h-7 w-32 animate-pulse rounded-lg bg-surface-card" />
              <div className="mt-2 h-4 w-48 animate-pulse rounded-lg bg-surface-subtle" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-52 animate-pulse rounded-3xl border border-edge-subtle bg-surface-subtle" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-background">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.03] blur-3xl" />
        <div className="absolute -right-40 top-1/4 h-[600px] w-[600px] rounded-full bg-purple-500/[0.03] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-amber-500/[0.02] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-edge-medium bg-gradient-to-br from-surface-hover to-transparent">
                <Activity className="h-6 w-6 text-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Обзор</h1>
              <p className="mt-0.5 text-sm text-foreground/40">Ваши показатели здоровья</p>
            </div>
          </div>
          <Link
            href="/dashboard/recommendations"
            className="group inline-flex items-center gap-2.5 rounded-2xl border border-edge-medium bg-surface-subtle px-5 py-3 text-sm font-medium text-foreground transition-all hover:border-edge-strong hover:bg-surface-card"
          >
            <Sparkles className="h-4 w-4 text-amber-400 transition-transform group-hover:scale-110" />
            <span>Рекомендации</span>
          </Link>
        </header>

        <ProfileBackfillBanner />

        {/* Date Navigator */}
        <div className="mb-8 flex items-center justify-between rounded-3xl border border-edge-soft bg-surface-subtle px-2 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            className="h-10 w-10 rounded-2xl text-foreground/40 hover:bg-surface-strong hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium capitalize text-foreground">{formatDisplayDate(selectedDate)}</span>
            <div className="mt-1 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      i < filledMetrics ? "bg-emerald-400" : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(todayStr)}
                  className="text-xs font-medium text-cyan-400 transition-colors hover:text-cyan-300"
                >
                  Сегодня
                </button>
              )}
            </div>
          </div>
          {isToday ? (
            <div className="h-10 w-10" />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={goForward}
              className="h-10 w-10 rounded-2xl text-foreground/40 hover:bg-surface-strong hover:text-foreground"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="md:col-span-2 xl:col-span-1">
            <StreakWidget />
          </div>

          <MetricCard
            title="Сон"
            value={daySleep ? `${daySleep.hours.toFixed(1)}ч` : "—"}
            subtitle={daySleep ? "из 8ч цели" : "Нет данных"}
            icon={Moon}
            href="/dashboard/sleep"
            progress={daySleep ? (daySleep.hours / 8) * 100 : 0}
            sparklineData={sleepSparkline.map((d) => d.value)}
            color="oklch(0.65 0.18 260)"
            onAdd={() => setAddMetric("sleep")}
          />

          <MetricCard
            title="Питание"
            value={dayNutrition ? `${dayNutrition.kcal}` : "—"}
            subtitle={dayNutrition ? "ккал из 2000" : "Нет данных"}
            icon={UtensilsCrossed}
            href="/dashboard/nutrition"
            progress={dayNutrition ? (dayNutrition.kcal / 2000) * 100 : 0}
            sparklineData={nutritionSparkline.map((d) => d.value)}
            color="oklch(0.72 0.16 80)"
            onAdd={() => setAddMetric("food")}
          />

          <MetricCard
            title="Настроение"
            value={dayMood ? `${dayMood.value}/10` : "—"}
            subtitle={dayMood ? "настроение дня" : "Нет данных"}
            icon={Smile}
            href="/dashboard/mood"
            progress={dayMood ? (dayMood.value / 10) * 100 : 0}
            sparklineData={moodSparkline.map((d) => d.value)}
            color="oklch(0.7 0.18 150)"
            onAdd={() => setAddMetric("mood")}
          />

          <MetricCard
            title="Стресс"
            value={dayStress ? `${dayStress.level}` : "—"}
            subtitle={dayStress ? "из 10" : "Нет данных"}
            icon={Brain}
            href="/dashboard/stress"
            progress={dayStress ? (dayStress.level / 10) * 100 : 0}
            sparklineData={stressSparkline.map((d) => d.value)}
            color={getStressColor(dayStress?.level)}
            onAdd={() => setAddMetric("stress")}
          />

          <MetricCard
            title="Активность"
            value={dayActivity ? `${dayActivity.duration} мин` : "—"}
            subtitle={dayActivity?.steps ? `${dayActivity.steps.toLocaleString()} шагов` : "Нет данных"}
            icon={Flame}
            href="/dashboard/activity"
            progress={dayActivity ? (dayActivity.duration / 60) * 100 : 0}
            sparklineData={activitySparkline.map((d) => d.value)}
            color="oklch(0.72 0.2 40)"
            onAdd={() => setAddMetric("activity")}
          />

          <MetricCard
            title="Вода"
            value={dayWater ? `${dayWater.glasses}` : "—"}
            subtitle={dayWater ? "из 8 стаканов" : "Нет данных"}
            icon={Droplets}
            href="/dashboard/water"
            progress={dayWater ? (dayWater.glasses / 8) * 100 : 0}
            sparklineData={waterSparkline.map((d) => d.value)}
            color="oklch(0.7 0.15 220)"
            onAdd={() => setAddMetric("water")}
          />
        </div>
      </div>

      {addMetric !== null && (
        <AddRecordDialog
          metric={addMetric}
          open={true}
          onOpenChange={handleDialogClose}
          date={selectedDate}
          {...(addMetric === "sleep" ? getSleepDialogProps() : {})}
          {...(addMetric === "mood" ? getMoodDialogProps() : {})}
          {...(addMetric === "stress" ? getStressDialogProps() : {})}
          {...(addMetric === "activity" ? getActivityDialogProps() : {})}
          {...(addMetric === "water" ? getWaterDialogProps() : {})}
        />
      )}
    </div>
  )
}
