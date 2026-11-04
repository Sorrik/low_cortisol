// app/(tabs)/index.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { useThemedStyles, ColorPalette } from '@/lib/useThemedStyles';
import { useTheme } from '@/context/ThemeContext';

import {
  getSleepRecords,
  getNutritionRecords,
  getMoodRecords,
  getStressRecords,
  getActivityRecords,
  getWaterRecords,
  getInsights,
} from '@/lib/health-api';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StreakWidget } from '@/components/dashboard/StreakWidget';
import { SleepSessionBanner } from '@/components/dashboard/SleepSessionBanner';
import { AnomalyBanner } from '@/components/dashboard/AnomalyBanner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = Spacing.md;
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - CARD_GAP) / 2;
const STEPS_GOAL = 8000;

const metricRouteMap: Record<string, string> = {
  'Сон': '/(modals)/add-sleep',
  'Питание': '/(modals)/add-nutrition',
  'Настроение': '/(modals)/add-mood',
  'Стресс': '/(modals)/add-stress',
  'Активность': '/(modals)/add-activity',
  'Вода': '/(modals)/add-water',
};

// ── Helpers ───────────────────────────────────────────────────
function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const todayStr = toLocalDateStr(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateStr(yesterday);

  if (dateStr === todayStr) return 'Сегодня';
  if (dateStr === yesterdayStr) return 'Вчера';

  return date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function aggregateByDay<T extends { date: string }>(
  records: T[],
  aggregate: (dayRecords: T[]) => number
): { date: string; value: number }[] {
  const map = new Map<string, T[]>();
  for (const r of records) {
    const day = r.date.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(r);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, recs]) => ({ date, value: aggregate(recs) }));
}

// ── Animated Card Wrapper ─────────────────────────────────────
interface AnimatedCardProps {
  children: React.ReactNode;
  index: number;
  style?: any;
}

