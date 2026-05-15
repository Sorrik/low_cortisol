"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Sparkles, ChevronRight } from "lucide-react"
import { getProfile as getOnboardingProfile } from "@/lib/onboarding-api"

/**
 * Баннер для юзеров, которые прошли онбординг ДО введения точных полей
 * age/weightKg/heightCm — у них в БД эти поля null, и расчёт калорий
 * идёт по популяционным средним. Просим уточнить профиль.
 *
 * Скрывается, если онбординг не пройден (тогда есть отдельный экран),
 * или если все точные поля уже заполнены.
 */
export function ProfileBackfillBanner() {
  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: getOnboardingProfile,
    staleTime: 1000 * 60 * 5,
  })

  if (!profile) return null
  if (!profile.onboardingCompleted) return null

  // Если все три точных поля есть — баннер не нужен
  const needsBackfill =
    profile.age == null ||
    profile.weightKg == null ||
    profile.heightCm == null

  if (!needsBackfill) return null

  return (
    <Link
      href="/onboarding"
      className="group mb-6 flex items-center gap-4 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/[0.08] to-orange-500/[0.04] px-5 py-4 transition-all hover:border-amber-500/50 hover:from-amber-500/[0.12]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20">
        <Sparkles className="h-5 w-5 text-amber-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          Уточните профиль для точного расчёта калорий
        </p>
        <p className="mt-0.5 text-xs text-foreground/50">
          Возраст, вес и рост дают индивидуальную норму по Mifflin-St Jeor
          вместо популяционной.
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/60" />
    </Link>
  )
}
