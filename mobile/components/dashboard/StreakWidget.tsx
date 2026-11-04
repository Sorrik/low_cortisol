import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { BorderRadius, Spacing, FontSize, FontWeight } from '@/constants/theme'
import { useTheme } from '@/context/ThemeContext'
import { getFullStreakData, getUserLevel, getAchievements } from '@/lib/health-api'
import { STREAK_MILESTONES } from '@/types/health'
import { ProgressBar } from './ProgressBar'

function getDayWord(n: number): string {
  if (n === 1) return 'день'
  if (n >= 2 && n <= 4) return 'дня'
  return 'дней'
}

export function StreakWidget() {
  const router = useRouter()
  const { colors } = useTheme()
  const [activeTab, setActiveTab] = useState<'any' | 'all' | 'goals'>('any')

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    skeleton: { height: 200, backgroundColor: colors.card },
    skeletonInner: {
      flex: 1,
      backgroundColor: colors.secondary,
      margin: Spacing.lg,
      borderRadius: BorderRadius.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: Spacing.lg,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    iconWrapper: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapperFire: { backgroundColor: colors.streakMuted },
    fireBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    value: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: colors.foreground },
    valueLabel: { fontSize: FontSize.sm, color: colors.mutedForeground },
    bestText: { fontSize: FontSize.xs, color: colors.mutedForeground },
    achievementsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.secondary,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderRadius: BorderRadius.md,
    },
    achievementsText: {
      fontSize: FontSize.xs,
      fontWeight: FontWeight.medium,
      color: colors.mutedForeground,
    },
    tabs: {
      flexDirection: 'row',
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
      backgroundColor: colors.secondary,
      borderRadius: BorderRadius.md,
      padding: 4,
    },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: BorderRadius.sm },
    tabActive: { backgroundColor: colors.card },
    tabText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: colors.mutedForeground },
    tabTextActive: { color: colors.foreground },
    progressSection: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
    progressLabel: { fontSize: FontSize.xs, color: colors.mutedForeground },
    progressRemaining: {
      fontSize: FontSize.xs,
      fontWeight: FontWeight.medium,
      color: colors.streak,
    },
    divider: { height: 1, backgroundColor: colors.border },
    statsRow: { flexDirection: 'row' },
    statItem: { flex: 1, padding: Spacing.lg },
    statDivider: { width: 1, backgroundColor: colors.border },
    statHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    statLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: colors.mutedForeground },
    statValue: {
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.foreground,
      marginBottom: Spacing.sm,
    },
    statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: Spacing.sm },
    statValueSecondary: { fontSize: FontSize.xs, color: colors.mutedForeground },
    statProgressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    statProgressBar: { flex: 1, minWidth: 0 },
    statXp: { fontSize: 10, color: colors.mutedForeground, flexShrink: 0 },
  }), [colors])

  const { data: streakData, isLoading: loadingStreak } = useQuery({
    queryKey: ['fullStreak'],
    queryFn: getFullStreakData,
    staleTime: 1000 * 60 * 5,
  })

  const { data: levelInfo, isLoading: loadingLevel } = useQuery({
    queryKey: ['userLevel'],
    queryFn: getUserLevel,
    staleTime: 1000 * 60 * 5,
  })

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: getAchievements,
    staleTime: 1000 * 60 * 5,
  })

  if (loadingStreak || loadingLevel || !streakData || !levelInfo) {
    return (
      <View style={[styles.card, styles.skeleton]}>
        <View style={styles.skeletonInner} />
      </View>
    )
  }

  const tabs = [
    { id: 'any' as const, label: 'Данные', streak: streakData.anyData },
    { id: 'all' as const, label: '6 метрик', streak: streakData.allMetrics },
    { id: 'goals' as const, label: 'Норма', streak: streakData.goalsMet },
  ]

  const activeStreak = tabs.find(t => t.id === activeTab)!.streak
  const nextMilestone = STREAK_MILESTONES.find(t => t > activeStreak.current) ?? 100
  const prevMilestone = [...STREAK_MILESTONES].reverse().find(t => t <= activeStreak.current) ?? 0
  const milestoneProgress = ((activeStreak.current - prevMilestone) / (nextMilestone - prevMilestone)) * 100

  const levelProgress = (levelInfo.xp / levelInfo.nextLevelXp) * 100
  const unlockedBadges = achievements.filter(a => a.unlockedAt).length
  const totalBadges = achievements.length
  const isOnFire = activeStreak.current >= 7

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrapper, isOnFire && styles.iconWrapperFire]}>
            <Ionicons
              name="flame"
              size={24}
              color={activeStreak.current > 0 ? colors.streak : colors.mutedForeground}
            />
            {isOnFire && (
              <View style={styles.fireBadge}>
                <Ionicons name="sparkles" size={10} color="#78350f" />
              </View>
            )}
          </View>
          <View>
            <View style={styles.valueRow}>
              <Text style={styles.value}>{activeStreak.current}</Text>
              <Text style={styles.valueLabel}>{getDayWord(activeStreak.current)}</Text>
            </View>
            <Text style={styles.bestText}>
              Лучший: {activeStreak.best} {getDayWord(activeStreak.best)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.achievementsButton}
          onPress={() => router.push('/(tabs)/achievements')}
        >
          <Ionicons name="trophy" size={14} color={colors.gold} />
          <Text style={styles.achievementsText}>Ачивки</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Progress to next milestone */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>
            До {nextMilestone} {getDayWord(nextMilestone)}
          </Text>
          <Text style={styles.progressRemaining}>
            +{nextMilestone - activeStreak.current}
          </Text>
        </View>
        <ProgressBar
          progress={milestoneProgress}
          color={colors.streak}
          height={8}
        />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Level + Badges */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <View style={styles.statHeader}>
            <Ionicons name="trending-up" size={16} color={colors.primary} />
            <Text style={styles.statLabel}>Уровень</Text>
          </View>
          <Text style={styles.statValue}>{levelInfo.name}</Text>
          <View style={styles.statProgressRow}>
            <View style={styles.statProgressBar}>
              <ProgressBar progress={levelProgress} height={6} />
            </View>
            <Text
              style={styles.statXp}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {levelInfo.xp}/{levelInfo.nextLevelXp}
            </Text>
          </View>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <View style={styles.statHeader}>
            <Ionicons name="trophy" size={16} color={colors.gold} />
            <Text style={styles.statLabel}>Ачивки</Text>
          </View>
          <View style={styles.statValueRow}>
            <Text style={styles.statValue}>{unlockedBadges}</Text>
            <Text style={styles.statValueSecondary}>из {totalBadges}</Text>
          </View>
          <ProgressBar
            progress={totalBadges > 0 ? (unlockedBadges / totalBadges) * 100 : 0}
            height={6}
          />
        </View>
      </View>
    </View>
  )
}

