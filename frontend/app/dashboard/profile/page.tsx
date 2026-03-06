"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { User, RefreshCw, Pencil, X, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getProfile, updateProfile } from "@/lib/health-api"
import type { Profile } from "@/types/health"

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
}

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Profile>>({})
  const queryClient = useQueryClient()

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn:  getProfile,
  })

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Profile>) => updateProfile(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
      setIsEditing(false)
      setDraft({})
    },
    onError: () => {
      alert("Не удалось сохранить изменения")
    },
  })

  function handleEdit() {
    if (!profile) return
    setDraft({
      firstName: profile.firstName,
      lastName:  profile.lastName,
      email:     profile.email,
      birthDate: profile.birthDate,
    })
    setIsEditing(true)
  }

  function handleCancel() {
    setDraft({})
    setIsEditing(false)
  }

  function handleSave() {
    updateMutation.mutate(draft)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-secondary" />
          <div className="h-8 w-32 animate-pulse rounded-md bg-secondary" />
        </div>
        <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
      </div>
    )
  }

  if (isError || !profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-destructive-foreground">{"Не удалось загрузить профиль."}</p>
        <Button onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {"Повторить"}
        </Button>
      </div>
    )
  }

  const displayed = isEditing
    ? { ...profile, ...draft }
    : profile

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
          <User className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{"Профиль"}</h1>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">{"Личные данные"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Avatar + name */}
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

          {/* Fields */}
          <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-secondary-foreground">{"Имя"}</Label>
              <Input
                value={displayed.firstName}
                onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
                readOnly={!isEditing}
                className="h-11 border-border bg-input text-foreground"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-secondary-foreground">{"Фамилия"}</Label>
              <Input
                value={displayed.lastName}
                onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
                readOnly={!isEditing}
                className="h-11 border-border bg-input text-foreground"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-secondary-foreground">{"Email"}</Label>
              <Input
                value={displayed.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                readOnly={!isEditing}
                type="email"
                className="h-11 border-border bg-input text-foreground"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-secondary-foreground">{"Дата рождения"}</Label>
              <Input
                value={displayed.birthDate}
                onChange={(e) => setDraft((d) => ({ ...d, birthDate: e.target.value }))}
                readOnly={!isEditing}
                type="date"
                className="h-11 border-border bg-input text-foreground"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updateMutation.isPending}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  {"Отмена"}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="gap-2 font-semibold"
                >
                  <Check className="h-4 w-4" />
                  {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
                </Button>
              </>
            ) : (
              <Button onClick={handleEdit} className="gap-2 font-semibold">
                <Pencil className="h-4 w-4" />
                {"Редактировать"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}