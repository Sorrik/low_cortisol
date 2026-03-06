"use client"

import type { LucideIcon } from "lucide-react"
import { Plus } from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkline } from "@/components/dashboard/sparkline"

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  href: string
  progress?: number
  sparklineData: number[]
  color: string
  onAdd?: () => void  // ← опциональный
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  progress,
  sparklineData,
  color,
  onAdd,
}: MetricCardProps) {
  return (
    <Card className="group relative border-border bg-card transition-colors hover:border-border/80">
      <CardContent className="flex flex-col gap-3 p-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)` }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
          </div>

          {/* Кнопка + только если onAdd передан */}
          {onAdd && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground transition-opacity hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100"
              onClick={(e) => {
                e.preventDefault()
                onAdd()
              }}
              aria-label={`Добавить ${title}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Value */}
        <Link href={href} className="block">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{value}</span>
            {subtitle && (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
          </div>
        </Link>

        {/* Progress bar */}
        {progress !== undefined && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: color,
              }}
            />
          </div>
        )}

        {/* Sparkline */}
        <Sparkline data={sparklineData} color={color} />
      </CardContent>
    </Card>
  )
}