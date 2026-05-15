"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button }           from "@/components/ui/button"
import { Input }            from "@/components/ui/input"
import { Label }            from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox }         from "@/components/ui/checkbox"
import { Slider }           from "@/components/ui/slider"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  User, Target, Moon, Activity, Brain,
  ChevronRight, ChevronLeft, Check, Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { completeOnboarding } from "@/lib/onboarding-api"
import type {
  OnboardingData, GoalType, SleepChronotype,
  ActivityLevel, SportType, Gender, NutritionGoal,
} from "@/types/onboarding"

// ── Константы ─────────────────────────────────────────────────

const TOTAL_STEPS = 5

const STEPS = [
  { id: 1, title: "О вас",      icon: User,     description: "Базовые параметры тела"  },
  { id: 2, title: "Цели",       icon: Target,   description: "Приоритеты и питание"    },
  { id: 3, title: "Сон",        icon: Moon,     description: "Режим отдыха"            },
  { id: 4, title: "Активность", icon: Activity, description: "Физическая нагрузка"     },
  { id: 5, title: "Стресс",     icon: Brain,    description: "Текущий уровень"         },
]

const GOALS: { id: GoalType; label: string; description: string }[] = [
  { id: "sleep",  label: "Улучшить сон",         description: "Качество и продолжительность" },
  { id: "energy", label: "Больше энергии",        description: "Бодрость в течение дня"      },
  { id: "stress", label: "Снизить стресс",        description: "Спокойствие и баланс"        },
  { id: "weight", label: "Контроль веса",         description: "Здоровая масса тела"         },
  { id: "mood",   label: "Настроение",            description: "Эмоциональное здоровье"      },
]

const NUTRITION_GOALS: { id: NutritionGoal; label: string; description: string; icon: string }[] = [
  { id: "lose_weight", label: "Снижение веса",        description: "Дефицит ~15% от суточной нормы", icon: "📉" },
  { id: "maintain",    label: "Поддержание формы",    description: "Норма калорий = расход",         icon: "⚖️" },
  { id: "muscle_gain", label: "Набор мышечной массы", description: "Профицит ~10% для роста мышц",  icon: "💪" },
]

const CHRONOTYPES: { id: SleepChronotype; label: string; description: string }[] = [
  { id: "early_bird",  label: "Жаворонок",  description: "Легко встаю рано, продуктивен утром"  },
  { id: "no_routine",  label: "Гибкий",     description: "Стандартный режим, гибкий график"     },
  { id: "night_owl",   label: "Сова",       description: "Активен вечером, сложно вставать рано" },
]

const ACTIVITY_LEVELS: { id: ActivityLevel; label: string; description: string }[] = [
  { id: "sedentary", label: "Сидячий образ жизни", description: "Минимум движения"              },
  { id: "light",     label: "Лёгкая активность",   description: "1–2 тренировки в неделю"       },
  { id: "moderate",  label: "Умеренная активность", description: "3–4 тренировки в неделю"      },
  { id: "active",    label: "Высокая активность",   description: "5+ тренировок в неделю"       },
]

const SPORT_TYPES: { id: SportType; label: string }[] = [
  { id: "running",      label: "Бег"                },
  { id: "gym",          label: "Тренажёрный зал"    },
  { id: "yoga",         label: "Йога"               },
  { id: "cycling",      label: "Велосипед"          },
  { id: "swimming",     label: "Плавание"           },
  { id: "team_sports",  label: "Командные виды"     },
  { id: "martial_arts", label: "Единоборства"       },
  { id: "home_workout", label: "Дома без инвентаря" },
]

const SPORT_GOALS = [
  { id: "lose_weight",       label: "Похудение"        },
  { id: "build_muscle",      label: "Набор массы"      },
  { id: "improve_endurance", label: "Выносливость"     },
  { id: "stay_healthy",      label: "Поддержать форму" },
  { id: "reduce_stress",     label: "Снять стресс"     },
]

const GENDERS: { id: Gender; label: string; icon: string }[] = [
  { id: "male",   label: "Мужской", icon: "♂" },
  { id: "female", label: "Женский", icon: "♀" },
]

