"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Moon, UtensilsCrossed, Smile, Brain, Flame, Droplets, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MetricCard } from "@/components/dashboard/metric-card"
import { AddRecordDialog } from "@/components/dashboard/add-record-dialog"
import {
  getSleepRecords, getNutritionRecords, getMoodRecords,
  getStressRecords, getActivityRecords, getWaterRecords,
} from "@/lib/health-api"
import type { MetricType } from "@/types/health"

function getStressColor(level: number | undefined): string {
  if (level === undefined) return "oklch(0.80 0.16 85)"
  if (level <= 3) return "oklch(0.72 0.17 145)"
  if (level <= 6) return "oklch(0.80 0.16 85)"
  return "oklch(0.65 0.22 25)"
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

// Локальная дата вместо UTC — иначе в GMT+1 и выше получаем вчерашний день
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

  const { data: sleep     = [], isLoading: l1 } = useQuery({ queryKey: ["sleep"],     queryFn: getSleepRecords })
  const { data: nutrition = [], isLoading: l2 } = useQuery({ queryKey: ["nutrition"], queryFn: getNutritionRecords })
  const { data: mood      = [], isLoading: l3 } = useQuery({ queryKey: ["mood"],      queryFn: getMoodRecords })
  const { data: stress    = [], isLoading: l4 } = useQuery({ queryKey: ["stress"],    queryFn: getStressRecords })
  const { data: activity  = [], isLoading: l5 } = useQuery({ queryKey: ["activity"],  queryFn: getActivityRecords })
  const { data: water     = [], isLoading: l6 } = useQuery({ queryKey: ["water"],     queryFn: getWaterRecords })

  const loading = l1 || l2 || l3 || l4 || l5 || l6

  function handleDialogClose(open: boolean) {
    if (!open && addMetric) {
      const queryKey = addMetric === "food" ? "nutrition" : addMetric
      queryClient.invalidateQueries({ queryKey: [queryKey] })
      setAddMetric(null)
    }
  }

  // ── Агрегация за выбранный день ───────────────────────────

  const daySleepRecs     = sleep.filter((r) => r.date.slice(0, 10) === selectedDate)
  const dayNutritionRecs = nutrition.filter((r) => r.date.slice(0, 10) === selectedDate)
  const dayMoodRecs      = mood.filter((r) => r.date.slice(0, 10) === selectedDate)
  const dayStressRecs    = stress.filter((r) => r.date.slice(0, 10) === selectedDate)
  const dayActivityRecs  = activity.filter((r) => r.date.slice(0, 10) === selectedDate)
  const dayWaterRecs     = water.filter((r) => r.date.slice(0, 10) === selectedDate)

  const daySleep = daySleepRecs.length > 0 ? {
    hours:   daySleepRecs[daySleepRecs.length - 1].hours,
    quality: daySleepRecs[daySleepRecs.length - 1].quality,
  } : null

  const dayNutrition = dayNutritionRecs.length > 0 ? {
    kcal:     dayNutritionRecs.reduce((s, r) => s + r.kcal, 0),
    proteins: dayNutritionRecs.reduce((s, r) => s + r.proteins, 0),
    fats:     dayNutritionRecs.reduce((s, r) => s + r.fats, 0),
    carbs:    dayNutritionRecs.reduce((s, r) => s + r.carbs, 0),
  } : null

  const dayMood = dayMoodRecs.length > 0 ? {
    value: Math.round(dayMoodRecs.reduce((s, r) => s + r.value, 0) / dayMoodRecs.length),
  } : null

  const dayStress = dayStressRecs.length > 0 ? {
    level: Math.round(dayStressRecs.reduce((s, r) => s + r.level, 0) / dayStressRecs.length),
  } : null

  const dayActivity = dayActivityRecs.length > 0 ? {
    duration: dayActivityRecs.reduce((s, r) => s + r.duration, 0),
    steps:    dayActivityRecs.reduce((s, r) => s + (r.steps ?? 0), 0),
  } : null

  const dayWater = dayWaterRecs.length > 0 ? {
    glasses: dayWaterRecs.reduce((s, r) => s + r.glasses, 0),
  } : null

  // ── Sparkline (все дни) ───────────────────────────────────

  const sleepSparkline     = aggregateByDay(sleep,     (rs) => rs[rs.length - 1].hours)
  const nutritionSparkline = aggregateByDay(nutrition, (rs) => rs.reduce((s, r) => s + r.kcal, 0))
  const moodSparkline      = aggregateByDay(mood,      (rs) => Math.round(rs.reduce((s, r) => s + r.value, 0) / rs.length))
  const stressSparkline    = aggregateByDay(stress,    (rs) => Math.round(rs.reduce((s, r) => s + r.level, 0) / rs.length))
  const activitySparkline  = aggregateByDay(activity,  (rs) => rs.reduce((s, r) => s + r.duration, 0))
  const waterSparkline     = aggregateByDay(water,     (rs) => rs.reduce((s, r) => s + r.glasses, 0))

  // ── Пропсы диалога для сна (upsert по выбранному дню) ────

  function getSleepDialogProps() {
    // Ищем запись за выбранный день (не только сегодня)
    const rec = daySleepRecs[daySleepRecs.length - 1]
    if (!rec) return {}
    return {
      mode:          "edit" as const,
      recordId:      rec.id,
      recordDate:    rec.date.slice(0, 10),
      defaultValues: {
        bedTime:       rec.bedTime       ?? "23:00",
        wakeTime:      rec.wakeTime      ?? "07:00",
        quality:       rec.quality,
        interruptions: rec.interruptions ?? 0,
        notes:         rec.notes         ?? "",
      },
    }
  }

  // ── Пропсы диалога для настроения (upsert по выбранному дню) ──

  function getMoodDialogProps() {
    const rec = [...dayMoodRecs].at(-1)
    if (!rec) return {}
    return {
      mode:          "edit" as const,
      recordId:      rec.id,
      recordDate:    rec.date.slice(0, 10),
      defaultValues: {
        value: Math.max(1, Math.min(5, Math.round(rec.value / 2))),
        notes: rec.notes ?? "",
      },
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 lg:px-8 lg:py-8">
        <div className="mb-8">
          <div className="h-8 w-32 animate-pulse rounded-md bg-secondary" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded-md bg-secondary" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground lg:text-3xl">{"Обзор"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{"Ваши показатели здоровья"}</p>
      </div>

      {/* ── Навигатор дней ─────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-sm font-semibold capitalize text-foreground">
            {formatDisplayDate(selectedDate)}
          </span>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="text-xs text-primary hover:underline"
            >
              {"Вернуться к сегодня"}
            </button>
          )}
        </div>

        {isToday ? (
          <div className="h-8 w-8" />
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={goForward}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* ── Карточки ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Сон"
          value={daySleep ? `${daySleep.hours}ч` : "—"}
          subtitle={daySleep ? "из 8ч цели" : "Нет данных"}
          icon={Moon}
          href="/dashboard/sleep"
          progress={daySleep ? (daySleep.hours / 8) * 100 : 0}
          sparklineData={sleepSparkline.map((d) => d.value)}
          color="oklch(0.70 0.15 260)"
          // ✅ Всегда показываем кнопку: добавить или редактировать
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
          color="oklch(0.75 0.15 55)"
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
          color="oklch(0.75 0.14 145)"
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
          color="oklch(0.72 0.19 30)"
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
          color="oklch(0.70 0.12 230)"
          onAdd={() => setAddMetric("water")}
        />
      </div>

      {addMetric !== null && (
        <AddRecordDialog
          metric={addMetric}
          open={true}
          onOpenChange={handleDialogClose}
          // ✅ Передаём выбранную дату — для добавления за прошлый день
          date={selectedDate}
          // ✅ Upsert для сна и настроения работает для любого дня
          {...(addMetric === "sleep" ? getSleepDialogProps() : {})}
          {...(addMetric === "mood"  ? getMoodDialogProps()  : {})}
        />
      )}
    </div>
  )
}