function AnimatedCard({ children, index, style }: AnimatedCardProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 50,
        friction: 8,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 50,
        friction: 8,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ── Component ─────────────────────────────────────────────────
export default function DashboardScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const todayStr = toLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [refreshing, setRefreshing] = useState(false);

  // Header animation
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(headerTranslate, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const isToday = selectedDate === todayStr;

  function goBack() {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(toLocalDateStr(d));
  }

  function goForward() {
    if (isToday) return;
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(toLocalDateStr(d));
  }

  // Queries
  const { data: sleep = [], isLoading: sleepLoading, isError: sleepError } = useQuery({
    queryKey: ['sleep'],
    queryFn: getSleepRecords,
  });
  const { data: nutrition = [], isLoading: nutritionLoading, isError: nutritionError } = useQuery({
    queryKey: ['nutrition'],
    queryFn: getNutritionRecords,
  });
  const { data: mood = [], isLoading: moodLoading, isError: moodError } = useQuery({
    queryKey: ['mood'],
    queryFn: getMoodRecords,
  });
  const { data: stress = [], isLoading: stressLoading, isError: stressError } = useQuery({
    queryKey: ['stress'],
    queryFn: getStressRecords,
  });
  const { data: activity = [], isLoading: activityLoading, isError: activityError } = useQuery({
    queryKey: ['activity'],
    queryFn: getActivityRecords,
  });
  const { data: water = [], isLoading: waterLoading, isError: waterError } = useQuery({
    queryKey: ['water'],
    queryFn: getWaterRecords,
  });
  const { data: insights } = useQuery({
    queryKey: ['insights'],
    queryFn: getInsights,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = sleepLoading || nutritionLoading || moodLoading || stressLoading || activityLoading || waterLoading;
  const isError = sleepError || nutritionError || moodError || stressError || activityError || waterError;

  // Pull to refresh
  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sleep'] }),
      queryClient.invalidateQueries({ queryKey: ['nutrition'] }),
      queryClient.invalidateQueries({ queryKey: ['mood'] }),
      queryClient.invalidateQueries({ queryKey: ['stress'] }),
      queryClient.invalidateQueries({ queryKey: ['activity'] }),
      queryClient.invalidateQueries({ queryKey: ['water'] }),
      queryClient.invalidateQueries({ queryKey: ['fullStreak'] }),
      queryClient.invalidateQueries({ queryKey: ['userLevel'] }),
      queryClient.invalidateQueries({ queryKey: ['achievements'] }),
    ]);
    setRefreshing(false);
  }

  // Filter by selected day
  const daySleep = useMemo(() => {
    const recs = sleep.filter((r) => r.date.slice(0, 10) === selectedDate);
    return recs.length > 0
      ? { hours: recs[recs.length - 1].hours, quality: recs[recs.length - 1].quality }
      : null;
  }, [sleep, selectedDate]);

  const dayNutrition = useMemo(() => {
    const recs = nutrition.filter((r) => r.date.slice(0, 10) === selectedDate);
    return recs.length > 0
      ? {
          kcal: recs.reduce((s, r) => s + r.kcal, 0),
          proteins: recs.reduce((s, r) => s + r.proteins, 0),
          fats: recs.reduce((s, r) => s + r.fats, 0),
          carbs: recs.reduce((s, r) => s + r.carbs, 0),
        }
      : null;
  }, [nutrition, selectedDate]);

  const dayMood = useMemo(() => {
    const recs = mood.filter((r) => r.date.slice(0, 10) === selectedDate);
    return recs.length > 0
      ? { value: Math.round(recs.reduce((s, r) => s + r.value, 0) / recs.length) }
      : null;
  }, [mood, selectedDate]);

  const dayStress = useMemo(() => {
    const recs = stress.filter((r) => r.date.slice(0, 10) === selectedDate);
    return recs.length > 0 ? { level: recs[recs.length - 1].level } : null;
  }, [stress, selectedDate]);

  const dayActivity = useMemo(() => {
    const recs = activity.filter((r) => r.date.slice(0, 10) === selectedDate);
    return recs.length > 0
      ? {
          duration: recs.reduce((s, r) => s + r.duration, 0),
          steps: recs.reduce((s, r) => s + (r.steps ?? 0), 0),
        }
      : null;
  }, [activity, selectedDate]);

  const dayWater = useMemo(() => {
    const recs = water.filter((r) => r.date.slice(0, 10) === selectedDate);
    return recs.length > 0 ? { glasses: recs.reduce((s, r) => s + r.glasses, 0) } : null;
  }, [water, selectedDate]);

  // Sparklines
  const sleepSparkline = aggregateByDay(sleep, (rs) => rs[rs.length - 1].hours);
  const nutritionSparkline = aggregateByDay(nutrition, (rs) =>
    rs.reduce((s, r) => s + r.kcal, 0)
  );
  const moodSparkline = aggregateByDay(mood, (rs) =>
    Math.round(rs.reduce((s, r) => s + r.value, 0) / rs.length)
  );
  const stressSparkline = aggregateByDay(stress, (rs) => rs[rs.length - 1].level);
  const activitySparkline = aggregateByDay(activity, (rs) =>
    rs.reduce((s, r) => s + r.duration, 0)
  );
  const waterSparkline = aggregateByDay(water, (rs) => rs.reduce((s, r) => s + r.glasses, 0));

  const filledMetrics = [daySleep, dayNutrition, dayMood, dayStress, dayActivity, dayWater].filter(
    Boolean
  ).length;

  const metrics = [
    {
      title: 'Сон',
      value: daySleep ? `${daySleep.hours.toFixed(1)}ч` : '—',
      subtitle: daySleep ? 'из 8ч цели' : 'Нет данных',
      icon: 'moon' as const,
      href: '/sleep',
      progress: daySleep ? (daySleep.hours / 8) * 100 : 0,
      sparklineData: sleepSparkline.map((d) => d.value),
      color: colors.sleep,
      colorMuted: colors.sleepMuted,
    },
    {
      title: 'Питание',
      value: dayNutrition ? `${dayNutrition.kcal}` : '—',
      subtitle: dayNutrition ? 'ккал из 2000' : 'Нет данных',
      icon: 'restaurant' as const,
      href: '/nutrition',
      progress: dayNutrition ? (dayNutrition.kcal / 2000) * 100 : 0,
      sparklineData: nutritionSparkline.map((d) => d.value),
      color: colors.nutrition,
      colorMuted: colors.nutritionMuted,
    },
    {
      title: 'Настроение',
      value: dayMood ? `${dayMood.value}/10` : '—',
      subtitle: dayMood ? 'настроение дня' : 'Нет данных',
      icon: 'happy' as const,
      href: '/mood',
      progress: dayMood ? (dayMood.value / 10) * 100 : 0,
      sparklineData: moodSparkline.map((d) => d.value),
      color: colors.mood,
      colorMuted: colors.moodMuted,
    },
    {
      title: 'Стресс',
      value: dayStress ? `${dayStress.level}` : '—',
      subtitle: dayStress ? 'из 10' : 'Нет данных',
      icon: 'pulse' as const,
      href: '/stress',
      progress: dayStress ? (dayStress.level / 10) * 100 : 0,
      sparklineData: stressSparkline.map((d) => d.value),
      color: colors.stress,
      colorMuted: colors.stressMuted,
    },
    {
      title: 'Активность',
      value: dayActivity ? `${dayActivity.duration}м` : '—',
      subtitle: dayActivity?.steps ? `${dayActivity.steps.toLocaleString()} шагов` : 'Нет данных',
      icon: 'flame' as const,
      href: '/activity',
      progress: dayActivity ? (dayActivity.duration / 60) * 100 : 0,
      sparklineData: activitySparkline.map((d) => d.value),
      color: colors.activity,
      colorMuted: colors.activityMuted,
      rings: dayActivity ? [
        { progress: Math.min(100, (dayActivity.duration / 60) * 100), label: `${dayActivity.duration} мин` },
        { progress: Math.min(100, (dayActivity.steps / STEPS_GOAL) * 100), label: `${dayActivity.steps.toLocaleString()} шагов` },
      ] : undefined,
    },
    {
      title: 'Вода',
      value: dayWater ? `${dayWater.glasses}` : '—',
      subtitle: dayWater ? 'из 8 стаканов' : 'Нет данных',
      icon: 'water' as const,
      href: '/water',
      progress: dayWater ? (dayWater.glasses / 8) * 100 : 0,
      sparklineData: waterSparkline.map((d) => d.value),
      color: colors.water,
      colorMuted: colors.waterMuted,
    },
  ];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <Text style={styles.centerStateText}>Не удалось загрузить данные</Text>
          <TouchableOpacity
            style={styles.centerStateRetry}
            onPress={() => {
              queryClient.invalidateQueries({ queryKey: ['sleep'] });
              queryClient.invalidateQueries({ queryKey: ['nutrition'] });
              queryClient.invalidateQueries({ queryKey: ['mood'] });
              queryClient.invalidateQueries({ queryKey: ['stress'] });
              queryClient.invalidateQueries({ queryKey: ['activity'] });
              queryClient.invalidateQueries({ queryKey: ['water'] });
            }}
          >
            <Text style={styles.centerStateRetryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Animated Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerFade,
              transform: [{ translateY: headerTranslate }],
            },
          ]}
        >
          <View style={styles.brandRow}>
            <View style={styles.brandIconWrap}>
              <Ionicons name="pulse" size={22} color={colors.foreground} />
              <View style={styles.brandStatusDot} />
            </View>
            <View>
              <Text style={styles.brandTitle}>LowCor</Text>
              <Text style={styles.brandSubtitle}>Ваше здоровье под контролем</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.recsButton}
            onPress={() => router.push('/(tabs)/recommendations' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles" size={14} color={colors.gold} />
            <Text style={styles.recsButtonText}>Советы</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Date Navigator */}
        <Animated.View
          style={[
            styles.dateNav,
            {
              opacity: headerFade,
              transform: [{ translateY: headerTranslate }],
            },
          ]}
        >
          <TouchableOpacity
            onPress={goBack}
            style={styles.dateButton}
            activeOpacity={0.7}
          >
            <View style={styles.dateButtonInner}>
              <Ionicons name="chevron-back" size={18} color={colors.foreground} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateCenter}
            onPress={() => !isToday && setSelectedDate(todayStr)}
            activeOpacity={isToday ? 1 : 0.7}
          >
            <Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
            <View style={styles.dateInfo}>
              <View style={styles.dotsRow}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      { backgroundColor: i < filledMetrics ? colors.success : colors.border },
                    ]}
                  />
                ))}
              </View>
              {!isToday && (
                <View style={styles.todayBadge}>
                  <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                  <Text style={styles.todayText}>Сегодня</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {isToday ? (
            <View style={styles.dateButton} />
          ) : (
            <TouchableOpacity
              onPress={goForward}
              style={styles.dateButton}
              activeOpacity={0.7}
            >
              <View style={styles.dateButtonInner}>
                <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>

        <SleepSessionBanner />

        {insights?.anomalyReport ? (
          <View style={styles.anomalyWrapper}>
            <AnomalyBanner report={insights.anomalyReport} />
          </View>
        ) : null}

        {/* Streak Widget */}
        <AnimatedCard index={0} style={styles.streakWrapper}>
          <StreakWidget />
        </AnimatedCard>

        {/* Metric Cards */}
        <View style={styles.metricsGrid}>
          {metrics.map((metric, index) => (
            <AnimatedCard
              key={metric.title}
              index={index + 1}
              style={[
                styles.metricCardWrapper,
                { width: CARD_WIDTH },
                index % 2 === 0 ? { marginRight: CARD_GAP } : null,
              ]}
            >
              <MetricCard
                title={metric.title}
                value={metric.value}
                subtitle={metric.subtitle}
                icon={metric.icon}
                href={metric.href}
                progress={metric.progress}
                sparklineData={metric.sparklineData}
                color={metric.color}
                colorMuted={metric.colorMuted}
                rings={metric.rings}
                onAdd={() => router.push(metricRouteMap[metric.title] as any)}
              />
            </AnimatedCard>
          ))}
        </View>

        <View style={{ height: Spacing.xxl + 20 }} />
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
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  centerStateText: {
    fontSize: FontSize.md,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  centerStateRetry: {
    backgroundColor: colors.primary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  centerStateRetryText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: colors.primaryForeground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  brandIconWrap: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandStatusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background,
  },
  brandTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  recsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recsButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: colors.foreground,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  dateButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.cardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenter: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  dateText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
    textTransform: 'capitalize',
    marginBottom: 6,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayText: {
    fontSize: FontSize.xs,
    color: colors.primary,
    fontWeight: FontWeight.medium,
  },
  streakWrapper: {
    marginBottom: Spacing.md,
  },
  anomalyWrapper: {
    marginBottom: Spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    marginTop: Spacing.sm,
  },
  metricCardWrapper: {
    marginBottom: CARD_GAP,
  },
});