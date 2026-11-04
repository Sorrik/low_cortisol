// app/(tabs)/stress.tsx
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
import Svg, { Rect, Text as SvgText, Line, Path } from 'react-native-svg';
import { Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { useThemedStyles, ColorPalette } from '@/lib/useThemedStyles';
import { useTheme } from '@/context/ThemeContext';

import { getStressRecords, addStressRecord, updateStressRecord, deleteStressRecord } from '@/lib/health-api';
import type { StressRecord } from '@/types/health';
import {
  AccentCard,
  MetricHero,
  StatCard,
  StatRow,
  TrendCard,
  SectionHeader,
  computeTrend,
} from '@/components/dashboard/metric-page-atoms';

const CHART_HEIGHT = 180;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - Spacing.lg * 4;
const COLLAPSED_ITEMS = 3;

function getStressLabel(level: number): string {
  if (level <= 3) return 'Низкий';
  if (level <= 6) return 'Средний';
  return 'Высокий';
}

function getStressColor(level: number): string {
  if (level <= 3) return '#22c55e';
  if (level <= 6) return '#eab308';
  return '#ef4444';
}

function formatDay(date: string) {
  return new Date(date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
}

function aggregateByDay(records: StressRecord[]) {
  const map = new Map<string, number[]>();
  for (const r of records) {
    const day = r.date.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(r.level);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, levels]) => ({
      date: formatDay(date),
      level: Math.round(levels.reduce((s, v) => s + v, 0) / levels.length),
    }));
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Animated Card
function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) {
  const styles = useThemedStyles(createStyles);
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

// History Item
function HistoryItem({
  record,
  index,
  onEdit,
  onDelete,
}: {
  record: StressRecord;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [showActions, setShowActions] = useState(false);
  const stressColor = getStressColor(record.level);

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
            <View style={[styles.historyIconWrapper, { backgroundColor: stressColor + '20' }]}>
              <Ionicons name="pulse" size={18} color={stressColor} />
            </View>
            <View style={styles.historyContent}>
              <Text style={styles.historyDate}>
                {new Date(record.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </Text>
              <Text style={[styles.historyLabel, { color: stressColor }]}>{getStressLabel(record.level)}</Text>
            </View>
            <View style={styles.historyStats}>
              <Text style={styles.historyValue}>{record.level}/10</Text>
            </View>
          </View>

          {record.notes && (
            <View style={styles.notesPreview}>
              <Ionicons name="chatbubble-outline" size={12} color={colors.mutedForeground} />
              <Text style={styles.notesText} numberOfLines={1}>{record.notes}</Text>
            </View>
          )}

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

// Stress Level Selector
function StressLevelSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.levelContainer}>
      <View style={styles.levelTrack}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.levelDot,
              { backgroundColor: getStressColor(level) + (value >= level ? 'ff' : '40') },
              value === level && styles.levelDotActive,
            ]}
            onPress={() => onChange(level)}
            activeOpacity={0.7}
          />
        ))}
      </View>
      <View style={styles.levelLabels}>
        <Text style={styles.levelLabelText}>Низкий</Text>
        <Text style={styles.levelLabelText}>Средний</Text>
        <Text style={styles.levelLabelText}>Высокий</Text>
      </View>
    </View>
  );
}

