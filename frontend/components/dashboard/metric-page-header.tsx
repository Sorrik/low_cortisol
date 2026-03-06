"use client"

import type { LucideIcon } from "lucide-react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MetricPageHeaderProps {
  title: string
  icon: LucideIcon
  color: string
  onAdd: () => void
}

export function MetricPageHeader({ title, icon: Icon, color, onAdd }: MetricPageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      </div>
      <Button onClick={onAdd} className="gap-2 font-semibold">
        <Plus className="h-4 w-4" />
        {"Добавить"}
      </Button>
    </div>
  )
}
