"use client"

// frontend/components/dashboard/add-record-dialog.tsx

import { useMutation, useQueryClient }   from "@tanstack/react-query"
import { toast }                         from "sonner"
import { nowTime }                       from "@/lib/health-api"
import { useForm, Controller, useWatch } from "react-hook-form"
import { zodResolver }                   from "@hookform/resolvers/zod"
import { z }                             from "zod"
import { useEffect, useState }           from "react"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { Slider }   from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Minus, Plus } from "lucide-react"
import type { MetricType } from "@/types/health"
import {
  createSleepRecord,    createNutritionRecord, createMoodRecord,
  createStressRecord,   createActivityRecord,  createWaterRecord,
  updateSleepRecord,    updateNutritionRecord, updateMoodRecord,
  updateStressRecord,   updateActivityRecord,  updateWaterRecord,
} from "@/lib/health-api"
import type {
  SleepPayload, NutritionPayload, MoodPayload,
  StressPayload, ActivityPayload, WaterPayload,
} from "@/lib/health-api"
import { FoodSearch, MealEntry, sumMacros } from "@/components/dashboard/food-search"

// ── Toast messages ────────────────────────────────────────────

const toastMessages: Record<MetricType, { add: string; edit: string; error: string }> = {
  sleep:    { add: "Сон сохранён",              edit: "Сон обновлён",            error: "Не удалось сохранить сон"        },
  food:     { add: "Приём пищи добавлен",       edit: "Питание обновлено",       error: "Не удалось сохранить питание"    },
  mood:     { add: "Настроение сохранено",      edit: "Настроение обновлено",    error: "Не удалось сохранить настроение" },
  stress:   { add: "Уровень стресса сохранён",  edit: "Стресс обновлён",         error: "Не удалось сохранить стресс"     },
  activity: { add: "Активность добавлена",      edit: "Активность обновлена",    error: "Не удалось сохранить активность" },
  water:    { add: "Вода сохранена",            edit: "Вода обновлена",          error: "Не удалось сохранить воду"       },
}

// ── Utils ─────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function scale5to10(v: number): number {
  return Math.round((v / 5) * 10)
}

// ── Types ─────────────────────────────────────────────────────

interface AddRecordDialogProps {
  metric:         MetricType | null
  open:           boolean
  onOpenChange:   (open: boolean) => void
  onSuccess?:     () => void
  defaultValues?: Record<string, unknown>
  mode?:          "add" | "edit"
  recordId?:      string
  recordDate?:    string
  date?:          string
}

const metricTitles: Record<MetricType, string> = {
  sleep:    "Сон",
  food:     "Питание",
  mood:     "Настроение",
  stress:   "Стресс",
  activity: "Активность",
  water:    "Вода",
}

// ── Schemas ───────────────────────────────────────────────────

const sleepSchema = z.object({
  bedTime:       z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: "Формат ЧЧ:ММ" }),
  wakeTime:      z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: "Формат ЧЧ:ММ" }),
  quality:       z.coerce.number().min(1).max(10),
  interruptions: z.coerce.number().min(0).optional(),
  notes:         z.string().optional(),
}).refine(
  (data) => {
    const [bH, bM] = data.bedTime.split(":").map(Number)
    const [wH, wM] = data.wakeTime.split(":").map(Number)
    const bedMins  = bH * 60 + bM
    const wakeMins = wH * 60 + wM
    const diff     = wakeMins >= bedMins
      ? wakeMins - bedMins
      : (24 * 60 - bedMins) + wakeMins
    return diff >= 60
  },
  { message: "Время пробуждения должно быть минимум на 1 час позже отхода ко сну", path: ["wakeTime"] }
)

// Питание — только тип и заметки, БЖУ берём из FoodSearch entries
const nutritionSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"], {
    errorMap: () => ({ message: "Выберите приём пищи" }),
  }),
  notes: z.string().optional(),
})

const moodSchema = z.object({
  value: z.coerce.number().min(1).max(5),
  notes: z.string().optional(),
})

const stressSchema = z.object({
  level: z.coerce.number().min(1).max(10),
  notes: z.string().optional(),
})

