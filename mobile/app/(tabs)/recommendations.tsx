// app/(tabs)/recommendations.tsx
import React, { useRef, useEffect } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { getInsights } from '@/lib/health-api';
import { Card, CardContent } from '@/components/ui/Card';
import { ProgressBar } from '@/components/dashboard/ProgressBar';
import type { Recommendation, MetricType } from '@/types/health';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const metricConfig: Record<MetricType, { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; bgColor: string }> = {
  sleep: { icon: 'moon', label: 'Сон', color: Colors.sleep, bgColor: Colors.sleepMuted },
  food: { icon: 'restaurant', label: 'Питание', color: Colors.nutrition, bgColor: Colors.nutritionMuted },
  mood: { icon: 'happy', label: 'Настроение', color: Colors.mood, bgColor: Colors.moodMuted },
  stress: { icon: 'pulse', label: 'Стресс', color: Colors.stress, bgColor: Colors.stressMuted },
  activity: { icon: 'flame', label: 'Активность', color: Colors.activity, bgColor: Colors.activityMuted },
  water: { icon: 'water', label: 'Вода', color: Colors.water, bgColor: Colors.waterMuted },
};

const severityConfig = {
  alert: { label: 'Внимание', icon: 'alert-circle' as const, color: Colors.destructive, bgColor: Colors.destructiveMuted },
  attention: { label: 'Улучшить', icon: 'warning' as const, color: Colors.warning, bgColor: Colors.warningMuted },
  good: { label: 'Отлично', icon: 'checkmark-circle' as const, color: Colors.success, bgColor: Colors.successMuted },
};

