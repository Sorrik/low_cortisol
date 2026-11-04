// Атомы для страниц метрик на мобилке — мобильный аналог
// metric-page-shell.tsx с веба: единый визуальный язык, не дублируется
// в каждой странице. Используем мобильную палитру (colors.sleep, colors.water
// и т.д.) — НЕ синхронизируем с oklch с веба.

import React, { useMemo, useRef, useEffect } from 'react'
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme'
import { useTheme } from '@/context/ThemeContext'
import { useThemedStyles, type ColorPalette } from '@/lib/useThemedStyles'

type IoniconsName = keyof typeof Ionicons.glyphMap

// ── Утилита: тренд по последним 6 точкам ──────────────────────────
export function computeTrend(
  data: number[],
): { dir: 'up' | 'down' | 'stable'; percent: number } {
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

// ── Wrapper-карточка с акцент-линией сверху и опциональным glow-blob
// Используется для hero/chart/history секций. На свете даёт мягкую тень.
export function AccentCard({
  color,
  withGlow = false,
  style,
  children,
}: {
  color?: string
  withGlow?: boolean
  style?: any
  children: React.ReactNode
}) {
  const styles = useThemedStyles(createAtomStyles)
  return (
    <View style={[styles.accentCard, style]}>
      {color ? (
        <LinearGradient
          colors={['transparent', color, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentLine}
        />
      ) : null}
      {withGlow && color ? (
        <View style={[styles.glow, { backgroundColor: color }]} />
      ) : null}
      {children}
    </View>
  )
}

// ── Hero: большая иконка + title + subtitle + основное действие ───
export function MetricHero({
  icon,
  title,
  subtitle,
  color,
  colorMuted,
  hasTodayRecord,
  onAction,
  actionLabel,
  children,
}: {
  icon: IoniconsName
  title: string
  subtitle?: React.ReactNode
  color: string
  colorMuted: string
  hasTodayRecord?: boolean
  onAction?: () => void
  actionLabel?: string
  children?: React.ReactNode
}) {
  const styles = useThemedStyles(createAtomStyles)
  const { colors } = useTheme()

  return (
    <AccentCard color={color} withGlow style={styles.hero}>
      <View style={styles.heroHeader}>
        <View style={styles.heroLeft}>
          <View style={[styles.heroIcon, { backgroundColor: colorMuted, borderColor: colors.border }]}>
            <Ionicons name={icon} size={28} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{title}</Text>
            {typeof subtitle === 'string' ? (
              <Text style={styles.heroSubtitle}>{subtitle}</Text>
            ) : (
              subtitle
            )}
          </View>
        </View>
      </View>

      {onAction ? (
        <TouchableOpacity activeOpacity={0.85} onPress={onAction} style={styles.heroActionWrap}>
          <LinearGradient
            colors={[color, color]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroAction}
          >
            <Ionicons name={hasTodayRecord ? 'pencil' : 'add'} size={18} color="#fff" />
            <Text style={styles.heroActionText}>
              {actionLabel ?? (hasTodayRecord ? 'Изменить сегодня' : 'Добавить запись')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : null}

      {children}
    </AccentCard>
  )
}

// ── StatCard: цифра + лейбл + хинт. accent красит число, icon — опционально
export function StatCard({
  label,
  value,
  hint,
  accent,
  icon,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  accent?: string
  icon?: IoniconsName
}) {
  const styles = useThemedStyles(createAtomStyles)
  const { colors } = useTheme()
  return (
    <View style={styles.statCard}>
      <View style={styles.statTopRow}>
        <Text style={styles.statLabel}>{label}</Text>
        {icon ? <Ionicons name={icon} size={14} color={colors.mutedForeground} /> : null}
      </View>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  )
}

// ── TrendCard: тренд %, иконка, цвет. invert=true → вниз=хорошо (стресс)
export function TrendCard({
  trend,
  percent,
  inverted = false,
}: {
  trend: 'up' | 'down' | 'stable'
  percent: number
  inverted?: boolean
}) {
  const styles = useThemedStyles(createAtomStyles)
  const { colors } = useTheme()

  const goodIsUp = !inverted
  const isGood = trend === 'stable' ? null : goodIsUp ? trend === 'up' : trend === 'down'
  const color =
    isGood === null
      ? colors.mutedForeground
      : isGood
        ? colors.success
        : colors.destructive

  const iconName: IoniconsName =
    trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove-outline'

  const label =
    trend === 'stable' ? 'Стабильно' : `${trend === 'up' ? '+' : '-'}${percent}%`

  const hint =
    trend === 'stable'
      ? 'Без изменений'
      : (inverted ? trend === 'up' : trend === 'down')
        ? 'Падает — хорошо'
        : (inverted ? trend === 'down' : trend === 'up')
          ? 'Растёт — хорошо'
          : trend === 'up'
            ? 'Растёт'
            : 'Падает'

  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>Тренд</Text>
      <View style={styles.trendValueRow}>
        <Ionicons name={iconName} size={18} color={color} />
        <Text style={[styles.statValue, { color }]}>{label}</Text>
      </View>
      <Text style={styles.statHint}>{hint}</Text>
    </View>
  )
}

// ── StatRow: 3 равных по ширине карточки в ряд ───────────────────
export function StatRow({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(createAtomStyles)
  return <View style={styles.statRow}>{children}</View>
}

// ── Section header для коллапсируемой истории/чарта ──────────────
export function SectionHeader({
  title,
  count,
  trailing,
}: {
  title: string
  count?: number
  trailing?: React.ReactNode
}) {
  const styles = useThemedStyles(createAtomStyles)
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLeft}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count != null ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        ) : null}
      </View>
      {trailing}
    </View>
  )
}

const createAtomStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    accentCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.xxl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      position: 'relative',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 12,
        },
        android: { elevation: 2 },
      }),
    },
    accentLine: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      opacity: 0.75,
    },
    glow: {
      position: 'absolute',
      top: -80,
      right: -80,
      width: 200,
      height: 200,
      borderRadius: 100,
      opacity: 0.10,
    },
    hero: {
      padding: Spacing.lg,
      gap: Spacing.lg,
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    heroLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    heroIcon: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    heroTitle: {
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    heroSubtitle: {
      fontSize: FontSize.sm,
      color: colors.mutedForeground,
      marginTop: 4,
    },
    heroActionWrap: {
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    },
    heroAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: 14,
      paddingHorizontal: Spacing.lg,
    },
    heroActionText: {
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: '#fff',
    },
    statRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      gap: 6,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.03,
          shadowRadius: 6,
        },
        android: { elevation: 1 },
      }),
    },
    statTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statLabel: {
      fontSize: FontSize.xs,
      color: colors.mutedForeground,
      fontWeight: FontWeight.medium,
    },
    statValue: {
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    statHint: {
      fontSize: 10,
      color: colors.mutedForeground,
    },
    trendValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    sectionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    sectionTitle: {
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.foreground,
    },
    countBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.cardHover,
    },
    countText: {
      fontSize: FontSize.xs,
      fontWeight: FontWeight.medium,
      color: colors.mutedForeground,
    },
  })