const activitySchema = z.object({
  type:        z.enum(["walk", "run", "yoga", "gym", "sport", "other"]),
  duration:    z.coerce.number().min(1),
  intensity:   z.enum(["light", "moderate", "vigorous"]).default("moderate"),
  steps:       z.coerce.number().min(0).optional(),
  description: z.string().optional(),
})

const waterSchema = z.object({
  glasses: z.coerce.number().min(0).max(20),
})

function getSchema(metric: MetricType) {
  switch (metric) {
    case "sleep":    return sleepSchema
    case "food":     return nutritionSchema
    case "mood":     return moodSchema
    case "stress":   return stressSchema
    case "activity": return activitySchema
    case "water":    return waterSchema
  }
}

function getDefaults(metric: MetricType): Record<string, unknown> {
  switch (metric) {
    case "sleep":    return { bedTime: "23:00", wakeTime: "07:00", quality: 7, interruptions: 0, notes: "" }
    case "food":     return { mealType: "lunch", notes: "" }
    case "mood":     return { value: 3, notes: "" }
    case "stress":   return { level: 5, notes: "" }
    case "activity": return { type: "walk", duration: 30, intensity: "moderate", steps: 0, description: "" }
    case "water":    return { glasses: 4 }
  }
}

const ACTIVITY_TYPE_TO_API: Record<string, ActivityPayload["type"]> = {
  walk: "walking", run: "running", yoga: "other", gym: "gym", sport: "other", other: "other",
}

// ── Payload mapping ───────────────────────────────────────────

function toApiPayload(
  metric:      MetricType,
  data:        Record<string, unknown>,
  date:        string,
  mealEntries: MealEntry[] = [],
) {
  switch (metric) {
    case "sleep":
      return {
        date,
        bedTime:       data.bedTime       as string,
        wakeTime:      data.wakeTime      as string,
        quality:       data.quality       as number,
        interruptions: data.interruptions as number | undefined,
        notes:         (data.notes as string | undefined) ?? "",
      } satisfies SleepPayload

    case "mood":
      return {
        date,
        time:      nowTime(),
        moodScore: scale5to10(data.value as number),
        notes:     (data.notes as string | undefined) ?? "",
      } satisfies MoodPayload

    case "stress": {
      const stressNotes = (data.notes as string | undefined)?.trim()
      return {
        date,
        time:  nowTime(),
        level: data.level as number,
        ...(stressNotes ? { cause: stressNotes } : {}),
      } satisfies StressPayload
    }

    case "activity": {
      const activityTypeLabel: Record<string, string> = {
        walk: "Ходьба", run: "Бег", gym: "Зал", yoga: "Йога", sport: "Спорт", other: "Другое",
      }
      const userDesc      = (data.description as string | undefined)?.trim() ?? ""
      const typeLabel     = activityTypeLabel[data.type as string] ?? (data.type as string)
      const combinedNotes = userDesc ? `${typeLabel}: ${userDesc}` : typeLabel
      return {
        date,
        type:            ACTIVITY_TYPE_TO_API[data.type as string] ?? "other",
        durationMinutes: data.duration as number,
        intensity:       (data.intensity as ActivityPayload["intensity"]) ?? "moderate",
        caloriesBurned:  data.caloriesBurned as number | undefined,
        notes:           combinedNotes,
      } satisfies ActivityPayload
    }

    case "water":
      return {
        date,
        time:     nowTime(),
        amountMl: (data.glasses as number) * 250,
      } satisfies WaterPayload

    case "food": {
      const totals = mealEntries.length > 0
        ? sumMacros(mealEntries)
        : { proteins: 0, fats: 0, carbs: 0, kcal: 0 }

      const autoDescription = mealEntries.length > 0
        ? mealEntries.map(e => `${e.food.name} (${e.grams}г)`).join(", ")
        : "—"
      const userNotes   = (data.notes as string | undefined)?.trim() ?? ""
      const description = userNotes ? `${autoDescription}. ${userNotes}` : autoDescription

      return {
        date,
        time:         nowTime(),
        mealType:     (data.mealType as NutritionPayload["mealType"]) ?? "lunch",
        description,
        calories:     totals.kcal,
        proteinGrams: totals.proteins,
        carbsGrams:   totals.carbs,
        fatGrams:     totals.fats,
      } satisfies NutritionPayload
    }

    default:
      throw new Error(`Unknown metric: ${metric}`)
  }
}