// Animated Card Wrapper
function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 60,
        friction: 9,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 60,
        friction: 9,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index]);

  return (
    <Animated.View style={[style, { opacity: fadeAnim, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}

// Stat Card with animation
function StatCard({ 
  icon, 
  value, 
  label, 
  color, 
  index 
}: { 
  icon: keyof typeof Ionicons.glyphMap; 
  value: string | number; 
  label: string; 
  color: string; 
  index: number;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start();
  };

  return (
    <AnimatedCard index={index} style={styles.statCardWrapper}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={[styles.statCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.statIconBg, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon} size={18} color={color} />
          </View>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statLabel}>{label}</Text>
        </Animated.View>
      </TouchableOpacity>
    </AnimatedCard>
  );
}

// Recommendation Card
function RecommendationCard({ rec, index }: { rec: Recommendation; index: number }) {
  const metric = metricConfig[rec.metric] || metricConfig.mood;
  const severity = severityConfig[rec.severity] || severityConfig.good;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start();
  };

  return (
    <AnimatedCard index={index}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={[styles.recCard, { transform: [{ scale: scaleAnim }] }]}>
          {/* Gradient-like accent bar */}
          <View style={[styles.recAccent, { backgroundColor: severity.color }]} />
          
          <View style={styles.recContent}>
            {/* Header */}
            <View style={styles.recHeader}>
              <View style={[styles.recIconContainer, { backgroundColor: metric.bgColor }]}>
                <Ionicons name={metric.icon} size={22} color={metric.color} />
              </View>
              
              <View style={styles.recHeaderText}>
                <View style={styles.recMetricRow}>
                  <Text style={[styles.recMetricLabel, { color: metric.color }]}>{metric.label}</Text>
                  <View style={[styles.severityBadge, { backgroundColor: severity.bgColor }]}>
                    <Ionicons name={severity.icon} size={10} color={severity.color} />
                    <Text style={[styles.severityText, { color: severity.color }]}>{severity.label}</Text>
                  </View>
                </View>
                <Text style={styles.recTitle} numberOfLines={2}>{rec.title}</Text>
              </View>
            </View>

            {/* Description */}
            <Text style={styles.recDescription}>{rec.description}</Text>

            {/* Action hint */}
            <View style={styles.recFooter}>
              <Ionicons name="arrow-forward-circle" size={16} color={Colors.mutedForeground} />
              <Text style={styles.recAction}>Подробнее</Text>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </AnimatedCard>
  );
}

// Section Header
function SectionHeader({ icon, title, color, count }: { icon: keyof typeof Ionicons.glyphMap; title: string; color: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <View style={[styles.sectionIcon, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={[styles.countBadge, { backgroundColor: color + '15' }]}>
        <Text style={[styles.countText, { color }]}>{count}</Text>
      </View>
    </View>
  );
}

export default function RecommendationsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  // Header animations
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(-15)).current;
  const refreshRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(headerTranslate, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const { data: insights, isLoading, isError, refetch } = useQuery({
    queryKey: ['insights'],
    queryFn: getInsights,
    staleTime: 1000 * 60 * 5,
  });

  async function onRefresh() {
    // Rotate animation
    Animated.loop(
      Animated.timing(refreshRotation, { toValue: 1, duration: 800, useNativeDriver: true })
    ).start();
    
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    
    refreshRotation.stopAnimation();
    refreshRotation.setValue(0);
  }

  const recommendations = insights?.recommendations || [];
  const alertRecs = recommendations.filter(r => r.severity === 'alert');
  const attentionRecs = recommendations.filter(r => r.severity === 'attention');
  const goodRecs = recommendations.filter(r => r.severity === 'good');

  const spin = refreshRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  let cardIndex = 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Animated.View 
        style={[
          styles.header, 
          { opacity: headerFade, transform: [{ translateY: headerTranslate }] }
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <View style={styles.backButtonInner}>
            <Ionicons name="chevron-back" size={22} color={Colors.foreground} />
          </View>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerIconWrapper}>
            <Ionicons name="sparkles" size={22} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Рекомендации</Text>
            <Text style={styles.headerSubtitle}>
              {recommendations.length} {recommendations.length === 1 ? 'совет' : 'советов'} для вас
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton} activeOpacity={0.7}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="refresh" size={20} color={Colors.foreground} />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            icon="trending-up"
            value={insights?.predicted_mood?.toFixed(1) || '—'}
            label="Прогноз"
            color={Colors.primary}
            index={0}
          />
          <StatCard
            icon="alert-circle"
            value={alertRecs.length}
            label="Внимание"
            color={Colors.destructive}
            index={1}
          />
          <StatCard
            icon="warning"
            value={attentionRecs.length}
            label="Улучшить"
            color={Colors.warning}
            index={2}
          />
          <StatCard
            icon="checkmark-circle"
            value={goodRecs.length}
            label="Отлично"
            color={Colors.success}
            index={3}
          />
        </View>

        {/* Phase Progress */}
        {insights?.phase && (
          <AnimatedCard index={4} style={styles.phaseCard}>
            <View style={styles.phaseContent}>
              <View style={styles.phaseHeader}>
                <View style={styles.phaseIconWrapper}>
                  <Ionicons name="flash" size={16} color={Colors.primary} />
                </View>
                <View style={styles.phaseTextWrapper}>
                  <Text style={styles.phaseTitle}>
                    {insights.phase.mode === 'cold_start' ? 'Начальный этап' :
                     insights.phase.mode === 'learning' ? 'Этап обучения' : 'Персональная модель'}
                  </Text>
                  <Text style={styles.phaseSubtitle}>
                    {insights.phase.total_records} из {insights.phase.total_records + insights.phase.records_needed} дней
                  </Text>
                </View>
              </View>
              <View style={styles.progressWrapper}>
                <ProgressBar
                  progress={(insights.phase.total_records / (insights.phase.total_records + insights.phase.records_needed)) * 100}
                  height={6}
                />
              </View>
            </View>
          </AnimatedCard>
        )}

        {/* Error State */}
        {isError && (
          <AnimatedCard index={5} style={styles.errorCard}>
            <View style={styles.errorContent}>
              <View style={styles.errorIconWrapper}>
                <Ionicons name="cloud-offline" size={24} color={Colors.destructive} />
              </View>
              <Text style={styles.errorTitle}>Ошибка загрузки</Text>
              <Text style={styles.errorText}>Не удалось загрузить рекомендации</Text>
              <TouchableOpacity style={styles.retryButton} onPress={onRefresh} activeOpacity={0.8}>
                <Text style={styles.retryText}>Повторить</Text>
              </TouchableOpacity>
            </View>
          </AnimatedCard>
        )}

        {/* Empty State */}
        {!isLoading && recommendations.length === 0 && !isError && (
          <AnimatedCard index={5} style={styles.emptyCard}>
            <View style={styles.emptyContent}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="sparkles" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Пока нет рекомендаций</Text>
              <Text style={styles.emptyText}>
                Продолжайте вносить данные о здоровье, и скоро здесь появятся персональные советы
              </Text>
            </View>
          </AnimatedCard>
        )}

        {/* Alert Recommendations */}
        {alertRecs.length > 0 && (
          <View style={styles.section}>
            <SectionHeader 
              icon="alert-circle" 
              title="Требует внимания" 
              color={Colors.destructive} 
              count={alertRecs.length} 
            />
            {alertRecs.map((rec, i) => (
              <RecommendationCard key={`alert-${i}`} rec={rec} index={cardIndex++} />
            ))}
          </View>
        )}

        {/* Attention Recommendations */}
        {attentionRecs.length > 0 && (
          <View style={styles.section}>
            <SectionHeader 
              icon="warning" 
              title="Можно улучшить" 
              color={Colors.warning} 
              count={attentionRecs.length} 
            />
            {attentionRecs.map((rec, i) => (
              <RecommendationCard key={`attention-${i}`} rec={rec} index={cardIndex++} />
            ))}
          </View>
        )}

        {/* Good Recommendations */}
        {goodRecs.length > 0 && (
          <View style={styles.section}>
            <SectionHeader 
              icon="checkmark-circle" 
              title="Хорошие показатели" 
              color={Colors.success} 
              count={goodRecs.length} 
            />
            {goodRecs.map((rec, i) => (
              <RecommendationCard key={`good-${i}`} rec={rec} index={cardIndex++} />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
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
    backgroundColor: Colors.cardHover,
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
      android: { elevation: 6 },
    }),
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.mutedForeground,
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.cardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCardWrapper: {
    flex: 1,
  },
  statCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  phaseCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  phaseContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  phaseIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseTextWrapper: {
    flex: 1,
  },
  phaseTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.foreground,
  },
  phaseSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.mutedForeground,
    marginTop: 2,
  },
  progressWrapper: {
    paddingHorizontal: 4,
  },
  errorCard: {
    backgroundColor: Colors.destructiveMuted,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.destructive + '30',
    marginBottom: Spacing.lg,
  },
  errorContent: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.destructive + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  errorTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.foreground,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.mutedForeground,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.destructive,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  retryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#fff',
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  emptyContent: {
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.foreground,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  section: {
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.foreground,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  recCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  recAccent: {
    height: 3,
    width: '100%',
  },
  recContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  recHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  recIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recHeaderText: {
    flex: 1,
    gap: 4,
  },
  recMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recMetricLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  severityText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  recTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.foreground,
    lineHeight: 22,
  },
  recDescription: {
    fontSize: FontSize.sm,
    color: Colors.mutedForeground,
    lineHeight: 20,
  },
  recFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  recAction: {
    fontSize: FontSize.xs,
    color: Colors.mutedForeground,
    fontWeight: FontWeight.medium,
  },
});