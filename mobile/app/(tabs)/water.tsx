// app/(tabs)/water.tsx
import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Modal,
  TextInput,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { Spacing, FontSize, FontWeight, BorderRadius, DarkColors } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { getWaterRecords, addWaterRecord, updateWaterRecord, deleteWaterRecord } from '@/lib/health-api';
import type { WaterRecord } from '@/types/health';
import {
  AccentCard,
  MetricHero,
  StatCard,
  StatRow,
  TrendCard,
  SectionHeader,
  computeTrend,
} from '@/components/dashboard/metric-page-atoms';

type ColorPalette = typeof DarkColors;
const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
};

const CHART_HEIGHT = 180;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - Spacing.lg * 4;
const COLLAPSED_ITEMS = 3;
const GOAL_GLASSES = 8;

function formatDay(date: string) {
  return new Date(date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
}

function aggregateByDay(records: WaterRecord[]) {
  const map = new Map<string, number>();
  for (const r of records) {
    const day = r.date.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + r.glasses);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, glasses]) => ({ date: formatDay(date), glasses }));
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Animated Card
function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay: index * 50, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, tension: 60, friction: 9, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, [index]);

  return (
    <Animated.View style={[style, { opacity: fadeAnim, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// Water Glass Button
function WaterGlassButton({ filled, onPress, size = 40 }: { filled: boolean; onPress: () => void; size?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.85, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          styles.glassButton,
          { width: size, height: size, transform: [{ scale: scaleAnim }] },
          filled && styles.glassButtonFilled,
        ]}
      >
        <Ionicons name="water" size={size * 0.5} color={filled ? '#fff' : colors.water} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// History Item
function HistoryItem({
  record,
  index,
  onEdit,
  onDelete,
}: {
  record: WaterRecord;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [showActions, setShowActions] = useState(false);
  const isGoalMet = record.glasses >= GOAL_GLASSES;

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
        onPress={() => setShowActions(!showActions)}
      >
        <Animated.View style={[styles.historyCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.historyMain}>
            <View style={[styles.historyIconWrapper, { backgroundColor: colors.waterMuted }]}>
              <Ionicons name="water" size={18} color={colors.water} />
            </View>
            <View style={styles.historyContent}>
              <Text style={styles.historyDate}>
                {new Date(record.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </Text>
              {isGoalMet && (
                <View style={styles.goalMetBadge}>
                  <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                  <Text style={styles.goalMetText}>Цель достигнута</Text>
                </View>
              )}
            </View>
            <View style={styles.historyStats}>
              <Text style={styles.historyValue}>{record.glasses}</Text>
              <Text style={styles.historyUnit}>из {GOAL_GLASSES}</Text>
            </View>
          </View>

          {showActions && (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={onEdit} activeOpacity={0.7}>
                <Ionicons name="pencil" size={16} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.primary }]}>Изменить</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={onDelete} activeOpacity={0.7}>
                <Ionicons name="trash" size={16} color={colors.destructive} />
                <Text style={[styles.actionText, { color: colors.destructive }]}>Удалить</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </AnimatedCard>
  );
}

// Modal
function WaterModal({
  visible,
  onClose,
  onSave,
  editRecord,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { date: string; glasses: number }) => void;
  editRecord: WaterRecord | null;
  isLoading: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [date, setDate] = useState(toLocalDateStr(new Date()));
  const [glasses, setGlasses] = useState(1);

  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (editRecord) {
        setDate(editRecord.date.slice(0, 10));
        setGlasses(editRecord.glasses);
      } else {
        setDate(toLocalDateStr(new Date()));
        setGlasses(1);
      }
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, editRecord]);

  const handleSave = () => {
    onSave({ date, glasses });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
          <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editRecord ? 'Редактировать' : 'Добавить воду'}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Дата</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="calendar" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Количество стаканов: {glasses}</Text>
              <View style={styles.glassesGrid}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
                  <WaterGlassButton key={g} filled={glasses >= g} onPress={() => setGlasses(g)} size={36} />
                ))}
              </View>
              <View style={styles.glassesButtons}>
                <TouchableOpacity
                  style={styles.glassesAdjustButton}
                  onPress={() => setGlasses(Math.max(1, glasses - 1))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={20} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={styles.glassesValue}>{glasses}</Text>
                <TouchableOpacity
                  style={styles.glassesAdjustButton}
                  onPress={() => setGlasses(glasses + 1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.water }, isLoading && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <Text style={styles.saveButtonText}>Сохранение...</Text>
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.saveButtonText}>{editRecord ? 'Сохранить' : 'Добавить'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function WaterScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState<WaterRecord | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const todayStr = toLocalDateStr(new Date());

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(-15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(headerTranslate, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const { data: records = [] } = useQuery({
    queryKey: ['water'],
    queryFn: getWaterRecords,
  });

  const addMutation = useMutation({
    mutationFn: addWaterRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water'] });
      setModalVisible(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WaterRecord> }) => updateWaterRecord(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water'] });
      setModalVisible(false);
      setEditRecord(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWaterRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water'] });
    },
  });

  async function onRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['water'] });
    setRefreshing(false);
  }

  const handleSave = (data: { date: string; glasses: number }) => {
    if (editRecord) {
      updateMutation.mutate({ id: editRecord.id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const chartData = useMemo(() => aggregateByDay(records), [records]);
  const avgGlasses = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.round(chartData.reduce((sum, d) => sum + d.glasses, 0) / chartData.length);
  }, [chartData]);

  const todayGlasses = useMemo(() => {
    return records
      .filter((r) => r.date.slice(0, 10) === todayStr)
      .reduce((s, r) => s + r.glasses, 0);
  }, [records, todayStr]);

  const todayProgress = Math.min((todayGlasses / GOAL_GLASSES) * 100, 100);

  const displayedRecords = isExpanded ? records : records.slice(0, COLLAPSED_ITEMS);
  const hasMoreRecords = records.length > COLLAPSED_ITEMS;

  const barWidth = chartData.length > 0 ? Math.min((CHART_WIDTH - (chartData.length - 1) * 8) / chartData.length, 40) : 0;
  const maxGlasses = Math.max(...chartData.map((d) => d.glasses), GOAL_GLASSES);

  let cardIdx = 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Hero */}
        <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerTranslate }] }}>
          <MetricHero
            icon="water"
            title="Вода"
            color={colors.water}
            colorMuted={colors.waterMuted}
            hasTodayRecord={todayGlasses > 0}
            subtitle={
              todayGlasses > 0
                ? `Сегодня: ${todayGlasses}/${GOAL_GLASSES} стаканов · ${Math.round(todayProgress)}% от цели`
                : 'Сегодня запись не добавлена'
            }
            onAction={() => {
              setEditRecord(null)
              setModalVisible(true)
            }}
            actionLabel="Добавить запись"
          />
        </Animated.View>

        {/* Today card */}
        <AnimatedCard index={cardIdx++} style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <Text style={styles.todayLabel}>Сегодня</Text>
            {todayGlasses >= GOAL_GLASSES && (
              <View style={styles.goalCompleteBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.goalCompleteText}>Цель достигнута!</Text>
              </View>
            )}
          </View>

          <View style={styles.todayRingWrap}>
            <View style={styles.progressRing}>
              <View style={styles.progressRingInner}>
                <Text style={styles.progressValue}>{todayGlasses}</Text>
                <Text style={styles.progressGoal}>из {GOAL_GLASSES}</Text>
              </View>
              <View style={[styles.progressArc, { transform: [{ rotate: `${todayProgress * 3.6}deg` }] }]} />
            </View>
          </View>

          <View style={styles.quickAddSection}>
              <Text style={styles.quickAddLabel}>Быстрое добавление</Text>
              <View style={styles.quickAddButtons}>
                {[
                  { glasses: 1, label: 'Кружка' },
                  { glasses: 2, label: '0.5 л' },
                  { glasses: 3, label: '0.75 л' },
                  { glasses: 4, label: '1 л' },
                ].map((preset) => (
                  <TouchableOpacity
                    key={preset.glasses}
                    style={styles.quickAddButton}
                    onPress={() => addMutation.mutate({ date: todayStr, glasses: preset.glasses })}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="water" size={16} color={colors.water} />
                    <Text style={styles.quickAddText}>+{preset.glasses}</Text>
                    <Text style={styles.quickAddSub}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
        </AnimatedCard>

        {/* Stats row — avg / trend / goals-met */}
        {chartData.length > 0 && (() => {
          const trend = computeTrend(chartData.map((d) => d.glasses))
          const goalsMet = chartData.filter((d) => d.glasses >= GOAL_GLASSES).length
          return (
            <AnimatedCard index={cardIdx++} style={{ marginTop: Spacing.md }}>
              <StatRow>
                <StatCard
                  label={`Среднее за ${chartData.length} дн.`}
                  value={String(avgGlasses)}
                  hint={`Цель: ${GOAL_GLASSES} стак.`}
                  accent={colors.water}
                />
                <TrendCard trend={trend.dir} percent={trend.percent} />
                <StatCard
                  label="Норма выполнена"
                  value={`${goalsMet}/${chartData.length}`}
                  hint={`${Math.round((goalsMet / chartData.length) * 100)}% дней`}
                  accent={colors.success}
                />
              </StatRow>
            </AnimatedCard>
          )
        })()}

        {/* Chart */}
        <AnimatedCard index={cardIdx++} style={{ marginTop: Spacing.md, marginBottom: Spacing.lg }}>
          <AccentCard color={colors.water} style={{ padding: Spacing.lg }}>
          <Text style={styles.cardTitle}>Потребление воды за 7 дней</Text>
          {chartData.length === 0 ? (
            <View style={styles.emptyChart}>
              <Ionicons name="bar-chart-outline" size={32} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>Нет данных за последние 7 дней</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                {/* Goal line */}
                <Line
                  x1={0}
                  y1={CHART_HEIGHT - 35 - ((GOAL_GLASSES / maxGlasses) * (CHART_HEIGHT - 50))}
                  x2={CHART_WIDTH}
                  y2={CHART_HEIGHT - 35 - ((GOAL_GLASSES / maxGlasses) * (CHART_HEIGHT - 50))}
                  stroke={colors.primary}
                  strokeWidth={2}
                  strokeDasharray="6,4"
                />
                <SvgText
                  x={CHART_WIDTH - 4}
                  y={CHART_HEIGHT - 40 - ((GOAL_GLASSES / maxGlasses) * (CHART_HEIGHT - 50))}
                  fontSize={10}
                  fill={colors.primary}
                  textAnchor="end"
                >
                  Цель: {GOAL_GLASSES}
                </SvgText>
                {chartData.map((d, i) => {
                  const barHeight = Math.max((d.glasses / maxGlasses) * (CHART_HEIGHT - 50), 4);
                  const totalWidth = chartData.length * barWidth + (chartData.length - 1) * 8;
                  const startX = (CHART_WIDTH - totalWidth) / 2;
                  const x = startX + i * (barWidth + 8);
                  const y = CHART_HEIGHT - 35 - barHeight;
                  const isGoalMet = d.glasses >= GOAL_GLASSES;
                  return (
                    <React.Fragment key={i}>
                      <Rect x={x} y={y} width={barWidth} height={barHeight} rx={8} fill={isGoalMet ? colors.success : colors.water} />
                      <SvgText x={x + barWidth / 2} y={CHART_HEIGHT - 12} fontSize={10} fill={colors.mutedForeground} textAnchor="middle">
                        {d.date}
                      </SvgText>
                      <SvgText x={x + barWidth / 2} y={y - 8} fontSize={11} fill={colors.foreground} fontWeight="600" textAnchor="middle">
                        {d.glasses}
                      </SvgText>
                    </React.Fragment>
                  );
                })}
              </Svg>
            </View>
          )}
          </AccentCard>
        </AnimatedCard>

        {/* History */}
        <View style={styles.historySection}>
          <SectionHeader
            title="История"
            count={records.length}
            trailing={
              hasMoreRecords ? (
                <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} activeOpacity={0.7} style={styles.expandButton}>
                  <Text style={styles.expandText}>{isExpanded ? 'Свернуть' : `Ещё ${records.length - COLLAPSED_ITEMS}`}</Text>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
                </TouchableOpacity>
              ) : null
            }
          />

          {records.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="water-outline" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>Нет записей</Text>
              <Text style={styles.emptyHint}>Добавьте первую запись воды</Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {displayedRecords.map((record, index) => (
                <HistoryItem
                  key={record.id}
                  record={record}
                  index={index}
                  onEdit={() => {
                    setEditRecord(record);
                    setModalVisible(true);
                  }}
                  onDelete={() => deleteMutation.mutate(record.id)}
                />
              ))}
            </View>
          )}
        </View>

        {/* FAB */}
        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: colors.water }]}
          onPress={() => {
            setEditRecord(null);
            setModalVisible(true);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.fabText}>Добавить воду</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl + 20 }} />
      </ScrollView>

      <WaterModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditRecord(null);
        }}
        onSave={handleSave}
        editRecord={editRecord}
        isLoading={addMutation.isPending || updateMutation.isPending}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWrapper: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: colors.foreground },
  subtitle: { fontSize: FontSize.sm, color: colors.mutedForeground, marginTop: 2 },
  addHeaderButton: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowColor: colors.water, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 6 } }),
  },
  todayCard: {
    backgroundColor: colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border, padding: Spacing.lg, marginBottom: Spacing.md,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  todayLabel: { fontSize: FontSize.sm, color: colors.mutedForeground },
  goalCompleteBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successMuted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  goalCompleteText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.success },
  todayContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  todayRingWrap: { alignItems: 'center', marginBottom: Spacing.lg },
  progressRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 8, borderColor: colors.secondary, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  progressRingInner: { alignItems: 'center' },
  progressValue: { fontSize: 28, fontWeight: FontWeight.bold, color: colors.foreground },
  progressGoal: { fontSize: FontSize.xs, color: colors.mutedForeground },
  progressArc: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 8, borderColor: colors.water, borderTopColor: 'transparent', borderRightColor: 'transparent' },
  quickAddSection: { gap: Spacing.sm },
  quickAddLabel: { fontSize: FontSize.xs, color: colors.mutedForeground, alignSelf: 'center' },
  quickAddButtons: { flexDirection: 'row', gap: 8 },
  quickAddButton: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.waterMuted,
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 12,
  },
  quickAddText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: colors.water },
  quickAddSub: { fontSize: 10, color: colors.mutedForeground, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border, alignItems: 'center', paddingVertical: Spacing.lg, gap: 6 },
  statIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.foreground },
  statLabel: { fontSize: 10, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3 },
  chartCard: { backgroundColor: colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border, padding: Spacing.lg, marginBottom: Spacing.lg },
  cardTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: colors.mutedForeground, marginBottom: Spacing.md },
  chartContainer: { alignItems: 'center' },
  emptyChart: { height: 140, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: colors.mutedForeground },
  historySection: { marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.foreground },
  expandButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  expandText: { fontSize: FontSize.sm, color: colors.primary, fontWeight: FontWeight.medium },
  emptyHistory: { backgroundColor: colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border, alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: colors.foreground },
  emptyHint: { fontSize: FontSize.sm, color: colors.mutedForeground },
  historyList: { gap: Spacing.sm },
  historyCard: { backgroundColor: colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  historyMain: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  historyIconWrapper: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  historyContent: { flex: 1 },
  historyDate: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: colors.foreground },
  goalMetBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  goalMetText: { fontSize: FontSize.xs, color: colors.success },
  historyStats: { alignItems: 'flex-end' },
  historyValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.foreground },
  historyUnit: { fontSize: FontSize.xs, color: colors.mutedForeground },
  actionsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  actionText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  fabButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 16, borderRadius: BorderRadius.xl,
    ...Platform.select({ ios: { shadowColor: colors.water, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 }, android: { elevation: 6 } }),
  },
  fabText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.lg },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.foreground, marginBottom: Spacing.lg, textAlign: 'center' },
  inputGroup: { marginBottom: Spacing.md },
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: colors.foreground, marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: colors.secondary, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 12 },
  input: { flex: 1, fontSize: FontSize.base, color: colors.foreground },
  glassesGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  glassButton: { borderRadius: 12, borderWidth: 2, borderColor: colors.water, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.waterMuted },
  glassButtonFilled: { backgroundColor: colors.water, borderColor: colors.water },
  glassesButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  glassesAdjustButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  glassesValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: colors.foreground, minWidth: 40, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.lg, backgroundColor: colors.secondary, alignItems: 'center' },
  cancelButtonText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: colors.foreground },
  saveButton: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: BorderRadius.lg },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: '#fff' },
});