// Modal
function StressModal({
  visible,
  onClose,
  onSave,
  editRecord,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { date: string; level: number; notes?: string }) => void;
  editRecord: StressRecord | null;
  isLoading: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [date, setDate] = useState(toLocalDateStr(new Date()));
  const [level, setLevel] = useState(5);
  const [notes, setNotes] = useState('');

  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (editRecord) {
        setDate(editRecord.date.slice(0, 10));
        setLevel(editRecord.level);
        setNotes(editRecord.notes ?? '');
      } else {
        setDate(toLocalDateStr(new Date()));
        setLevel(5);
        setNotes('');
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
    onSave({ date, level, notes: notes || undefined });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
          <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editRecord ? 'Редактировать' : 'Уровень стресса'}</Text>

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
              <View style={styles.levelHeader}>
                <Text style={styles.inputLabel}>Уровень стресса</Text>
                <View style={[styles.levelBadge, { backgroundColor: getStressColor(level) + '20' }]}>
                  <Text style={[styles.levelBadgeText, { color: getStressColor(level) }]}>{level}/10 - {getStressLabel(level)}</Text>
                </View>
              </View>
              <StressLevelSelector value={level} onChange={setLevel} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Заметка (опционально)</Text>
              <View style={[styles.inputWrapper, { minHeight: 80, alignItems: 'flex-start' }]}>
                <TextInput
                  style={[styles.input, { textAlignVertical: 'top', paddingTop: 8 }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Что вызвало стресс?"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.stress }, isLoading && styles.saveButtonDisabled]}
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

export default function StressScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState<StressRecord | null>(null);
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
    queryKey: ['stress'],
    queryFn: getStressRecords,
  });

  const addMutation = useMutation({
    mutationFn: addStressRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stress'] });
      setModalVisible(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StressRecord> }) => updateStressRecord(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stress'] });
      setModalVisible(false);
      setEditRecord(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStressRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stress'] });
    },
  });

  async function onRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['stress'] });
    setRefreshing(false);
  }

  const handleSave = (data: { date: string; level: number; notes?: string }) => {
    if (editRecord) {
      updateMutation.mutate({ id: editRecord.id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const chartData = useMemo(() => aggregateByDay(records), [records]);
  const avgStress = useMemo(() => {
    if (chartData.length === 0) return null;
    return Math.round(chartData.reduce((sum, d) => sum + d.level, 0) / chartData.length);
  }, [chartData]);

  const todayStress = useMemo(() => {
    const todayRecords = records.filter((r) => r.date.slice(0, 10) === todayStr);
    if (todayRecords.length === 0) return null;
    return Math.round(todayRecords.reduce((s, r) => s + r.level, 0) / todayRecords.length);
  }, [records, todayStr]);

  const displayedRecords = isExpanded ? records : records.slice(0, COLLAPSED_ITEMS);
  const hasMoreRecords = records.length > COLLAPSED_ITEMS;

  const barWidth = chartData.length > 0 ? Math.min((CHART_WIDTH - (chartData.length - 1) * 8) / chartData.length, 40) : 0;

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
            icon="pulse"
            title="Стресс"
            color={colors.stress}
            colorMuted={colors.stressMuted}
            hasTodayRecord={!!todayStress}
            subtitle={
              todayStress
                ? `Сегодня: ${todayStress}/10 — ${getStressLabel(todayStress)}`
                : 'Запись за сегодня не добавлена'
            }
            onAction={() => {
              setEditRecord(null)
              setModalVisible(true)
            }}
          />
        </Animated.View>

        {/* Stats row — avg / trend(inverted) / max */}
        {chartData.length > 0 && (() => {
          const trend = computeTrend(chartData.map((d) => d.level))
          const maxLvl = chartData.reduce((m, d) => Math.max(m, d.level), 0)
          const avgLvl = avgStress ?? 0
          return (
            <AnimatedCard index={cardIdx++} style={{ marginTop: Spacing.md }}>
              <StatRow>
                <StatCard
                  label={`Среднее за ${chartData.length} дн.`}
                  value={`${avgLvl}/10`}
                  hint={avgLvl ? `Цель: ≤4 · ${getStressLabel(avgLvl)}` : 'Нет данных'}
                  accent={avgLvl ? getStressColor(avgLvl) : colors.stress}
                />
                <TrendCard trend={trend.dir} percent={trend.percent} inverted />
                <StatCard
                  label="Максимум"
                  value={`${maxLvl}/10`}
                  hint={getStressLabel(maxLvl)}
                  accent={getStressColor(maxLvl)}
                />
              </StatRow>
            </AnimatedCard>
          )
        })()}

        {/* Chart */}
        <AnimatedCard index={cardIdx++} style={{ marginTop: Spacing.md, marginBottom: Spacing.lg }}>
          <AccentCard color={colors.stress} style={{ padding: Spacing.lg }}>
          <Text style={styles.cardTitle}>Стресс за 7 дней</Text>
          {chartData.length === 0 ? (
            <View style={styles.emptyChart}>
              <Ionicons name="bar-chart-outline" size={32} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>Нет данных за последние 7 дней</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                {chartData.map((d, i) => {
                  const barHeight = Math.max((d.level / 10) * (CHART_HEIGHT - 50), 4);
                  const totalWidth = chartData.length * barWidth + (chartData.length - 1) * 8;
                  const startX = (CHART_WIDTH - totalWidth) / 2;
                  const x = startX + i * (barWidth + 8);
                  const y = CHART_HEIGHT - 35 - barHeight;
                  return (
                    <React.Fragment key={i}>
                      <Rect x={x} y={y} width={barWidth} height={barHeight} rx={8} fill={getStressColor(d.level)} />
                      <SvgText x={x + barWidth / 2} y={CHART_HEIGHT - 12} fontSize={10} fill={colors.mutedForeground} textAnchor="middle">
                        {d.date}
                      </SvgText>
                      <SvgText x={x + barWidth / 2} y={y - 8} fontSize={11} fill={colors.foreground} fontWeight="600" textAnchor="middle">
                        {d.level}
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
              <Ionicons name="pulse-outline" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>Нет записей</Text>
              <Text style={styles.emptyHint}>Добавьте первую запись стресса</Text>
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
          style={[styles.fabButton, { backgroundColor: colors.stress }]}
          onPress={() => {
            setEditRecord(null);
            setModalVisible(true);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.fabText}>Добавить запись</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl + 20 }} />
      </ScrollView>

      <StressModal
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
    ...Platform.select({ ios: { shadowColor: colors.stress, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 6 } }),
  },
  todayCard: {
    backgroundColor: colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border, padding: Spacing.lg, marginBottom: Spacing.md,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  todayLabel: { fontSize: FontSize.sm, color: colors.mutedForeground, marginBottom: Spacing.md },
  todayContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  stressIndicator: { width: 64, height: 64, borderRadius: 32, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  stressIndicatorValue: { fontSize: 28, fontWeight: FontWeight.bold },
  todayValueWrapper: { flex: 1 },
  todayValue: { fontSize: 28, fontWeight: FontWeight.bold, color: colors.foreground },
  todayStressLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginTop: 2 },
  todayEmpty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  todayEmptyText: { fontSize: FontSize.sm, color: colors.mutedForeground },
  todayAddButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  todayAddText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
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
  historyLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: 2 },
  historyStats: { alignItems: 'flex-end' },
  historyValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.foreground },
  notesPreview: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  notesText: { fontSize: FontSize.xs, color: colors.mutedForeground, flex: 1 },
  actionsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  actionText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  fabButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 16, borderRadius: BorderRadius.xl,
    ...Platform.select({ ios: { shadowColor: colors.stress, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 }, android: { elevation: 6 } }),
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
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  levelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  levelBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  levelContainer: { gap: Spacing.sm },
  levelTrack: { flexDirection: 'row', justifyContent: 'space-between' },
  levelDot: { width: 28, height: 28, borderRadius: 14 },
  levelDotActive: { borderWidth: 3, borderColor: colors.foreground },
  levelLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  levelLabelText: { fontSize: FontSize.xs, color: colors.mutedForeground },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.lg, backgroundColor: colors.secondary, alignItems: 'center' },
  cancelButtonText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: colors.foreground },
  saveButton: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: BorderRadius.lg },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: '#fff' },
});