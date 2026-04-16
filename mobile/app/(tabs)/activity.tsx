// app/(tabs)/activity.tsx
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
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { getActivityRecords, addActivityRecord, updateActivityRecord, deleteActivityRecord } from '@/lib/health-api';
import type { ActivityRecord } from '@/types/health';

const CHART_HEIGHT = 180;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - Spacing.lg * 4;
const COLLAPSED_ITEMS = 3;

const TYPE_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  walking: { label: 'Ходьба', icon: 'walk', color: '#22c55e' },
  running: { label: 'Бег', icon: 'fitness', color: '#f97316' },
  gym: { label: 'Зал', icon: 'barbell', color: '#8b5cf6' },
  cycling: { label: 'Велосипед', icon: 'bicycle', color: '#06b6d4' },
  swimming: { label: 'Плавание', icon: 'water', color: '#3b82f6' },
  other: { label: 'Другое', icon: 'body', color: '#6b7280' },
};

function formatDay(date: string) {
  return new Date(date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
}

function aggregateByDay(records: { date: string; duration: number; steps?: number }[]) {
  const map = new Map<string, { duration: number; steps: number }>();
  for (const r of records) {
    const day = r.date.slice(0, 10);
    const existing = map.get(day) ?? { duration: 0, steps: 0 };
    map.set(day, {
      duration: existing.duration + r.duration,
      steps: existing.steps + (r.steps ?? 0),
    });
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, agg]) => ({ date: formatDay(date), duration: agg.duration, steps: agg.steps }));
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Animated Card
function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) {
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
  record: ActivityRecord;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [showActions, setShowActions] = useState(false);
  const typeConfig = TYPE_CONFIG[record.type ?? 'other'] || TYPE_CONFIG.other;

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
            <View style={[styles.historyIconWrapper, { backgroundColor: typeConfig.color + '20' }]}>
              <Ionicons name={typeConfig.icon} size={18} color={typeConfig.color} />
            </View>
            <View style={styles.historyContent}>
              <Text style={styles.historyDate}>
                {new Date(record.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </Text>
              <View style={styles.typeBadge}>
                <Text style={[styles.historyType, { color: typeConfig.color }]}>{typeConfig.label}</Text>
              </View>
            </View>
            <View style={styles.historyStats}>
              <Text style={styles.historyDuration}>{record.duration}м</Text>
              {record.steps ? (
                <View style={styles.stepsBadge}>
                  <Ionicons name="footsteps" size={10} color={Colors.mutedForeground} />
                  <Text style={styles.historySteps}>{record.steps.toLocaleString()}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {showActions && (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={onEdit} activeOpacity={0.7}>
                <Ionicons name="pencil" size={16} color={Colors.primary} />
                <Text style={[styles.actionText, { color: Colors.primary }]}>Изменить</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={onDelete} activeOpacity={0.7}>
                <Ionicons name="trash" size={16} color={Colors.destructive} />
                <Text style={[styles.actionText, { color: Colors.destructive }]}>Удалить</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </AnimatedCard>
  );
}

// Type Selector
function TypeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.typeGrid}>
      {Object.entries(TYPE_CONFIG).map(([key, config]) => (
        <TouchableOpacity
          key={key}
          style={[styles.typeItem, value === key && { backgroundColor: config.color + '20', borderColor: config.color }]}
          onPress={() => onChange(key)}
          activeOpacity={0.7}
        >
          <Ionicons name={config.icon} size={20} color={value === key ? config.color : Colors.mutedForeground} />
          <Text style={[styles.typeItemText, value === key && { color: config.color }]}>{config.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Add/Edit Modal
function ActivityModal({
  visible,
  onClose,
  onSave,
  editRecord,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { date: string; type: string; duration: number; steps?: number; calories?: number }) => void;
  editRecord: ActivityRecord | null;
  isLoading: boolean;
}) {
  const [date, setDate] = useState(toLocalDateStr(new Date()));
  const [type, setType] = useState('walking');
  const [duration, setDuration] = useState('30');
  const [steps, setSteps] = useState('');
  const [calories, setCalories] = useState('');

  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (editRecord) {
        setDate(editRecord.date.slice(0, 10));
        setType(editRecord.type ?? 'walking');
        setDuration(String(editRecord.duration));
        setSteps(editRecord.steps ? String(editRecord.steps) : '');
        setCalories(editRecord.caloriesBurned ? String(editRecord.caloriesBurned) : editRecord.calories ? String(editRecord.calories) : '');
      } else {
        setDate(toLocalDateStr(new Date()));
        setType('walking');
        setDuration('30');
        setSteps('');
        setCalories('');
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
    onSave({
      date,
      type,
      duration: parseInt(duration) || 0,
      steps: steps ? parseInt(steps) : undefined,
      calories: calories ? parseInt(calories) : undefined,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
          <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editRecord ? 'Редактировать' : 'Новая активность'}</Text>

            {/* Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Дата</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="calendar" size={18} color={Colors.mutedForeground} />
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.mutedForeground}
                />
              </View>
            </View>

            {/* Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Тип активности</Text>
              <TypeSelector value={type} onChange={setType} />
            </View>

            {/* Duration & Steps */}
            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Длительность</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="time" size={18} color={Colors.activity} />
                  <TextInput
                    style={styles.input}
                    value={duration}
                    onChangeText={setDuration}
                    placeholder="30"
                    keyboardType="numeric"
                    placeholderTextColor={Colors.mutedForeground}
                  />
                  <Text style={styles.inputSuffix}>мин</Text>
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Шаги</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="footsteps" size={18} color={Colors.primary} />
                  <TextInput
                    style={styles.input}
                    value={steps}
                    onChangeText={setSteps}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor={Colors.mutedForeground}
                  />
                </View>
              </View>
            </View>

            {/* Calories */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Калории (опционально)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="flame" size={18} color="#f97316" />
                <TextInput
                  style={styles.input}
                  value={calories}
                  onChangeText={setCalories}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.mutedForeground}
                />
                <Text style={styles.inputSuffix}>ккал</Text>
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

export default function ActivityScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState<ActivityRecord | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(-15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(headerTranslate, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: getActivityRecords,
  });

  const addMutation = useMutation({
    mutationFn: addActivityRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      setModalVisible(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ActivityRecord> }) => updateActivityRecord(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      setModalVisible(false);
      setEditRecord(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteActivityRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });

  async function onRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['activity'] });
    setRefreshing(false);
  }

  const handleSave = (data: { date: string; type: string; duration: number; steps?: number; calories?: number }) => {
    if (editRecord) {
      updateMutation.mutate({ id: editRecord.id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const handleEdit = (record: ActivityRecord) => {
    setEditRecord(record);
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const chartData = useMemo(() => aggregateByDay(records), [records]);
  const weeklyTotal = useMemo(() => chartData.reduce((sum, d) => sum + d.duration, 0), [chartData]);
  const weeklySteps = useMemo(() => chartData.reduce((sum, d) => sum + d.steps, 0), [chartData]);

  const todayRecord = useMemo(() => {
    const today = toLocalDateStr(new Date());
    return records.filter((r) => r.date.slice(0, 10) === today);
  }, [records]);

  const todayDuration = todayRecord.reduce((s, r) => s + r.duration, 0);
  const todaySteps = todayRecord.reduce((s, r) => s + (r.steps ?? 0), 0);

  const barWidth = chartData.length > 0 ? Math.min((CHART_WIDTH - (chartData.length - 1) * 8) / chartData.length, 40) : 0;
  const maxDuration = Math.max(...chartData.map((d) => d.duration), 60);

  const displayedRecords = isExpanded ? records : records.slice(0, COLLAPSED_ITEMS);
  const hasMoreRecords = records.length > COLLAPSED_ITEMS;

  let cardIdx = 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerFade, transform: [{ translateY: headerTranslate }] }]}>
          <View style={styles.headerLeft}>
            <View style={styles.iconWrapper}>
              <Ionicons name="flame" size={26} color={Colors.activity} />
            </View>
            <View>
              <Text style={styles.title}>Активность</Text>
              <Text style={styles.subtitle}>Отслеживание тренировок</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.addHeaderButton}
            onPress={() => {
              setEditRecord(null);
              setModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* Today card */}
        <AnimatedCard index={cardIdx++} style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <Text style={styles.todayLabel}>Сегодня</Text>
            <View style={styles.todayBadge}>
              <Ionicons name="flash" size={12} color={Colors.activity} />
              <Text style={styles.todayBadgeText}>{todayRecord.length} активностей</Text>
            </View>
          </View>
          {todayRecord.length > 0 ? (
            <View style={styles.todayContent}>
              <View style={styles.todayStat}>
                <Text style={styles.todayValue}>{todayDuration}</Text>
                <Text style={styles.todayUnit}>минут</Text>
              </View>
              {todaySteps > 0 && (
                <View style={styles.todayStatDivider} />
              )}
              {todaySteps > 0 && (
                <View style={styles.todayStat}>
                  <Text style={styles.todayValue}>{todaySteps.toLocaleString()}</Text>
                  <Text style={styles.todayUnit}>шагов</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.todayEmpty}>
              <Ionicons name="fitness-outline" size={32} color={Colors.mutedForeground} />
              <Text style={styles.todayEmptyText}>Нет активностей сегодня</Text>
              <TouchableOpacity
                style={styles.todayAddButton}
                onPress={() => {
                  setEditRecord(null);
                  setModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color={Colors.activity} />
                <Text style={styles.todayAddText}>Добавить</Text>
              </TouchableOpacity>
            </View>
          )}
        </AnimatedCard>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <AnimatedCard index={cardIdx++} style={styles.statCard}>
            <Ionicons name="time" size={20} color={Colors.activity} />
            <Text style={styles.statValue}>{weeklyTotal}м</Text>
            <Text style={styles.statLabel}>за 7 дней</Text>
          </AnimatedCard>
          <AnimatedCard index={cardIdx++} style={styles.statCard}>
            <Ionicons name="footsteps" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{weeklySteps.toLocaleString()}</Text>
            <Text style={styles.statLabel}>шагов</Text>
          </AnimatedCard>
          <AnimatedCard index={cardIdx++} style={styles.statCard}>
            <Ionicons name="calendar" size={20} color="#8b5cf6" />
            <Text style={styles.statValue}>{records.length}</Text>
            <Text style={styles.statLabel}>записей</Text>
          </AnimatedCard>
        </View>

        {/* Chart */}
        <AnimatedCard index={cardIdx++} style={styles.chartCard}>
          <Text style={styles.cardTitle}>Активность за 7 дней</Text>
          {chartData.length === 0 ? (
            <View style={styles.emptyChart}>
              <Ionicons name="bar-chart-outline" size={32} color={Colors.mutedForeground} />
              <Text style={styles.emptyText}>Нет данных за последние 7 дней</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                {chartData.map((d, i) => {
                  const barHeight = Math.max((d.duration / maxDuration) * (CHART_HEIGHT - 50), 4);
                  const totalWidth = chartData.length * barWidth + (chartData.length - 1) * 8;
                  const startX = (CHART_WIDTH - totalWidth) / 2;
                  const x = startX + i * (barWidth + 8);
                  const y = CHART_HEIGHT - 35 - barHeight;
                  return (
                    <React.Fragment key={i}>
                      <Rect x={x} y={y} width={barWidth} height={barHeight} rx={8} fill={Colors.activity} />
                      <SvgText x={x + barWidth / 2} y={CHART_HEIGHT - 12} fontSize={10} fill={Colors.mutedForeground} textAnchor="middle">
                        {d.date}
                      </SvgText>
                      <SvgText x={x + barWidth / 2} y={y - 8} fontSize={11} fill={Colors.foreground} fontWeight="600" textAnchor="middle">
                        {d.duration}м
                      </SvgText>
                    </React.Fragment>
                  );
                })}
              </Svg>
            </View>
          )}
        </AnimatedCard>

        {/* History */}
        <View style={styles.historySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>История</Text>
            {hasMoreRecords && (
              <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} activeOpacity={0.7} style={styles.expandButton}>
                <Text style={styles.expandText}>{isExpanded ? 'Свернуть' : `Ещё ${records.length - COLLAPSED_ITEMS}`}</Text>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {records.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="document-text-outline" size={40} color={Colors.mutedForeground} />
              <Text style={styles.emptyTitle}>Нет записей</Text>
              <Text style={styles.emptyHint}>Добавьте первую активность</Text>
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
          <Text style={styles.fabText}>Добавить активность</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl + 20 }} />
      </ScrollView>

      <ActivityModal
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.activityMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.mutedForeground,
    marginTop: 2,
  },
  addHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.activity,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: Colors.activity, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  todayCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.mutedForeground,
  },
  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.activityMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.activity,
  },
  todayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  todayStat: {
    alignItems: 'center',
  },
  todayStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  todayValue: {
    fontSize: 36,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  todayUnit: {
    fontSize: FontSize.sm,
    color: Colors.mutedForeground,
    marginTop: 2,
  },
  todayEmpty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  todayEmptyText: {
    fontSize: FontSize.sm,
    color: Colors.mutedForeground,
  },
  todayAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.activityMuted,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  todayAddText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.activity,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: 4,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  statLabel: {
    fontSize: 9,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.mutedForeground,
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
    color: Colors.mutedForeground,
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
    color: Colors.foreground,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  emptyHistory: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.foreground,
  },
  emptyHint: {
    fontSize: FontSize.sm,
    color: Colors.mutedForeground,
    textAlign: 'center',
  },
  historyList: {
    gap: Spacing.sm,
  },
  historyCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyContent: {
    flex: 1,
  },
  historyDate: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.foreground,
  },
  typeBadge: {
    marginTop: 4,
  },
  historyType: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  historyStats: {
    alignItems: 'flex-end',
  },
  historyDuration: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  stepsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  historySteps: {
    fontSize: FontSize.xs,
    color: Colors.mutedForeground,
  },
  actionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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
    backgroundColor: Colors.activity,
    paddingVertical: 16,
    borderRadius: BorderRadius.xl,
    ...Platform.select({
      ios: { shadowColor: Colors.activity, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
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
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.lg,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.foreground,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.foreground,
  },
  inputSuffix: {
    fontSize: FontSize.sm,
    color: Colors.mutedForeground,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.secondary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeItemText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.mutedForeground,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.foreground,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.activity,
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
