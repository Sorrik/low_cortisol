// app/(tabs)/achievements.tsx
import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { useThemedStyles, ColorPalette } from '@/lib/useThemedStyles';
import { useTheme } from '@/context/ThemeContext';

import { getAchievements, getFullStreakData, getUserLevel } from '@/lib/health-api';
import { ProgressBar } from '@/components/dashboard/ProgressBar';
import type { Achievement, FullStreakData, UserLevelInfo } from '@/types/health';
import { STREAK_MILESTONES, LEVEL_CONFIG } from '@/types/health';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Icon map for achievements
const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  flame: 'flame',
  moon: 'moon',
  droplets: 'water',
  smile: 'happy',
  brain: 'bulb',
  'trending-up': 'trending-up',
  'trending-down': 'trending-down',
  target: 'checkmark-circle',
  user: 'person',
  award: 'ribbon',
  star: 'star',
  crown: 'trophy',
  zap: 'flash',
  'bar-chart': 'bar-chart',
  footprints: 'footsteps',
  'layout-grid': 'grid',
  activity: 'pulse',
};

// Category config
const categoryConfig: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  streak: { label: 'Стрики', icon: 'flame', color: '#fb923c' },
  goal: { label: 'Цели', icon: 'checkmark-circle', color: '#34d399' },
  improvement: { label: 'Улучшения', icon: 'trending-up', color: '#60a5fa' },
  anomaly: { label: 'Аномалии', icon: 'pulse', color: '#a78bfa' },
  level: { label: 'Уровни', icon: 'ribbon', color: '#fbbf24' },
};

// Rarity config
const rarityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  common: { label: 'Обычный', color: '#71717a', bgColor: 'rgba(113,113,122,0.1)' },
  rare: { label: 'Редкий', color: '#60a5fa', bgColor: 'rgba(96,165,250,0.1)' },
  epic: { label: 'Эпический', color: '#a78bfa', bgColor: 'rgba(167,139,250,0.1)' },
  legendary: { label: 'Легендарный', color: '#fbbf24', bgColor: 'rgba(251,191,36,0.1)' },
};

// Helpers
function getDayWord(n: number): string {
  if (n === 1) return 'день';
  if (n >= 2 && n <= 4) return 'дня';
  return 'дней';
}

