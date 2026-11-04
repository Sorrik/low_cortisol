// app/(tabs)/sleep.tsx
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Spacing, FontSize, FontWeight, BorderRadius, DarkColors } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { getSleepRecords, addSleepRecord, updateSleepRecord, deleteSleepRecord } from '@/lib/health-api';
import { Button } from '@/components/ui/Button';
import { useSleepSession } from '@/hooks/useSleepSession';
import type { SleepRecord } from '@/types/health';
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

function formatDay(date: string) {
  return new Date(date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
}

function aggregateByDay(records: { date: string; hours: number }[]) {
  const map = new Map<string, number>();
  for (const r of records) {
    const day = r.date.slice(0, 10);
    if (!map.has(day) || map.get(day)! < r.hours) {
      map.set(day, r.hours);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, hours]) => ({ date: formatDay(date), hours }));
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

// History Item with swipe hint
function HistoryItem({
  record,
  index,
  onEdit,
  onDelete,
}: {
  record: SleepRecord;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [showActions, setShowActions] = useState(false);

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
        onLongPress={() => setShowActions(!showActions)}
        onPress={() => setShowActions(!showActions)}
      >
        <Animated.View style={[styles.historyCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.historyMain}>
            <View style={styles.historyIconWrapper}>
              <Ionicons name="moon" size={18} color={colors.sleep} />
            </View>
            <View style={styles.historyContent}>
              <Text style={styles.historyDate}>
                {new Date(record.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </Text>
              <Text style={styles.historyTime}>
                {record.bedTime} - {record.wakeTime}
              </Text>
            </View>
            <View style={styles.historyStats}>
              <Text style={styles.historyHours}>{record.hours.toFixed(1)}ч</Text>
              <View style={styles.qualityBadge}>
                <Ionicons name="star" size={10} color="#fbbf24" />
                <Text style={styles.historyQuality}>{record.quality}/10</Text>
              </View>
            </View>
          </View>

          {showActions && (
            <Animated.View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={onEdit} activeOpacity={0.7}>
                <Ionicons name="pencil" size={16} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.primary }]}>Изменить</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={onDelete} activeOpacity={0.7}>
                <Ionicons name="trash" size={16} color={colors.destructive} />
                <Text style={[styles.actionText, { color: colors.destructive }]}>Удалить</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </AnimatedCard>
  );
}

// Add/Edit Modal
function SleepModal({
  visible,
  onClose,
  onSave,
  editRecord,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { date: string; bedTime: string; wakeTime: string; hours: number; quality: number }) => void;
  editRecord: SleepRecord | null;
  isLoading: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [date, setDate] = useState(toLocalDateStr(new Date()));
  const [bedTime, setBedTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [quality, setQuality] = useState(7);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (editRecord) {
        setDate(editRecord.date.slice(0, 10));
        setBedTime(editRecord.bedTime ?? '23:00')
        setWakeTime(editRecord.wakeTime ?? '07:00')
        setQuality(editRecord.quality);
      } else {
        setDate(toLocalDateStr(new Date()));
        setBedTime('23:00');
        setWakeTime('07:00');
        setQuality(7);
      }
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, editRecord]);

  const calculateHours = () => {
    const [bH, bM] = bedTime.split(':').map(Number);
    const [wH, wM] = wakeTime.split(':').map(Number);
    let bedMinutes = bH * 60 + bM;
    let wakeMinutes = wH * 60 + wM;
    if (wakeMinutes <= bedMinutes) wakeMinutes += 24 * 60;
    return (wakeMinutes - bedMinutes) / 60;
  };

  const handleSave = () => {
    const hours = calculateHours();
    onSave({ date, bedTime, wakeTime, hours, quality });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
          <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>{editRecord ? 'Редактировать запись' : 'Новая запись сна'}</Text>

            {/* Date */}
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

            {/* Time row */}
            <View style={styles.timeRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Лег спать</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="moon" size={18} color={colors.sleep} />
                  <TextInput
                    style={styles.input}
                    value={bedTime}
                    onChangeText={setBedTime}
                    placeholder="23:00"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Проснулся</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="sunny" size={18} color="#fbbf24" />
                  <TextInput
                    style={styles.input}
                    value={wakeTime}
                    onChangeText={setWakeTime}
                    placeholder="07:00"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>
            </View>

            {/* Calculated hours */}
            <View style={styles.hoursPreview}>
              <Ionicons name="time" size={20} color={colors.sleep} />
              <Text style={styles.hoursPreviewText}>
                Время сна: <Text style={styles.hoursPreviewValue}>{calculateHours().toFixed(1)} ч</Text>
              </Text>
            </View>

            {/* Quality */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Качество сна: {quality}/10</Text>
              <View style={styles.qualityRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((q) => (
                  <TouchableOpacity
                    key={q}
                    onPress={() => setQuality(q)}
                    style={[styles.qualityButton, quality >= q && styles.qualityButtonActive]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={quality >= q ? 'star' : 'star-outline'}
                      size={20}
                      color={quality >= q ? '#fbbf24' : colors.mutedForeground}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
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

export default function SleepScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState<SleepRecord | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Header animation
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(-15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(headerTranslate, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['sleep'],
    queryFn: getSleepRecords,
  });

  const addMutation = useMutation({
    mutationFn: addSleepRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep'] });
      setModalVisible(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SleepRecord> }) => updateSleepRecord(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep'] });
      setModalVisible(false);
      setEditRecord(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSleepRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep'] });
    },
  });

  async function onRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['sleep'] });
    setRefreshing(false);
  }

  const handleSave = (data: { date: string; bedTime: string; wakeTime: string; hours: number; quality: number }) => {
    if (editRecord) {
      updateMutation.mutate({ id: editRecord.id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const handleEdit = (record: SleepRecord) => {
    setEditRecord(record);
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const chartData = useMemo(() => aggregateByDay(records), [records]);
  const weeklyAvg = useMemo(() => {
    if (chartData.length === 0) return 0;
    return (chartData.reduce((sum, d) => sum + d.hours, 0) / chartData.length).toFixed(1);
  }, [chartData]);

  const todayRecord = useMemo(() => {
    const today = toLocalDateStr(new Date());
    return records.find((r) => r.date.slice(0, 10) === today);
  }, [records]);

  const { session, startSession, endSession, cancelSession } = useSleepSession();

  const handleStartSleep = async () => {
    await startSession();
  };

  const handleWakeUp = async () => {
    const result = await endSession();
    if (!result) {
      Alert.alert(
        'Сессия сна не сохранена',
        'Прошло слишком мало или слишком много времени. Введите данные вручную.',
      );
      return;
    }
    addMutation.mutate({
      date: toLocalDateStr(new Date()),
      bedTime: result.bedTime,
      wakeTime: result.wakeTime,
      hours: result.hours,
      quality: 7,
    });
  };

  const handleCancelSession = () => {
    Alert.alert(
      'Отменить сессию?',
      'Запись не будет создана',
      [
        { text: 'Нет', style: 'cancel' },
        { text: 'Да, отменить', style: 'destructive', onPress: () => { cancelSession(); } },
      ],
    );
  };

  const barWidth = chartData.length > 0 ? Math.min((CHART_WIDTH - (chartData.length - 1) * 8) / chartData.length, 40) : 0;
  const maxHours = Math.max(...chartData.map((d) => d.hours), 10);

  const displayedRecords = isExpanded ? records : records.slice(0, COLLAPSED_ITEMS);
  const hasMoreRecords = records.length > COLLAPSED_ITEMS;

  let cardIdx = 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Hero card */}
        <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerTranslate }] }}>
          <MetricHero
            icon="moon"
            title="Сон"
            color={colors.sleep}
            colorMuted={colors.sleepMuted}
            hasTodayRecord={!!todayRecord}
            subtitle={
              todayRecord
                ? `Сегодня: ${todayRecord.hours.toFixed(1)}ч · качество ${todayRecord.quality}/10`
                : session
                  ? `Сплю с ${session.bedTimeHHMM}`
                  : 'Запись за сегодня не добавлена'
            }
            onAction={
              session
                ? undefined
                : () => {
                    setEditRecord(todayRecord ?? null);
                    setModalVisible(true);
                  }
            }
            actionLabel={todayRecord ? 'Изменить сегодня' : 'Ввести вручную'}
          >
            {/* Если активна sleep-сессия — показываем спец-CTA внутри hero */}
            {session ? (
              <View style={styles.sessionInline}>
                <TouchableOpacity
                  style={[styles.wakeButton, { backgroundColor: colors.sleep }]}
                  onPress={handleWakeUp}
                  activeOpacity={0.85}
                  disabled={addMutation.isPending}
                >
                  <Ionicons name="sunny" size={20} color="#fff" />
                  <Text style={styles.wakeButtonText}>Проснулся</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCancelSession} activeOpacity={0.7} style={styles.cancelSessionLink}>
                  <Text style={styles.cancelSessionText}>Отменить сессию</Text>
                </TouchableOpacity>
              </View>
            ) : !todayRecord ? (
              <TouchableOpacity
                style={[styles.bedButton, { backgroundColor: colors.sleep }]}
                onPress={handleStartSleep}
                activeOpacity={0.85}
              >
                <Ionicons name="moon" size={20} color="#fff" />
                <Text style={styles.bedButtonText}>Иду спать (запустить таймер)</Text>
              </TouchableOpacity>
            ) : null}
          </MetricHero>
        </Animated.View>

        {/* Stats row — avg / trend / best */}
        {chartData.length > 0 && (() => {
          const trend = computeTrend(chartData.map((d) => d.hours))
          const bestHours = chartData.reduce((m, d) => Math.max(m, d.hours), 0)
          return (
            <AnimatedCard index={cardIdx++} style={{ marginTop: Spacing.md }}>
              <StatRow>
                <StatCard
                  label={`Среднее за ${chartData.length} дн.`}
                  value={`${weeklyAvg}ч`}
                  hint="Цель: 8ч"
                  accent={colors.sleep}
                />
                <TrendCard trend={trend.dir} percent={trend.percent} />
                <StatCard
                  label="Лучший день"
                  value={`${bestHours.toFixed(1)}ч`}
                  hint="За период"
                  accent={colors.success}
                />
              </StatRow>
            </AnimatedCard>
          )
        })()}

        {/* Chart */}
        <AnimatedCard index={cardIdx++} style={{ marginTop: Spacing.md }}>
          <AccentCard color={colors.sleep} style={styles.chartCardInner}>
            <Text style={styles.cardTitle}>Сон за 7 дней</Text>
            {chartData.length === 0 ? (
              <View style={styles.emptyChart}>
                <Ionicons name="bar-chart-outline" size={32} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>Нет данных за последние 7 дней</Text>
              </View>
            ) : (
              <View style={styles.chartContainer}>
                <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                  {chartData.map((d, i) => {
                    const barHeight = Math.max((d.hours / maxHours) * (CHART_HEIGHT - 50), 4);
                    const totalWidth = chartData.length * barWidth + (chartData.length - 1) * 8;
                    const startX = (CHART_WIDTH - totalWidth) / 2;
                    const x = startX + i * (barWidth + 8);
                    const y = CHART_HEIGHT - 35 - barHeight;
                    return (
                      <React.Fragment key={i}>
                        <Rect x={x} y={y} width={barWidth} height={barHeight} rx={8} fill={colors.sleep} />
                        <SvgText x={x + barWidth / 2} y={CHART_HEIGHT - 12} fontSize={10} fill={colors.mutedForeground} textAnchor="middle">
                          {d.date}
                        </SvgText>
                        <SvgText x={x + barWidth / 2} y={y - 8} fontSize={11} fill={colors.foreground} fontWeight="600" textAnchor="middle">
                          {d.hours.toFixed(1)}
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
              <Ionicons name="document-text-outline" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>Нет записей</Text>
              <Text style={styles.emptyHint}>Добавьте первую запись о сне</Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {displayedRecords.map((record, index) => (
                <HistoryItem
                  key={record.id}
                  record={record}
                  index={index}
                  onEdit={() => handleEdit(record)}
                  onDelete={() => handleDelete(record.id)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Floating Add Button */}
        <TouchableOpacity
          style={styles.fabButton}
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

      {/* Modal */}
      <SleepModal
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.sleepMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  addHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.sleep,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: colors.sleep, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  todayCard: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  todayLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: colors.mutedForeground,
  },
  todayContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  todayValue: {
    fontSize: 48,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
  },
  todayUnit: {
    fontSize: FontSize.lg,
    color: colors.mutedForeground,
  },
  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,191,36,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  todayQuality: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#fbbf24',
  },
  todayEmpty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  todayEmptyText: {
    fontSize: FontSize.sm,
    color: colors.mutedForeground,
  },
  todayAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.sleepMuted,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  todayAddText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: colors.sleep,
  },
  bedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.sleep,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    width: '100%',
  },
  bedButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  manualLink: { paddingVertical: 8 },
  manualLinkText: {
    fontSize: FontSize.sm,
    color: colors.mutedForeground,
    textDecorationLine: 'underline',
  },
  sessionActive: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: 4,
  },
  sessionLabel: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
  },
  sessionTime: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
  },
  wakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f59e0b',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    width: '100%',
  },
  wakeButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  cancelSessionLink: { paddingVertical: 6 },
  cancelSessionText: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    textDecorationLine: 'underline',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: 6,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
  },
  statLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  chartCardInner: {
    padding: Spacing.lg,
  },
  sessionInline: {
    gap: Spacing.sm,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: colors.mutedForeground,
    marginBottom: Spacing.md,
  },
  chartContainer: {
    alignItems: 'center',
  },
  emptyChart: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: colors.mutedForeground,
  },
  historySection: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandText: {
    fontSize: FontSize.sm,
    color: colors.primary,
    fontWeight: FontWeight.medium,
  },
  emptyHistory: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
  },
  emptyHint: {
    fontSize: FontSize.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  historyList: {
    gap: Spacing.sm,
  },
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  historyMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  historyIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.sleepMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyContent: {
    flex: 1,
  },
  historyDate: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: colors.foreground,
  },
  historyTime: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  historyStats: {
    alignItems: 'flex-end',
  },
  historyHours: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
  },
  qualityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  historyQuality: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
  },
  actionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  actionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: colors.sleep,
    paddingVertical: 16,
    borderRadius: BorderRadius.xl,
    ...Platform.select({
      ios: { shadowColor: colors.sleep, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  fabText: {
    color: '#fff',
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: colors.foreground,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    color: colors.foreground,
  },
  timeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  hoursPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: colors.sleepMuted,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  hoursPreviewText: {
    fontSize: FontSize.base,
    color: colors.foreground,
  },
  hoursPreviewValue: {
    fontWeight: FontWeight.bold,
    color: colors.sleep,
  },
  qualityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  qualityButton: {
    padding: 4,
  },
  qualityButtonActive: {},
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: colors.secondary,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: colors.sleep,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#fff',
  },
});