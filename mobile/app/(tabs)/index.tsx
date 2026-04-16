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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import {
  getSleepRecords,
  getNutritionRecords,
  getMoodRecords,
  getStressRecords,
  getActivityRecords,
  getWaterRecords,
} from '@/lib/health-api';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StreakWidget } from '@/components/dashboard/StreakWidget';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = Spacing.md;
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - CARD_GAP) / 2;

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

// ── Animated Add Button ───────────────────────────────────────
interface AnimatedAddButtonProps {
  onPress: () => void;
}

function AnimatedAddButton({ onPress }: AnimatedAddButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.85,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={styles.addButtonTouchable}
    >
      <Animated.View style={[styles.addButton, { transform: [{ scale: scaleAnim }] }]}>
        <Ionicons name="add" size={20} color="#fff" />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Component ─────────────────────────────────────────────────
export default function DashboardScreen() {
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
  const { data: sleep = [], isLoading: l1 } = useQuery({
    queryKey: ['sleep'],
    queryFn: getSleepRecords,
  });
  const { data: nutrition = [], isLoading: l2 } = useQuery({
    queryKey: ['nutrition'],
    queryFn: getNutritionRecords,
  });
  const { data: mood = [], isLoading: l3 } = useQuery({
    queryKey: ['mood'],
    queryFn: getMoodRecords,
  });
  const { data: stress = [], isLoading: l4 } = useQuery({
    queryKey: ['stress'],
    queryFn: getStressRecords,
  });
  const { data: activity = [], isLoading: l5 } = useQuery({
    queryKey: ['activity'],
    queryFn: getActivityRecords,
  });
  const { data: water = [], isLoading: l6 } = useQuery({
    queryKey: ['water'],
    queryFn: getWaterRecords,
  });

  const loading = l1 || l2 || l3 || l4 || l5 || l6;

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
      color: Colors.sleep,
      colorMuted: Colors.sleepMuted,
    },
    {
      title: 'Питание',
      value: dayNutrition ? `${dayNutrition.kcal}` : '—',
      subtitle: dayNutrition ? 'ккал из 2000' : 'Нет данных',
      icon: 'restaurant' as const,
      href: '/nutrition',
      progress: dayNutrition ? (dayNutrition.kcal / 2000) * 100 : 0,
      sparklineData: nutritionSparkline.map((d) => d.value),
      color: Colors.nutrition,
      colorMuted: Colors.nutritionMuted,
    },
    {
      title: 'Настроение',
      value: dayMood ? `${dayMood.value}/10` : '—',
      subtitle: dayMood ? 'настроение дня' : 'Нет данных',
      icon: 'happy' as const,
      href: '/mood',
      progress: dayMood ? (dayMood.value / 10) * 100 : 0,
      sparklineData: moodSparkline.map((d) => d.value),
      color: Colors.mood,
      colorMuted: Colors.moodMuted,
    },
    {
      title: 'Стресс',
      value: dayStress ? `${dayStress.level}` : '—',
      subtitle: dayStress ? 'из 10' : 'Нет данных',
      icon: 'pulse' as const,
      href: '/stress',
      progress: dayStress ? (dayStress.level / 10) * 100 : 0,
      sparklineData: stressSparkline.map((d) => d.value),
      color: Colors.stress,
      colorMuted: Colors.stressMuted,
    },
    {
      title: 'Активность',
      value: dayActivity ? `${dayActivity.duration}м` : '—',
      subtitle: dayActivity?.steps ? `${dayActivity.steps.toLocaleString()} шагов` : 'Нет данных',
      icon: 'flame' as const,
      href: '/activity',
      progress: dayActivity ? (dayActivity.duration / 60) * 100 : 0,
      sparklineData: activitySparkline.map((d) => d.value),
      color: Colors.activity,
      colorMuted: Colors.activityMuted,
    },
    {
      title: 'Вода',
      value: dayWater ? `${dayWater.glasses}` : '—',
      subtitle: dayWater ? 'из 8 стаканов' : 'Нет данных',
      icon: 'water' as const,
      href: '/water',
      progress: dayWater ? (dayWater.glasses / 8) * 100 : 0,
      sparklineData: waterSparkline.map((d) => d.value),
      color: Colors.water,
      colorMuted: Colors.waterMuted,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
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
          <View>
            <Text style={styles.title}>Обзор здоровья</Text>
          </View>
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
              <Ionicons name="chevron-back" size={18} color={Colors.foreground} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateCenter}
            onPress={() => !isToday && setSelectedDate(todayStr)}
            activeOpacity={isToday ? 1 : 0.7}
          >
            <Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
            <View style={styles.dateInfo}>
              <View style={styles.metricsBadge}>
                <Text style={styles.metricsCount}>{filledMetrics}</Text>
                <Text style={styles.metricsTotal}>/6</Text>
              </View>
              {!isToday && (
                <View style={styles.todayBadge}>
                  <Ionicons name="arrow-forward" size={12} color={Colors.primary} />
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
                <Ionicons name="chevron-forward" size={18} color={Colors.foreground} />
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>

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
              <View style={styles.cardContainer}>
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
                />
                <AnimatedAddButton
                  onPress={() => router.push(metricRouteMap[metric.title] as any)}
                />
              </View>
            </AnimatedCard>
          ))}
        </View>

        <View style={{ height: Spacing.xxl + 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  greeting: {
    fontSize: FontSize.sm,
    color: Colors.cardHover,
    marginBottom: 4,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
    letterSpacing: -0.5,
  },
  aiButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  aiButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.cardHover,
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
    color: Colors.foreground,
    textTransform: 'capitalize',
    marginBottom: 6,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricsBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metricsCount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  metricsTotal: {
    fontSize: FontSize.xs,
    color: Colors.mutedForeground,
  },
  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  streakWrapper: {
    marginBottom: Spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
  },
  metricCardWrapper: {
    marginBottom: CARD_GAP,
  },
  cardContainer: {
    position: 'relative',
  },
  addButtonTouchable: {
    position: 'absolute',
    top: 12,
    right: 9,
    zIndex: 10,
  },
  addButton: {
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});