// Animated Card Wrapper
function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 50, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, tension: 60, friction: 9, delay: index * 50, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 60, friction: 9, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, [index]);

  return (
    <Animated.View style={[style, { opacity: fadeAnim, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}

// Streak Card
function StreakCard({ 
  title, description, current, best, icon, color, index 
}: {
  title: string; description: string; current: number; best: number;
  icon: keyof typeof Ionicons.glyphMap; color: string; index: number;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const nextMilestone = STREAK_MILESTONES.find(t => t > current) ?? 100;
  const progress = (current / nextMilestone) * 100;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start();
  };

  return (
    <AnimatedCard index={index}>
      <TouchableOpacity activeOpacity={1} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View style={[styles.streakCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.streakHeader}>
            <View style={[styles.streakIconBg, { backgroundColor: color + '20' }]}>
              <Ionicons name={icon} size={24} color={color} />
            </View>
            <View style={styles.streakTextWrapper}>
              <Text style={styles.streakTitle}>{title}</Text>
              <Text style={styles.streakDescription}>{description}</Text>
            </View>
          </View>

          <View style={styles.streakValueRow}>
            <Text style={styles.streakValue}>{current}</Text>
            <Text style={styles.streakUnit}>{getDayWord(current)}</Text>
          </View>

          <Text style={styles.streakBest}>
            Лучший результат: {best} {getDayWord(best)}
          </Text>

          <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabelLeft}>
                До {nextMilestone} {getDayWord(nextMilestone)}
              </Text>
              <Text style={styles.progressLabelRight}>{nextMilestone - current} осталось</Text>
            </View>
            <ProgressBar progress={progress} height={6} />
          </View>
        </Animated.View>
      </TouchableOpacity>
    </AnimatedCard>
  );
}

// Level Card
function LevelCard({ levelInfo, index }: { levelInfo: UserLevelInfo; index: number }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const progress = (levelInfo.xp / levelInfo.nextLevelXp) * 100;
  const levels = Object.entries(LEVEL_CONFIG);
  const curIdx = levels.findIndex(([key]) => key === levelInfo.level);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start();
  };

  return (
    <AnimatedCard index={index}>
      <TouchableOpacity activeOpacity={1} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View style={[styles.levelCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.levelHeader}>
            <View style={styles.levelLeft}>
              <View style={styles.levelIconBg}>
                <Ionicons name="trending-up" size={28} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.levelLabel}>Ваш уровень</Text>
                <Text style={styles.levelName}>{levelInfo.name}</Text>
              </View>
            </View>
            <View style={styles.levelRight}>
              <Text style={styles.xpLabel}>Всего XP</Text>
              <Text style={styles.xpValue}>{levelInfo.totalXp}</Text>
            </View>
          </View>

          <View style={styles.levelProgress}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabelLeft}>До следующего уровня</Text>
              <Text style={styles.levelProgressValue}>{levelInfo.nextLevelXp - levelInfo.xp} XP</Text>
            </View>
            <View style={styles.levelProgressBar}>
              <View style={[styles.levelProgressFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <View style={styles.levelSteps}>
            {levels.map(([key, config], idx) => {
              const isUnlocked = idx <= curIdx;
              const isCurrent = idx === curIdx;
              return (
                <View key={key} style={[styles.levelStep, isCurrent && styles.levelStepCurrent]}>
                  <View style={[styles.levelStepIcon, isUnlocked ? styles.levelStepUnlocked : styles.levelStepLocked]}>
                    {isUnlocked ? (
                      <Ionicons name="checkmark-circle" size={16} color={isCurrent ? colors.primary : colors.primary + '90'} />
                    ) : (
                      <Ionicons name="lock-closed" size={12} color={colors.mutedForeground} />
                    )}
                  </View>
                  <Text style={[styles.levelStepText, isCurrent && styles.levelStepTextCurrent]}>
                    {config.name}
                  </Text>
                </View>
              );
            })}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </AnimatedCard>
  );
}

// Badge Card
function BadgeCard({ badge, index }: { badge: Achievement; index: number }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const iconName = iconMap[badge.icon] ?? 'ribbon';
  const rarity = rarityConfig[badge.rarity] ?? rarityConfig.common;
  const progress = Math.min((badge.progress / badge.maxProgress) * 100, 100);
  const isUnlocked = !!badge.unlockedAt;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start();
  };

  return (
    <AnimatedCard index={index} style={styles.badgeCardWrapper}>
      <TouchableOpacity activeOpacity={1} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View
          style={[
            styles.badgeCard,
            { transform: [{ scale: scaleAnim }] },
            isUnlocked
              ? { backgroundColor: rarity.bgColor, borderColor: rarity.color + '40' }
              : { backgroundColor: colors.card + '80', borderColor: colors.border },
          ]}
        >
          {!isUnlocked && (
            <View style={styles.badgeLockOverlay}>
              <Ionicons name="lock-closed" size={24} color={colors.mutedForeground} />
            </View>
          )}

          <View style={styles.badgeHeader}>
            <View style={[styles.badgeIconBg, { backgroundColor: isUnlocked ? rarity.bgColor : colors.cardHover }]}>
              <Ionicons name={iconName} size={20} color={isUnlocked ? rarity.color : colors.mutedForeground} />
            </View>
            <View style={styles.badgeTextWrapper}>
              <View style={styles.badgeTitleRow}>
                <Text style={styles.badgeTitle} numberOfLines={1}>{badge.title}</Text>
                {isUnlocked && <Ionicons name="sparkles" size={14} color={rarity.color} />}
              </View>
              <Text style={styles.badgeDescription} numberOfLines={2}>{badge.description}</Text>
            </View>
          </View>

          <View style={styles.badgeProgressSection}>
            <View style={styles.badgeProgressLabels}>
              <Text style={styles.badgeProgressText}>{badge.progress}/{badge.maxProgress}</Text>
              <Text style={[styles.badgeXp, { color: isUnlocked ? rarity.color : colors.mutedForeground }]}>
                +{badge.points} XP
              </Text>
            </View>
            <View style={styles.badgeProgressBar}>
              <View
                style={[
                  styles.badgeProgressFill,
                  { width: `${progress}%`, backgroundColor: isUnlocked ? colors.primary : colors.mutedForeground + '60' },
                ]}
              />
            </View>
          </View>

          {isUnlocked && badge.unlockedAt && (
            <View style={styles.badgeFooter}>
              <View style={[styles.rarityBadge, { backgroundColor: rarity.bgColor }]}>
                <Text style={[styles.rarityText, { color: rarity.color }]}>{rarity.label}</Text>
              </View>
              <Text style={styles.badgeDate}>
                {new Date(badge.unlockedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </AnimatedCard>
  );
}

// Filter Chip
function FilterChip({ 
  label, count, active, onPress, icon, color 
}: {
  label: string; count: number; active: boolean; onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap; color?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start();
  };

  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View
        style={[
          styles.filterChip,
          { transform: [{ scale: scaleAnim }] },
          active ? styles.filterChipActive : styles.filterChipInactive,
        ]}
      >
        {icon && <Ionicons name={icon} size={14} color={active ? '#fff' : color} />}
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
        <View style={[styles.filterChipCount, active && styles.filterChipCountActive]}>
          <Text style={[styles.filterChipCountText, active && styles.filterChipCountTextActive]}>{count}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// Section Header
function SectionHeader({ icon, title, color }: { icon: keyof typeof Ionicons.glyphMap; title: string; color: string }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// Rarity Stats Card
function RarityStatsCard({ achievements, index }: { achievements: Achievement[]; index: number }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <AnimatedCard index={index}>
      <View style={styles.rarityStatsCard}>
        <Text style={styles.rarityStatsTitle}>Статистика по редкости</Text>
        <View style={styles.rarityGrid}>
          {(['common', 'rare', 'epic', 'legendary'] as const).map((rarity) => {
            const cfg = rarityConfig[rarity];
            const count = achievements.filter((b) => b.rarity === rarity).length;
            const unlocked = achievements.filter((b) => b.rarity === rarity && b.unlockedAt).length;
            return (
              <View key={rarity} style={[styles.rarityStatItem, { backgroundColor: cfg.bgColor, borderColor: cfg.color + '30' }]}>
                <Text style={[styles.rarityStatLabel, { color: cfg.color }]}>{cfg.label}</Text>
                <Text style={styles.rarityStatValue}>
                  {unlocked}
                  <Text style={styles.rarityStatTotal}>/{count}</Text>
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </AnimatedCard>
  );
}

// Main Screen
export default function AchievementsScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showUnlockedOnly, setShowUnlockedOnly] = useState(false);

  // Header animation
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(-15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(headerTranslate, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const { data: achievements = [], isLoading: loadingA } = useQuery({
    queryKey: ['achievements'],
    queryFn: getAchievements,
    staleTime: 1000 * 60 * 5,
  });
  const { data: streakData, isLoading: loadingS } = useQuery({
    queryKey: ['fullStreak'],
    queryFn: getFullStreakData,
    staleTime: 1000 * 60 * 5,
  });
  const { data: levelInfo, isLoading: loadingL } = useQuery({
    queryKey: ['userLevel'],
    queryFn: getUserLevel,
    staleTime: 1000 * 60 * 5,
  });

  const loading = loadingA || loadingS || loadingL;

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['achievements'] }),
      queryClient.invalidateQueries({ queryKey: ['fullStreak'] }),
      queryClient.invalidateQueries({ queryKey: ['userLevel'] }),
    ]);
    setRefreshing(false);
  }

  const filteredBadges = useMemo(
    () =>
      achievements
        .filter((b) => !categoryFilter || b.category === categoryFilter)
        .filter((b) => !showUnlockedOnly || b.unlockedAt)
        .sort((a, b) => {
          if (!!a.unlockedAt !== !!b.unlockedAt) return a.unlockedAt ? -1 : 1;
          const order: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };
          return order[a.rarity] - order[b.rarity];
        }),
    [achievements, categoryFilter, showUnlockedOnly]
  );

  const unlockedCount = achievements.filter((b) => b.unlockedAt).length;
  const totalCount = achievements.length;

  let cardIndex = 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.loadingCard} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerFade, transform: [{ translateY: headerTranslate }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <View style={styles.backButtonInner}>
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </View>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerIconWrapper}>
            <Ionicons name="trophy" size={22} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Достижения</Text>
            <Text style={styles.headerSubtitle}>
              {unlockedCount} из {totalCount} разблокировано
            </Text>
          </View>
        </View>

        <View style={styles.trophyBadge}>
          <Ionicons name="trophy" size={16} color="#fbbf24" />
          <Text style={styles.trophyCount}>{unlockedCount}</Text>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Level Card */}
        {levelInfo && <LevelCard levelInfo={levelInfo} index={cardIndex++} />}

        {/* Streaks Section */}
        {streakData && (
          <View style={styles.section}>
            <SectionHeader icon="flame" title="Стрики" color="#fb923c" />
            <View style={styles.streaksGrid}>
              <StreakCard
                title="Любые данные"
                description="Внеси хоть что-то за день"
                current={streakData.anyData.current}
                best={streakData.anyData.best}
                icon="flame"
                color="#fb923c"
                index={cardIndex++}
              />
              <StreakCard
                title="Все 6 метрик"
                description="Заполни все показатели"
                current={streakData.allMetrics.current}
                best={streakData.allMetrics.best}
                icon="checkmark-circle"
                color={colors.primary}
                index={cardIndex++}
              />
              <StreakCard
                title="Выполнение нормы"
                description="Достигай своих целей"
                current={streakData.goalsMet.current}
                best={streakData.goalsMet.best}
                icon="ribbon"
                color="#34d399"
                index={cardIndex++}
              />
            </View>
          </View>
        )}

        {/* Badges Section */}
        <View style={styles.section}>
          <View style={styles.badgesSectionHeader}>
            <SectionHeader icon="trophy" title="Бейджи" color="#fbbf24" />
            <TouchableOpacity
              style={[styles.filterToggle, showUnlockedOnly && styles.filterToggleActive]}
              onPress={() => setShowUnlockedOnly(!showUnlockedOnly)}
              activeOpacity={0.7}
            >
              <Ionicons name="funnel" size={12} color={showUnlockedOnly ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.filterToggleText, showUnlockedOnly && styles.filterToggleTextActive]}>
                Полученные
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContainer}
            style={styles.filtersScroll}
          >
            <FilterChip label="Все" count={totalCount} active={categoryFilter === null} onPress={() => setCategoryFilter(null)} />
            {Object.entries(categoryConfig).map(([cat, cfg]) => (
              <FilterChip
                key={cat}
                label={cfg.label}
                count={achievements.filter((b) => b.category === cat).length}
                active={categoryFilter === cat}
                onPress={() => setCategoryFilter(cat)}
                icon={cfg.icon}
                color={cfg.color}
              />
            ))}
          </ScrollView>

          {/* Badge Grid */}
          <View style={styles.badgesGrid}>
            {filteredBadges.map((badge, i) => (
              <BadgeCard key={badge.id} badge={badge} index={cardIndex++} />
            ))}
          </View>

          {/* Empty State */}
          {filteredBadges.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="trophy" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>Нет бейджей</Text>
              <Text style={styles.emptyText}>
                Попробуйте изменить фильтры или продолжайте отслеживать свое здоровье
              </Text>
            </View>
          )}
        </View>

        {/* Rarity Stats */}
        <RarityStatsCard achievements={achievements} index={cardIndex++} />

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  loadingCard: {
    height: 120,
    borderRadius: BorderRadius.xl,
    backgroundColor: colors.cardHover,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  backButton: {
    padding: 4,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#fbbf24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  trophyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251,191,36,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  trophyCount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#fbbf24',
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
  },
  streaksGrid: {
    gap: Spacing.md,
  },
  streakCard: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  streakIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakTextWrapper: {
    flex: 1,
  },
  streakTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
  },
  streakDescription: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  streakValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
  },
  streakValue: {
    fontSize: 36,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
  },
  streakUnit: {
    fontSize: FontSize.sm,
    color: colors.mutedForeground,
  },
  streakBest: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    marginBottom: Spacing.md,
  },
  progressSection: {
    gap: 8,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabelLeft: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
  },
  progressLabelRight: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: colors.primary,
  },
  levelCard: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.lg,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  levelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  levelIconBg: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  levelName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
  },
  levelRight: {
    alignItems: 'flex-end',
  },
  xpLabel: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  xpValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
  },
  levelProgress: {
    marginBottom: Spacing.lg,
    gap: 8,
  },
  levelProgressValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
  },
  levelProgressBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.cardHover,
    overflow: 'hidden',
  },
  levelProgressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  levelSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  levelStep: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  levelStepCurrent: {
    backgroundColor: colors.primaryMuted,
  },
  levelStepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelStepUnlocked: {
    backgroundColor: colors.primaryMuted,
  },
  levelStepLocked: {
    backgroundColor: colors.cardHover,
  },
  levelStepText: {
    fontSize: 9,
    fontWeight: FontWeight.medium,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  levelStepTextCurrent: {
    color: colors.foreground,
  },
  badgesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterToggleActive: {
    backgroundColor: colors.primaryMuted,
  },
  filterToggleText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: colors.mutedForeground,
  },
  filterToggleTextActive: {
    color: colors.primary,
  },
  filtersScroll: {
    marginHorizontal: -Spacing.lg,
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.lg,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipInactive: {
    backgroundColor: colors.cardHover,
  },
  filterChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: colors.mutedForeground,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  filterChipCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterChipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterChipCountText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
  },
  filterChipCountTextActive: {
    color: '#fff',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  badgeCardWrapper: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2,
  },
  badgeCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  badgeLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  badgeHeader: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  badgeIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTextWrapper: {
    flex: 1,
  },
  badgeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  badgeTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
    flex: 1,
  },
  badgeDescription: {
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 2,
    lineHeight: 14,
  },
  badgeProgressSection: {
    gap: 6,
  },
  badgeProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  badgeProgressText: {
    fontSize: 9,
    color: colors.mutedForeground,
  },
  badgeXp: {
    fontSize: 9,
    fontWeight: FontWeight.medium,
  },
  badgeProgressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cardHover,
    overflow: 'hidden',
  },
  badgeProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  badgeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border + '50',
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rarityText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
  },
  badgeDate: {
    fontSize: 9,
    color: colors.mutedForeground,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.cardHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  rarityStatsCard: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.lg,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  rarityStatsTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
    marginBottom: Spacing.md,
  },
  rarityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  rarityStatItem: {
    width: (SCREEN_WIDTH - Spacing.lg * 4 - Spacing.sm * 2) / 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  rarityStatLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginBottom: 4,
  },
  rarityStatValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
  },
  rarityStatTotal: {
    fontSize: FontSize.sm,
    color: colors.mutedForeground,
  },
});