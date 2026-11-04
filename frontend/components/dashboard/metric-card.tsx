"use client"

import type { LucideIcon } from "lucide-react"
import { Plus, ArrowUpRight, TrendingUp, TrendingDown, Minus } from "lucide-react"
import Link from "next/link"

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  href: string
  progress?: number
  sparklineData: number[]
  color: string
  onAdd?: () => void
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * 100
      const y = 100 - ((val - min) / range) * 80 - 10
      return `${x},${y}`
    })
    .join(" ")

  const gradientId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-16 w-full">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${gradientId})`} points={`0,100 ${points} 100,100`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function getTrend(data: number[] | undefined): { direction: "up" | "down" | "stable"; percent: number } {
  if (!data || data.length < 2) return { direction: "stable", percent: 0 }

  const recent = data.slice(-3)
  const older = data.slice(-6, -3)
  if (recent.length === 0 || older.length === 0) return { direction: "stable", percent: 0 }

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
  if (olderAvg === 0) return { direction: "stable", percent: 0 }

  const change = ((recentAvg - olderAvg) / olderAvg) * 100
  if (Math.abs(change) < 5) return { direction: "stable", percent: 0 }
  return { direction: change > 0 ? "up" : "down", percent: Math.abs(Math.round(change)) }
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
  const clampedProgress = progress !== undefined ? Math.min(100, Math.max(0, progress)) : 0
  const trend = getTrend(sparklineData)
  const hasData = value !== "—" && value !== "--"

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-edge-soft bg-gradient-to-b from-surface-card to-transparent transition-all duration-500 hover:border-edge-strong hover:from-surface-hover">
      {/* Top accent line */}
      <div
        className="absolute left-0 right-0 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      {/* Ambient glow */}
      <div
        className="absolute -right-20 -top-20 h-40 w-40 rounded-full opacity-[0.07] blur-3xl transition-opacity duration-500 group-hover:opacity-[0.12]"
        style={{ backgroundColor: color }}
      />

      <div className="relative p-6">
        <div className="flex items-center justify-between">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-edge-soft"
            style={{ backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)` }}
          >
            <Icon className="h-5 w-5" style={{ color }} />
          </div>

          <div className="flex items-center gap-1.5">
            {onAdd && (
              <button
                type="button"
                aria-label={`Добавить ${title}`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onAdd()
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-edge-soft bg-surface-subtle text-foreground/40 transition-all hover:border-edge-strong hover:bg-surface-strong hover:text-foreground/70"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            <Link
              href={href}
              aria-label={`Открыть ${title}`}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-edge-soft bg-surface-subtle text-foreground/40 transition-all hover:border-edge-strong hover:bg-surface-strong hover:text-foreground/70"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm font-medium text-foreground/40">{title}</p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-3xl font-semibold tracking-tight text-foreground">{value}</span>
            {hasData && trend.direction !== "stable" && (
              <span
                className={`flex items-center gap-0.5 text-xs font-medium ${
                  trend.direction === "up" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {trend.direction === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.percent}%
              </span>
            )}
            {hasData && trend.direction === "stable" && (
              <span className="flex items-center gap-0.5 text-xs font-medium text-foreground/30">
                <Minus className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <div className="mt-4 -mx-6 px-6">
            <MiniSparkline data={sparklineData} color={color} />
          </div>
        )}

        {progress !== undefined && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              {subtitle && <span className="text-xs text-foreground/40">{subtitle}</span>}
              {hasData && (
                <span className="ml-auto font-mono text-xs text-foreground/50">
                  {Math.round(clampedProgress)}%
                </span>
              )}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-strong">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${clampedProgress}%`,
                  background: `linear-gradient(90deg, color-mix(in oklch, ${color} 60%, transparent), ${color})`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
