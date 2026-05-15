"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  User, RefreshCw, Pencil, X, Check,
  Target, Moon, Activity, Brain, Zap, Flame,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { Slider }   from "@/components/ui/slider"
import { Badge }    from "@/components/ui/badge"
import { getProfile, updateProfile } from "@/lib/health-api"
import { getProfile as getOnboardingProfile, saveOnboardingStep } from "@/lib/onboarding-api"
import type { Profile } from "@/types/health"
import type { UserProfile } from "@/types/onboarding"
import {
  GOAL_CONFIG, CHRONOTYPE_CONFIG,
  ACTIVITY_CONFIG, SPORT_CONFIG, SPORT_GOAL_CONFIG,
  NUTRITION_GOAL_CONFIG, GENDER_LABELS,
} from "@/types/onboarding"

// ── Helpers ───────────────────────────────────────────────────

function getInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase()
}

// ── Page ──────────────────────────────────────────────────────

export default function ProfilePage() {
  const queryClient = useQueryClient()

  // ── Данные регистрации ────────────────────────────────────
  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
  } = useQuery({ queryKey: ["profile"], queryFn: getProfile })

  // ── Данные анкеты ─────────────────────────────────────────
  const {
    data: userProfile,
    isLoading: onboardingLoading,
  } = useQuery({ queryKey: ["user-profile"], queryFn: getOnboardingProfile })

  // ── Редактирование регистрационных данных ─────────────────
  const [editingAccount, setEditingAccount] = useState(false)
  const [accountDraft, setAccountDraft]     = useState<Partial<Profile>>({})

  const updateAccountMutation = useMutation({
    mutationFn: (updates: Partial<Profile>) => updateProfile(updates),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
      setEditingAccount(false)
      setAccountDraft({})
    },
  })

  function startEditAccount() {
    if (!profile) return
    setAccountDraft({
      firstName: profile.firstName,
      lastName:  profile.lastName,
      email:     profile.email,
      birthDate: profile.birthDate,
    })
    setEditingAccount(true)
  }

  // ── Редактирование стресса (шаг 5 анкеты) ────────────────
  const [editingStress, setEditingStress] = useState(false)
  const [stressDraft, setStressDraft]     = useState(5)

  const updateStressMutation = useMutation({
    mutationFn: (stress: number) => saveOnboardingStep(5, { baselineStress: stress }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] })
      setEditingStress(false)
    },
  })

  function startEditStress() {
    setStressDraft(userProfile?.baselineStress ?? 5)
    setEditingStress(true)
  }

  const isLoading = profileLoading || onboardingLoading

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <div className="h-8 w-32 animate-pulse rounded bg-secondary" />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-96 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    )
  }

  if (profileError || !profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Не удалось загрузить профиль.</p>
        <Button onClick={() => refetchProfile()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Повторить
        </Button>
      </div>
    )
  }

  const displayed = editingAccount ? { ...profile, ...accountDraft } : profile

  const stressColor = (v: number) =>
    v <= 4 ? "text-emerald-400" : v <= 6 ? "text-amber-400" : "text-rose-400"

  const stressLabel = (v: number) =>
    v <= 2 ? "Очень низкий" : v <= 4 ? "Низкий" : v <= 6 ? "Умеренный" : v <= 8 ? "Высокий" : "Очень высокий"

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8 max-w-3xl">

      {/* Заголовок */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
          <User className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Профиль</h1>
      </div>

      {/* ── Карточка 1: Данные аккаунта ── */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold text-foreground">
            Данные аккаунта
          </CardTitle>
          {!editingAccount && (
            <Button variant="ghost" size="sm" onClick={startEditAccount} className="gap-1.5 text-xs">
              <Pencil className="h-3.5 w-3.5" />
              Изменить
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-5">

          {/* Аватар */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
              {getInitials(displayed.firstName, displayed.lastName)}
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {`${displayed.firstName} ${displayed.lastName}`}
              </p>
              <p className="text-sm text-muted-foreground">{displayed.email}</p>
            </div>
          </div>

          {/* Поля */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Имя</Label>
              <Input
                value={displayed.firstName}
                onChange={e => setAccountDraft(d => ({ ...d, firstName: e.target.value }))}
                readOnly={!editingAccount}
                className="h-11 border-border bg-input text-foreground"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Фамилия</Label>
              <Input
                value={displayed.lastName}
                onChange={e => setAccountDraft(d => ({ ...d, lastName: e.target.value }))}
                readOnly={!editingAccount}
                className="h-11 border-border bg-input text-foreground"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Email</Label>
              <Input
                value={displayed.email}
                onChange={e => setAccountDraft(d => ({ ...d, email: e.target.value }))}
                readOnly={!editingAccount}
                type="email"
                className="h-11 border-border bg-input text-foreground"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Дата рождения</Label>
              <Input
                value={displayed.birthDate ?? ""}
                onChange={e => setAccountDraft(d => ({ ...d, birthDate: e.target.value }))}
                readOnly={!editingAccount}
                type="date"
                className="h-11 border-border bg-input text-foreground"
              />
            </div>
          </div>

          {/* Кнопки */}
          {editingAccount && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => { setEditingAccount(false); setAccountDraft({}) }}
                disabled={updateAccountMutation.isPending}
                className="gap-1.5"
              >
                <X className="h-4 w-4" />
                Отмена
              </Button>
              <Button
                size="sm"
                onClick={() => updateAccountMutation.mutate(accountDraft)}
                disabled={updateAccountMutation.isPending}
                className="gap-1.5"
              >
                <Check className="h-4 w-4" />
                {updateAccountMutation.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Карточка 2: Данные анкеты ── */}
      {userProfile?.onboardingCompleted && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground">
                Личный профиль здоровья
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Эти данные персонализируют ML-рекомендации. Можно обновить в любое время.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">

            {/* Тело и калории */}
            {(userProfile.age != null || userProfile.weightKg != null || userProfile.heightCm != null || userProfile.calorieTargets) && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Flame className="h-4 w-4 text-amber-400" />
                  Тело и калории
                </div>

                <div className="flex flex-wrap gap-2">
                  {userProfile.age != null && (
                    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Возраст: </span>
                      <span className="font-medium text-foreground">{userProfile.age} лет</span>
                    </div>
                  )}
                  {userProfile.weightKg != null && (
                    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Вес: </span>
                      <span className="font-medium text-foreground">{userProfile.weightKg} кг</span>
                    </div>
                  )}
                  {userProfile.heightCm != null && (
                    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Рост: </span>
                      <span className="font-medium text-foreground">{userProfile.heightCm} см</span>
                    </div>
                  )}
                  {userProfile.gender && (
                    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Пол: </span>
                      <span className="font-medium text-foreground">{GENDER_LABELS[userProfile.gender]}</span>
                    </div>
                  )}
                </div>

                {userProfile.nutritionGoal && (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1.5">
                      {NUTRITION_GOAL_CONFIG[userProfile.nutritionGoal].icon}{" "}
                      {NUTRITION_GOAL_CONFIG[userProfile.nutritionGoal].label}
                    </Badge>
                    <span className="text-xs text-muted-foreground self-center">
                      {NUTRITION_GOAL_CONFIG[userProfile.nutritionGoal].desc}
                    </span>
                  </div>
                )}

                {userProfile.calorieTargets && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-3xl font-bold text-amber-400">
                        {userProfile.calorieTargets.targetCalories}
                      </span>
                      <span className="text-sm text-muted-foreground">ккал/день — ваша цель</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <div>
                        <span>BMR (покой): </span>
                        <span className="text-foreground font-medium">{userProfile.calorieTargets.bmr}</span>
                      </div>
                      <div>
                        <span>TDEE (расход): </span>
                        <span className="text-foreground font-medium">{userProfile.calorieTargets.tdee}</span>
                      </div>
                      <div>
                        <span>Мин.: </span>
                        <span className="text-foreground font-medium">{userProfile.calorieTargets.minCalories}</span>
                      </div>
                      <div>
                        <span>Макс.: </span>
                        <span className="text-foreground font-medium">{userProfile.calorieTargets.maxCalories}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Рассчитано по формуле Mifflin-St Jeor с учётом активности и цели по питанию.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Цели */}
            {(userProfile.goals?.length > 0) && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Target className="h-4 w-4 text-primary" />
                  Цели
                </div>
                <div className="flex flex-wrap gap-2">
                  {userProfile.goals.map(goal => {
                    const cfg = GOAL_CONFIG[goal]
                    return (
                      <Badge
                        key={goal}
                        variant={userProfile.primaryGoal === goal ? "default" : "secondary"}
                        className="gap-1.5"
                      >
                        {cfg.icon} {cfg.label}
                        {userProfile.primaryGoal === goal && (
                          <span className="text-[10px] opacity-70 ml-0.5">главная</span>
                        )}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Сон */}
            {userProfile.chronotype && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Moon className="h-4 w-4 text-indigo-400" />
                  Режим сна
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-sm">
                    <span className="text-muted-foreground">Хронотип: </span>
                    <span className="font-medium text-foreground">
                      {CHRONOTYPE_CONFIG[userProfile.chronotype]?.label}
                    </span>
                  </div>
                  {userProfile.sleepGoalHours && (
                    <div className="rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-sm">
                      <span className="text-muted-foreground">Цель: </span>
                      <span className="font-medium text-foreground">
                        {userProfile.sleepGoalHours} ч
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Активность */}
            {userProfile.activityLevel && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Activity className="h-4 w-4 text-orange-400" />
                  Активность
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-sm">
                    <span className="font-medium text-foreground">
                      {ACTIVITY_CONFIG[userProfile.activityLevel]?.icon}{" "}
                      {ACTIVITY_CONFIG[userProfile.activityLevel]?.label}
                    </span>
                  </div>
                  {(userProfile.workoutsPerWeek ?? 0) > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {userProfile.workoutsPerWeek}×/нед · {userProfile.avgWorkoutDurationMin} мин
                    </span>
                  )}
                </div>

                {/* Виды спорта */}
                {(userProfile.sportTypes?.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {userProfile.sportTypes.map(s => (
                      <Badge key={s} variant="outline" className="text-xs gap-1">
                        {SPORT_CONFIG[s]?.icon} {SPORT_CONFIG[s]?.label}
                      </Badge>
                    ))}
                  </div>
                )}

                {userProfile.sportGoal && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Цель в спорте:{" "}
                    <span className="text-foreground">
                      {SPORT_GOAL_CONFIG[userProfile.sportGoal as keyof typeof SPORT_GOAL_CONFIG]?.label}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Стресс — единственное что легко обновить */}
            {userProfile.baselineStress != null && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Brain className="h-4 w-4 text-rose-400" />
                    Базовый уровень стресса
                  </div>
                  {!editingStress && (
                    <Button variant="ghost" size="sm" onClick={startEditStress} className="gap-1 text-xs h-7">
                      <Pencil className="h-3 w-3" />
                      Обновить
                    </Button>
                  )}
                </div>

                {editingStress ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-3xl font-bold ${stressColor(stressDraft)}`}>
                        {stressDraft}
                      </span>
                      <span className={`text-sm ${stressColor(stressDraft)}`}>
                        {stressLabel(stressDraft)}
                      </span>
                    </div>
                    <Slider
                      value={[stressDraft]}
                      onValueChange={([v]) => setStressDraft(v)}
                      min={1} max={10} step={1}
                      className="py-2"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setEditingStress(false)}
                        className="gap-1.5"
                      >
                        <X className="h-3.5 w-3.5" />
                        Отмена
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateStressMutation.mutate(stressDraft)}
                        disabled={updateStressMutation.isPending}
                        className="gap-1.5"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Сохранить
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className={`text-3xl font-bold ${stressColor(userProfile.baselineStress)}`}>
                      {userProfile.baselineStress}
                    </span>
                    <span className="text-sm text-muted-foreground">/10</span>
                    <span className={`text-sm ${stressColor(userProfile.baselineStress)}`}>
                      — {stressLabel(userProfile.baselineStress)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Ссылка на полное переанкетирование */}
            <div className="border-t border-border/50 pt-4">
              <p className="text-xs text-muted-foreground mb-2">
                Хотите обновить цели, режим сна или активность?
              </p>
              <Button
                variant="outline" size="sm"
                onClick={() => window.location.href = "/onboarding"}
                className="gap-2 text-xs"
              >
                <Zap className="h-3.5 w-3.5" />
                Пройти анкету заново
              </Button>
            </div>

          </CardContent>
        </Card>
      )}

      {/* Если онбординг не пройден */}
      {!userProfile?.onboardingCompleted && !onboardingLoading && (
        <Card className="border-dashed border-border bg-card">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Zap className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Анкета не заполнена</p>
              <p className="text-sm text-muted-foreground">
                Заполните профиль здоровья — это персонализирует рекомендации и ML-прогнозы
              </p>
            </div>
            <Button onClick={() => window.location.href = "/onboarding"} className="gap-2">
              <Zap className="h-4 w-4" />
              Заполнить анкету
            </Button>
          </CardContent>
        </Card>
      )}

    </div>
  )
}