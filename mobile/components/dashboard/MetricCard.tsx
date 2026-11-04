import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { BorderRadius, Spacing, FontSize, FontWeight } from '@/constants/theme'
import { useTheme } from '@/context/ThemeContext'
import { Sparkline } from './Sparkline'
import { ActivityRing, RingSpec } from './ActivityRing'
import { gradientColors } from '@/lib/colorUtils'

type IoniconsName = keyof typeof Ionicons.glyphMap

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon: IoniconsName
  href: string
  progress?: number
  sparklineData: number[]
  color: string
  colorMuted: string
  onAdd?: () => void
  /** Кольца прогресса (внешнее → внутреннее) вместо линейного progress-bar. */
  rings?: { progress: number; label: string }[]
}

// Фиксированная палитра поверх градиентного фона карточки — не зависит
// от темы приложения, т.к. фон теперь всегда насыщенно-цветной (в
// отличие от прежнего плоского colors.card, который менялся между
// светлой/тёмной темой).
const ON_GRADIENT = {
  text: '#fff',
  textMuted: 'rgba(255,255,255,0.75)',
  chipBg: 'rgba(255,255,255,0.18)',
  track: 'rgba(255,255,255,0.25)',
  fill: 'rgba(255,255,255,0.92)',
}

// Цвета колец фиксированы внутри компонента (не приходят снаружи) —
// гарантирует контраст на любом метрик-градиенте, независимо от того,
// какая метрика их использует.
const RING_SPECS: Omit<RingSpec, 'progress'>[] = [
  { color: 'rgba(255,255,255,0.95)', trackColor: 'rgba(255,255,255,0.25)', strokeWidth: 8 },
  { color: 'rgba(255,255,255,0.65)', trackColor: 'rgba(255,255,255,0.18)', strokeWidth: 6 },
]

function buildRingSpecs(rings: { progress: number; label: string }[]): RingSpec[] {
  return rings.map((r, i) => ({
    progress: Math.min(100, r.progress),
    ...(RING_SPECS[i] ?? RING_SPECS[RING_SPECS.length - 1]),
  }))
}

// Считает простой тренд по последним 6 точкам спарклайна (3 свежих vs 3 старых).
// Аналог веб-версии getTrend в metric-card.tsx.
function computeTrend(data: number[]): { dir: 'up' | 'down' | 'stable'; percent: number } {
  if (!data || data.length < 2) return { dir: 'stable', percent: 0 }
  const recent = data.slice(-3)
  const older = data.slice(-6, -3)
  if (recent.length === 0 || older.length === 0) return { dir: 'stable', percent: 0 }
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
  if (olderAvg === 0) return { dir: 'stable', percent: 0 }
  const change = ((recentAvg - olderAvg) / olderAvg) * 100
  if (Math.abs(change) < 5) return { dir: 'stable', percent: 0 }
  return { dir: change > 0 ? 'up' : 'down', percent: Math.abs(Math.round(change)) }
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  href,
  progress,
  sparklineData,
  color,
  colorMuted,
  onAdd,
  rings,
}: MetricCardProps) {
  const router = useRouter()
  const { isDark } = useTheme()
  const trend = useMemo(() => computeTrend(sparklineData), [sparklineData])
  const hasData = value !== '—' && value !== '--'
  const ringSpecs = useMemo(() => (rings ? buildRingSpecs(rings) : null), [rings])

  const styles = useMemo(() => StyleSheet.create({
    card: {
      borderRadius: BorderRadius.xxl,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
      padding: Spacing.lg,
      overflow: 'hidden',
      position: 'relative',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.15 : 0.08,
          shadowRadius: 12,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    gradientFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    content: {
      gap: Spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconWrapper: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ON_GRADIENT.chipBg,
    },
    actions: {
      flexDirection: 'row',
      gap: 6,
    },
    iconButton: {
      width: 32,
      height: 32,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ON_GRADIENT.chipBg,
    },
    titleRow: {},
    title: {
      color: ON_GRADIENT.textMuted,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.medium,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: Spacing.sm,
      marginTop: 4,
    },
    value: {
      color: ON_GRADIENT.text,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      letterSpacing: -0.5,
    },
    trendBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    trendText: {
      fontSize: FontSize.xs,
      fontWeight: FontWeight.medium,
      color: ON_GRADIENT.text,
    },
    progressBlock: {
      gap: 6,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    subtitle: {
      color: ON_GRADIENT.textMuted,
      fontSize: FontSize.xs,
    },
    progressPct: {
      color: ON_GRADIENT.textMuted,
      fontSize: FontSize.xs,
      fontVariant: ['tabular-nums'],
    },
    progressBar: {
      height: 6,
      backgroundColor: ON_GRADIENT.track,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: BorderRadius.full,
      backgroundColor: ON_GRADIENT.fill,
    },
    ringsBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    ringLegend: {
      flex: 1,
      gap: 4,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    legendLabel: {
      color: ON_GRADIENT.textMuted,
      fontSize: FontSize.xs,
      flexShrink: 1,
    },
  }), [isDark])

  const trendIcon =
    trend.dir === 'up' ? 'trending-up' : trend.dir === 'down' ? 'trending-down' : 'remove-outline'

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(href as any)}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={gradientColors(color)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientFill}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconWrapper}>
            <Ionicons name={icon} size={20} color={ON_GRADIENT.text} />
          </View>
          <View style={styles.actions}>
            {onAdd && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={(e) => {
                  e.stopPropagation()
                  onAdd()
                }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="add" size={16} color={ON_GRADIENT.text} />
              </TouchableOpacity>
            )}
            <View style={styles.iconButton}>
              <Ionicons name="arrow-up-outline" size={16} color={ON_GRADIENT.text} style={{ transform: [{ rotate: '45deg' }] }} />
            </View>
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{value}</Text>
            {hasData && trend.dir !== 'stable' && (
              <View style={styles.trendBadge}>
                <Ionicons name={trendIcon as IoniconsName} size={12} color={ON_GRADIENT.text} />
                <Text style={styles.trendText}>
                  {trend.percent}%
                </Text>
              </View>
            )}
          </View>
        </View>

        <Sparkline data={sparklineData} color="rgba(255,255,255,0.9)" />

        {ringSpecs ? (
          <View style={styles.ringsBlock}>
            <ActivityRing size={76} rings={ringSpecs} />
            <View style={styles.ringLegend}>
              {rings!.map((r, i) => (
                <View key={i} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: ringSpecs[i].color }]} />
                  <Text style={styles.legendLabel}>{r.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : progress !== undefined && (
          <View style={styles.progressBlock}>
            <View style={styles.progressRow}>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              {hasData && <Text style={styles.progressPct}>{Math.round(Math.min(100, progress))}%</Text>}
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%` }]} />
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}