// ── Локальное состояние формы ─────────────────────────────────

interface FormState {
  name:                 string
  age:                  number | ""
  weightKg:             number | ""
  heightCm:             number | ""
  gender:               Gender   | ""
  selectedGoals:        GoalType[]
  primaryGoal:          GoalType | ""
  nutritionGoal:        NutritionGoal | ""
  chronotype:           SleepChronotype | ""
  sleepGoalHours:       number
  activityLevel:        ActivityLevel | ""
  sportTypes:           SportType[]
  workoutsPerWeek:      number
  avgWorkoutDurationMin:number
  sportGoal:            string
  baselineStress:       number
}

const DEFAULTS: FormState = {
  name:                 "",
  age:                  "",
  weightKg:             "",
  heightCm:             "",
  gender:               "",
  selectedGoals:        [],
  primaryGoal:          "",
  nutritionGoal:        "",
  chronotype:           "",
  sleepGoalHours:       8,
  activityLevel:        "",
  sportTypes:           [],
  workoutsPerWeek:      3,
  avgWorkoutDurationMin:45,
  sportGoal:            "",
  baselineStress:       5,
}

// ── Валидация числовых полей шага 1 ────────────────────────────
const AGE_MIN = 13,  AGE_MAX = 120
const W_MIN   = 30,  W_MAX   = 300
const H_MIN   = 100, H_MAX   = 250

function isValidNumberIn(v: number | "", min: number, max: number): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
}

