import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Colors, BorderRadius, Spacing, FontSize, FontWeight } from '@/constants/theme'
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
  const [activeTab, setActiveTab] = useState<'any' | 'all' | 'goals'>('any')

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
              color={activeStreak.current > 0 ? Colors.streak : Colors.mutedForeground}
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
          <Ionicons name="trophy" size={14} color={Colors.gold} />
          <Text style={styles.achievementsText}>Ачивки</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.mutedForeground} />
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
          color={Colors.streak}
          height={8}
        />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Level + Badges */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <View style={styles.statHeader}>
            <Ionicons name="trending-up" size={16} color={Colors.primary} />
            <Text style={styles.statLabel}>Уровень</Text>
          </View>
          <Text style={styles.statValue}>{levelInfo.name}</Text>
          <View style={styles.statProgressRow}>
            <ProgressBar progress={levelProgress} height={6} />
            <Text style={styles.statXp}>{levelInfo.xp}/{levelInfo.nextLevelXp}</Text>
          </View>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <View style={styles.statHeader}>
            <Ionicons name="trophy" size={16} color={Colors.gold} />
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  skeleton: {
    height: 200,
    backgroundColor: Colors.card,
  },
  skeletonInner: {
    flex: 1,
    backgroundColor: Colors.secondary,
    margin: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperFire: {
    backgroundColor: Colors.streakMuted,
  },
  fireBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  valueLabel: {
    fontSize: FontSize.sm,
    color: Colors.mutedForeground,
  },
  bestText: {
    fontSize: FontSize.xs,
    color: Colors.mutedForeground,
  },
  achievementsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  achievementsText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.mutedForeground,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  tabActive: {
    backgroundColor: Colors.card,
  },
  tabText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.mutedForeground,
  },
  tabTextActive: {
    color: Colors.foreground,
  },
  progressSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  progressLabel: {
    fontSize: FontSize.xs,
    color: Colors.mutedForeground,
  },
  progressRemaining: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.streak,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statItem: {
    flex: 1,
    padding: Spacing.lg,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.mutedForeground,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
    marginBottom: Spacing.sm,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  statValueSecondary: {
    fontSize: FontSize.xs,
    color: Colors.mutedForeground,
  },
  statProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statXp: {
    fontSize: 10,
    color: Colors.mutedForeground,
  },
})