// ── Submit fn ─────────────────────────────────────────────────

async function submitRecord(
  metric:      MetricType,
  raw:         Record<string, unknown>,
  mode:        "add" | "edit",
  targetDate:  string,
  mealEntries: MealEntry[],
  recordId?:   string,
) {
  const data = toApiPayload(metric, raw, targetDate, mealEntries)
  if (mode === "edit" && recordId) {
    switch (metric) {
      case "sleep":    return updateSleepRecord(recordId,     data as Partial<SleepPayload>)
      case "food":     return updateNutritionRecord(recordId, data as Partial<NutritionPayload>)
      case "mood":     return updateMoodRecord(recordId,      data as Partial<MoodPayload>)
      case "stress":   return updateStressRecord(recordId,    data as Partial<StressPayload>)
      case "activity": return updateActivityRecord(recordId,  data as Partial<ActivityPayload>)
      case "water":    return updateWaterRecord(recordId,     data as Partial<WaterPayload>)
    }
  }
  switch (metric) {
    case "sleep":    return createSleepRecord(data as SleepPayload)
    case "food":     return createNutritionRecord(data as NutritionPayload)
    case "mood":     return createMoodRecord(data as MoodPayload)
    case "stress":   return createStressRecord(data as StressPayload)
    case "activity": return createActivityRecord(data as ActivityPayload)
    case "water":    return createWaterRecord(data as WaterPayload)
  }
}

// ── Sub-components ────────────────────────────────────────────

function WaterStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-4">
      <Button type="button" variant="outline" size="icon" className="h-10 w-10"
        onClick={() => onChange(Math.max(0, value - 1))}>
        <Minus className="h-4 w-4" />
      </Button>
      <span className="min-w-[3rem] text-center text-2xl font-bold text-foreground">{value}</span>
      <Button type="button" variant="outline" size="icon" className="h-10 w-10"
        onClick={() => onChange(Math.min(20, value + 1))}>
        <Plus className="h-4 w-4" />
      </Button>
      <span className="text-sm text-muted-foreground">стаканов (~250 мл)</span>
    </div>
  )
}

function MoodPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const emojis: [string, string][] = [
    ["😞", "Плохо"], ["😕", "Так себе"], ["😐", "Нейтрально"], ["😊", "Хорошо"], ["😄", "Отлично"],
  ]
  return (
    <div className="flex gap-2">
      {emojis.map(([emoji, label], index) => {
        const moodVal = index + 1
        return (
          <button key={moodVal} type="button" onClick={() => onChange(moodVal)}
            title={label} aria-label={label}
            className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl transition-all ${
              moodVal === value
                ? "bg-primary/20 ring-2 ring-primary"
                : "bg-secondary hover:bg-secondary/80"
            }`}>
            {emoji}
          </button>
        )
      })}
    </div>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-destructive">{msg}</p>
}

// ── Main Dialog ───────────────────────────────────────────────

export function AddRecordDialog({
  metric, open, onOpenChange, onSuccess,
  defaultValues, mode = "add", recordId, recordDate, date,
}: AddRecordDialogProps) {
  const queryClient = useQueryClient()
  const [mealEntries, setMealEntries] = useState<MealEntry[]>([])

  // Сброс entries когда диалог закрывается
  useEffect(() => {
    if (!open) setMealEntries([])
  }, [open])

  const targetDate = mode === "edit" && recordDate
    ? recordDate
    : (date ?? todayStr())

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (!metric) throw new Error("metric is null")
      return submitRecord(metric, data, mode, targetDate, mealEntries, recordId)
    },
    onSuccess: () => {
      if (!metric) return
      const queryKey = metric === "food" ? "nutrition" : metric
      queryClient.invalidateQueries({ queryKey: [queryKey] })
      onOpenChange(false)
      onSuccess?.()

      const messages = toastMessages[metric]
      toast.success(mode === "edit" ? messages.edit : messages.add, {
        description: targetDate !== todayStr()
          ? `За ${new Date(targetDate + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`
          : "За сегодня",
        duration: 3000,
      })
    },
    onError: (err) => {
      if (!metric) return
      toast.error(toastMessages[metric].error, {
        description: "Проверьте подключение и попробуйте снова",
        duration: 4000,
      })
      console.error("[AddRecordDialog] submit error:", err)
    },
  })

  if (!metric) return null

  const schema   = getSchema(metric)
  const defaults = defaultValues ?? getDefaults(metric)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {mode === "add"
              ? `Добавить: ${metricTitles[metric]}`
              : `Редактировать: ${metricTitles[metric]}`}
          </DialogTitle>
          <DialogDescription>
            {targetDate !== todayStr()
              ? `Дата: ${new Date(targetDate + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`
              : "Заполните данные и нажмите сохранить"}
          </DialogDescription>
        </DialogHeader>

        <MetricForm
          metric={metric}
          schema={schema}
          defaults={defaults}
          isPending={mutation.isPending}
          mealEntries={mealEntries}
          onMealEntriesChange={setMealEntries}
          onSubmit={mutation.mutate}
        />
      </DialogContent>
    </Dialog>
  )
}

// ── Metric Form ───────────────────────────────────────────────

function MetricForm({
  metric, schema, defaults, isPending,
  mealEntries, onMealEntriesChange, onSubmit,
}: {
  metric:              MetricType
  schema:              z.ZodSchema
  defaults:            Record<string, unknown>
  isPending:           boolean
  mealEntries:         MealEntry[]
  onMealEntriesChange: (entries: MealEntry[]) => void
  onSubmit:            (data: Record<string, unknown>) => void
}) {
  const { register, handleSubmit, control, formState: { errors } } = useForm({
    resolver:      zodResolver(schema),
    defaultValues: defaults,
  })

  const watchedType     = useWatch({ control, name: "type" })
  const isOtherActivity = watchedType === "other"
  const isFoodEmpty     = metric === "food" && mealEntries.length === 0

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

      {/* ── Sleep ── */}
      {metric === "sleep" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label className="text-secondary-foreground">Время отхода ко сну</Label>
              <Input type="time" className="h-11 border-border bg-input text-foreground" {...register("bedTime")} />
              <FieldError msg={errors.bedTime?.message as string} />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-secondary-foreground">Время пробуждения</Label>
              <Input type="time" className="h-11 border-border bg-input text-foreground" {...register("wakeTime")} />
              <FieldError msg={errors.wakeTime?.message as string} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-secondary-foreground">Качество сна (1–10)</Label>
            <Controller name="quality" control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  <Slider min={1} max={10} step={1}
                    value={[field.value as number]}
                    onValueChange={(v) => field.onChange(v[0])} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Плохо</span>
                    <span className="font-bold text-foreground">{field.value as number}/10</span>
                    <span>Отлично</span>
                  </div>
                </div>
              )} />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-secondary-foreground">Пробуждений за ночь</Label>
            <Input type="number" min={0} className="h-11 border-border bg-input text-foreground" {...register("interruptions")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-secondary-foreground">Заметки</Label>
            <Textarea className="border-border bg-input text-foreground"
              placeholder="Как спалось, что мешало..." {...register("notes")} />
          </div>
        </>
      )}

      {/* ── Food ── */}
      {metric === "food" && (
        <>
          <div className="flex flex-col gap-2">
            <Label className="text-secondary-foreground">Приём пищи</Label>
            <Controller name="mealType" control={control}
              render={({ field }) => (
                <Select value={field.value as string} onValueChange={field.onChange}>
                  <SelectTrigger className="h-11 border-border bg-input text-foreground">
                    <SelectValue placeholder="Выберите приём пищи" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Завтрак</SelectItem>
                    <SelectItem value="lunch">Обед</SelectItem>
                    <SelectItem value="dinner">Ужин</SelectItem>
                    <SelectItem value="snack">Перекус</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            <FieldError msg={errors.mealType?.message as string} />
          </div>

          <FoodSearch entries={mealEntries} onChange={onMealEntriesChange} />

          <div className="flex flex-col gap-2">
            <Label className="text-secondary-foreground">Заметки (необязательно)</Label>
            <Textarea className="border-border bg-input text-foreground"
              placeholder="Самочувствие после еды, особенности приготовления..."
              rows={2} {...register("notes")} />
          </div>

          {isFoodEmpty && (
            <p className="text-center text-xs text-amber-400/80">
              Добавьте хотя бы один продукт чтобы сохранить
            </p>
          )}
        </>
      )}

      {/* ── Mood ── */}
      {metric === "mood" && (
        <>
          <div className="flex flex-col gap-2">
            <Label className="text-secondary-foreground">Как вы себя чувствуете?</Label>
            <Controller name="value" control={control}
              render={({ field }) => (
                <MoodPicker value={field.value as number} onChange={field.onChange} />
              )} />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-secondary-foreground">Заметки</Label>
            <Textarea className="border-border bg-input text-foreground"
              placeholder="Что повлияло на настроение..." {...register("notes")} />
          </div>
        </>
      )}

      {/* ── Stress ── */}
      {metric === "stress" && (
        <>
          <div className="flex flex-col gap-2">
            <Label className="text-secondary-foreground">Уровень стресса</Label>
            <Controller name="level" control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  <Slider min={1} max={10} step={1}
                    value={[field.value as number]}
                    onValueChange={(v) => field.onChange(v[0])} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Спокойно</span>
                    <span className="font-bold text-foreground">{field.value as number}/10</span>
                    <span>Стресс</span>
                  </div>
                </div>
              )} />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-secondary-foreground">Заметки</Label>
            <Textarea className="border-border bg-input text-foreground"
              placeholder="Что вызвало стресс..." {...register("notes")} />
          </div>
        </>
      )}

      {/* ── Activity ── */}
      {metric === "activity" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label className="text-secondary-foreground">Тип активности</Label>
              <Controller name="type" control={control}
                render={({ field }) => (
                  <Select value={field.value as string} onValueChange={field.onChange}>
                    <SelectTrigger className="h-11 border-border bg-input text-foreground"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walk">Ходьба</SelectItem>
                      <SelectItem value="run">Бег</SelectItem>
                      <SelectItem value="gym">Зал</SelectItem>
                      <SelectItem value="yoga">Йога</SelectItem>
                      <SelectItem value="sport">Спорт</SelectItem>
                      <SelectItem value="other">Другое</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-secondary-foreground">Интенсивность</Label>
              <Controller name="intensity" control={control}
                render={({ field }) => (
                  <Select value={field.value as string} onValueChange={field.onChange}>
                    <SelectTrigger className="h-11 border-border bg-input text-foreground"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Лёгкая</SelectItem>
                      <SelectItem value="moderate">Средняя</SelectItem>
                      <SelectItem value="vigorous">Высокая</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label className="text-secondary-foreground">Длительность (мин)</Label>
              <Input type="number" className="h-11 border-border bg-input text-foreground" {...register("duration")} />
              <FieldError msg={errors.duration?.message as string} />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-secondary-foreground">Шаги (необяз.)</Label>
              <Input type="number" className="h-11 border-border bg-input text-foreground" {...register("steps")} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-secondary-foreground">
              {isOtherActivity ? "Опишите активность *" : "Описание (необязательно)"}
            </Label>
            <Textarea className="border-border bg-input text-foreground"
              placeholder={isOtherActivity
                ? "Что делали? Например: танцы, плавание..."
                : "Маршрут, упражнения, самочувствие..."}
              rows={2} {...register("description")} />
          </div>
        </>
      )}

      {/* ── Water ── */}
      {metric === "water" && (
        <div className="flex flex-col gap-2">
          <Label className="text-secondary-foreground">Количество стаканов</Label>
          <Controller name="glasses" control={control}
            render={({ field }) => (
              <WaterStepper value={field.value as number} onChange={field.onChange} />
            )} />
        </div>
      )}

      <DialogFooter className="mt-2">
        <Button
          type="submit"
          disabled={isPending || isFoodEmpty}
          className="h-11 w-full font-bold uppercase tracking-wider"
        >
          {isPending ? "Сохранение..." : "Сохранить"}
        </Button>
      </DialogFooter>
    </form>
  )
}