// ── Page ──────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router                    = useRouter()
  const [step, setStep]           = useState(1)
  const [form, setForm]           = useState<FormState>(DEFAULTS)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function setNum<K extends "age" | "weightKg" | "heightCm">(key: K, raw: string) {
    if (raw === "") return set(key, "" as FormState[K])
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    set(key, n as FormState[K])
  }

  function toggleGoal(id: GoalType) {
    const next = form.selectedGoals.includes(id)
      ? form.selectedGoals.filter(g => g !== id)
      : form.selectedGoals.length < 3
        ? [...form.selectedGoals, id]
        : form.selectedGoals
    set("selectedGoals", next)
    if (!next.includes(form.primaryGoal as GoalType)) {
      set("primaryGoal", next[0] ?? "")
    }
  }

  function toggleSport(id: SportType) {
    set("sportTypes", form.sportTypes.includes(id)
      ? form.sportTypes.filter(s => s !== id)
      : [...form.sportTypes, id]
    )
  }

  function canProceed(): boolean {
    switch (step) {
      case 1:
        return !!form.name
          && isValidNumberIn(form.age,      AGE_MIN, AGE_MAX)
          && isValidNumberIn(form.weightKg, W_MIN,   W_MAX)
          && isValidNumberIn(form.heightCm, H_MIN,   H_MAX)
          && !!form.gender
      case 2: return form.selectedGoals.length > 0 && !!form.primaryGoal && !!form.nutritionGoal
      case 3: return !!form.chronotype
      case 4: return !!form.activityLevel
      case 5: return true
      default: return false
    }
  }

  async function handleSubmit() {
    if (loading) return
    setLoading(true)
    setError(null)

    // Маппим форму → OnboardingData (типы нашего API)
    const data: OnboardingData = {
      name:                  form.name,
      age:                   form.age      as number,
      weightKg:              form.weightKg as number,
      heightCm:              form.heightCm as number,
      gender:                form.gender   as Gender,
      goals:                 form.selectedGoals,
      primaryGoal:           form.primaryGoal as GoalType,
      nutritionGoal:         form.nutritionGoal as NutritionGoal,
      chronotype:            form.chronotype as SleepChronotype,
      sleepGoalHours:        form.sleepGoalHours,
      activityLevel:         form.activityLevel as ActivityLevel,
      sportTypes:            form.activityLevel === "sedentary" ? [] : form.sportTypes,
      workoutsPerWeek:       form.activityLevel === "sedentary" ? 0  : form.workoutsPerWeek,
      avgWorkoutDurationMin: form.activityLevel === "sedentary" ? 0  : form.avgWorkoutDurationMin,
      sportGoal:             (form.sportGoal as any) || null,
      baselineStress:        form.baselineStress,
    }

    try {
      await completeOnboarding(data)
      router.push("/dashboard")
    } catch (e: any) {
      setError(e?.message ?? "Ошибка сохранения. Попробуйте ещё раз.")
    } finally {
      setLoading(false)
    }
  }

  const stressLabel = (v: number) =>
    v <= 2 ? "Очень низкий" : v <= 4 ? "Низкий" : v <= 6 ? "Умеренный" : v <= 8 ? "Высокий" : "Очень высокий"

  const stressColor = (v: number) =>
    v <= 4 ? "text-emerald-400" : v <= 6 ? "text-amber-400" : "text-rose-400"

  const showSportBlock = form.activityLevel && form.activityLevel !== "sedentary"

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <span className="font-semibold text-foreground">Настройка профиля</span>
            </div>
            <span className="text-sm text-muted-foreground">Шаг {step} из {TOTAL_STEPS}</span>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => {
              const Icon        = s.icon
              const isActive    = s.id === step
              const isCompleted = s.id < step
              return (
                <div key={s.id} className="flex-1 flex items-center gap-1">
                  <button
                    onClick={() => isCompleted && setStep(s.id)}
                    disabled={s.id > step}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg transition-all w-full",
                      isActive    && "bg-primary/10",
                      isCompleted && "cursor-pointer hover:bg-secondary",
                      !isActive && !isCompleted && "opacity-40"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
                      isActive    && "bg-primary text-primary-foreground",
                      isCompleted && "bg-primary/20 text-primary",
                      !isActive && !isCompleted && "bg-secondary text-muted-foreground"
                    )}>
                      {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className={cn(
                      "hidden sm:block text-xs font-medium",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {s.title}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={cn("h-px flex-1 hidden lg:block", isCompleted ? "bg-primary/50" : "bg-border")} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">{STEPS[step - 1].title}</h1>
          <p className="text-muted-foreground">{STEPS[step - 1].description}</p>
        </div>

        {/* ── Шаг 1: О вас ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Как вас зовут?</Label>
              <Input
                id="name"
                placeholder="Введите ваше имя"
                value={form.name}
                onChange={e => set("name", e.target.value)}
                className="h-12 bg-secondary/50"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="age">Возраст</Label>
                <Input
                  id="age"
                  type="number"
                  inputMode="numeric"
                  min={AGE_MIN}
                  max={AGE_MAX}
                  placeholder="25"
                  value={form.age === "" ? "" : form.age}
                  onChange={e => setNum("age", e.target.value)}
                  className="h-12 bg-secondary/50"
                />
                <span className="text-xs text-muted-foreground">лет</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Вес</Label>
                <Input
                  id="weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={W_MIN}
                  max={W_MAX}
                  placeholder="70"
                  value={form.weightKg === "" ? "" : form.weightKg}
                  onChange={e => setNum("weightKg", e.target.value)}
                  className="h-12 bg-secondary/50"
                />
                <span className="text-xs text-muted-foreground">кг</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="height">Рост</Label>
                <Input
                  id="height"
                  type="number"
                  inputMode="numeric"
                  min={H_MIN}
                  max={H_MAX}
                  placeholder="175"
                  value={form.heightCm === "" ? "" : form.heightCm}
                  onChange={e => setNum("heightCm", e.target.value)}
                  className="h-12 bg-secondary/50"
                />
                <span className="text-xs text-muted-foreground">см</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground -mt-2">
              Эти данные нужны для точного расчёта суточной нормы калорий по формуле Mifflin-St Jeor.
            </p>

            <div className="space-y-3">
              <Label>Пол</Label>
              <RadioGroup
                value={form.gender}
                onValueChange={v => set("gender", v as Gender)}
                className="grid grid-cols-2 gap-3"
              >
                {GENDERS.map(g => (
                  <label
                    key={g.id}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                      form.gender === g.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/30 hover:border-primary/50"
                    )}
                  >
                    <RadioGroupItem value={g.id} />
                    <span className="text-xl">{g.icon}</span>
                    <span className="font-medium text-sm">{g.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>
        )}

        {/* ── Шаг 2: Цели + питание ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>
                Выберите до 3 целей
                <span className="text-muted-foreground ml-2">({form.selectedGoals.length}/3)</span>
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {GOALS.map(goal => {
                  const selected  = form.selectedGoals.includes(goal.id)
                  const disabled  = !selected && form.selectedGoals.length >= 3
                  return (
                    <button
                      key={goal.id}
                      onClick={() => toggleGoal(goal.id)}
                      disabled={disabled}
                      className={cn(
                        "flex flex-col items-start p-4 rounded-xl border text-left transition-all",
                        selected  && "border-primary bg-primary/10",
                        !selected && "border-border bg-secondary/30 hover:border-primary/50",
                        disabled  && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Checkbox checked={selected}/>
                        <span className="font-medium text-sm">{goal.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground pl-6">{goal.description}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {form.selectedGoals.length > 0 && (
              <div className="space-y-3">
                <Label>Главная цель</Label>
                <RadioGroup
                  value={form.primaryGoal}
                  onValueChange={v => set("primaryGoal", v as GoalType)}
                  className="flex flex-col gap-2"
                >
                  {form.selectedGoals.map(id => {
                    const goal = GOALS.find(g => g.id === id)!
                    return (
                      <label
                        key={id}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                          form.primaryGoal === id
                            ? "border-primary bg-primary/10"
                            : "border-border bg-secondary/30 hover:border-primary/50"
                        )}
                      >
                        <RadioGroupItem value={id} />
                        <span className="font-medium">{goal.label}</span>
                        <span className="text-xs text-muted-foreground ml-1">{goal.description}</span>
                      </label>
                    )
                  })}
                </RadioGroup>
              </div>
            )}

            <div className="space-y-3 pt-2 border-t border-border/50">
              <Label>Цель по питанию</Label>
              <p className="text-xs text-muted-foreground -mt-2">
                Определяет, сколько калорий рекомендуется в сутки.
              </p>
              <RadioGroup
                value={form.nutritionGoal}
                onValueChange={v => set("nutritionGoal", v as NutritionGoal)}
                className="grid grid-cols-1 gap-2"
              >
                {NUTRITION_GOALS.map(ng => (
                  <label
                    key={ng.id}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                      form.nutritionGoal === ng.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/30 hover:border-primary/50"
                    )}
                  >
                    <RadioGroupItem value={ng.id} />
                    <span className="text-xl">{ng.icon}</span>
                    <div className="flex-1">
                      <span className="font-medium text-sm block">{ng.label}</span>
                      <span className="text-xs text-muted-foreground">{ng.description}</span>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>
        )}

        {/* ── Шаг 3: Сон ── */}
        {step === 3 && (
          <div className="space-y-8">
            <div className="space-y-3">
              <Label>Ваш хронотип</Label>
              <RadioGroup
                value={form.chronotype}
                onValueChange={v => set("chronotype", v as SleepChronotype)}
                className="flex flex-col gap-3"
              >
                {CHRONOTYPES.map(c => (
                  <label
                    key={c.id}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                      form.chronotype === c.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/30 hover:border-primary/50"
                    )}
                  >
                    <RadioGroupItem value={c.id} className="mt-0.5" />
                    <div>
                      <span className="font-medium block mb-1">{c.label}</span>
                      <span className="text-sm text-muted-foreground">{c.description}</span>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Желаемые часы сна</Label>
                <span className="text-2xl font-bold text-primary">{form.sleepGoalHours} ч</span>
              </div>
              <Slider
                value={[form.sleepGoalHours]}
                onValueChange={([v]) => set("sleepGoalHours", v)}
                min={5} max={12} step={0.5}
                className="py-4"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5 часов</span><span>8 часов</span><span>12 часов</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Шаг 4: Активность ── */}
        {step === 4 && (
          <div className="space-y-8">
            <div className="space-y-3">
              <Label>Уровень активности</Label>
              <RadioGroup
                value={form.activityLevel}
                onValueChange={v => set("activityLevel", v as ActivityLevel)}
                className="flex flex-col gap-2"
              >
                {ACTIVITY_LEVELS.map(lvl => (
                  <label
                    key={lvl.id}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                      form.activityLevel === lvl.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/30 hover:border-primary/50"
                    )}
                  >
                    <RadioGroupItem value={lvl.id} />
                    <div>
                      <span className="font-medium">{lvl.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{lvl.description}</span>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {showSportBlock && (
              <>
                <div className="space-y-3">
                  <Label>Виды спорта</Label>
                  <div className="flex flex-wrap gap-2">
                    {SPORT_TYPES.map(sport => (
                      <button
                        key={sport.id}
                        onClick={() => toggleSport(sport.id)}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm font-medium transition-all",
                          form.sportTypes.includes(sport.id)
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary hover:bg-secondary/80 text-foreground"
                        )}
                      >
                        {sport.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Тренировок в неделю</Label>
                    <Select
                      value={String(form.workoutsPerWeek)}
                      onValueChange={v => set("workoutsPerWeek", Number(v))}
                    >
                      <SelectTrigger className="h-12 bg-secondary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6,7].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Длительность</Label>
                    <Select
                      value={String(form.avgWorkoutDurationMin)}
                      onValueChange={v => set("avgWorkoutDurationMin", Number(v))}
                    >
                      <SelectTrigger className="h-12 bg-secondary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { v: 30,  l: "30 мин"   },
                          { v: 45,  l: "45 мин"   },
                          { v: 60,  l: "1 час"    },
                          { v: 90,  l: "1.5 часа" },
                          { v: 120, l: "2+ часа"  },
                        ].map(o => (
                          <SelectItem key={o.v} value={String(o.v)}>{o.l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Цель в спорте</Label>
                  <RadioGroup
                    value={form.sportGoal}
                    onValueChange={v => set("sportGoal", v)}
                    className="flex flex-wrap gap-2"
                  >
                    {SPORT_GOALS.map(g => (
                      <label
                        key={g.id}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-all",
                          form.sportGoal === g.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary hover:bg-secondary/80 text-foreground"
                        )}
                      >
                        <RadioGroupItem value={g.id} className="sr-only" />
                        {g.label}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Шаг 5: Стресс ── */}
        {step === 5 && (
          <div className="space-y-8">
            <div className="text-center py-8">
              <span className={cn("text-7xl font-bold transition-colors", stressColor(form.baselineStress))}>
                {form.baselineStress}
              </span>
              <span className="text-2xl text-muted-foreground">/10</span>
              <p className={cn("text-xl font-medium mt-3 transition-colors", stressColor(form.baselineStress))}>
                {stressLabel(form.baselineStress)}
              </p>
            </div>

            <div className="space-y-4 px-4">
              <Slider
                value={[form.baselineStress]}
                onValueChange={([v]) => set("baselineStress", v)}
                min={1} max={10} step={1}
                className="py-4"
              />
              <div className="flex justify-between text-sm">
                <span className="text-emerald-400">Спокойствие</span>
                <span className="text-rose-400">Сильный стресс</span>
              </div>
            </div>

            <div className="bg-secondary/30 rounded-xl p-6 border border-border">
              <h3 className="font-medium mb-2">Что учитывает этот показатель?</h3>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>Общий уровень тревожности в последние недели</li>
                <li>Частота стрессовых ситуаций на работе/учёбе</li>
                <li>Качество эмоционального состояния</li>
                <li>Способность расслабляться и отдыхать</li>
              </ul>
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50 backdrop-blur-sm sticky bottom-0">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 1}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Назад
          </Button>

          {step < TOTAL_STEPS ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="gap-2"
            >
              Далее
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="gap-2"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Check className="w-4 h-4" />
              }
              {loading ? "Сохраняем..." : "Завершить"}
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
