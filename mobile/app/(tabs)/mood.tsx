// app/(tabs)/mood.tsx
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
import Svg, { Line, Circle, Text as SvgText, Rect } from 'react-native-svg';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { getMoodRecords, addMoodRecord, updateMoodRecord, deleteMoodRecord } from '@/lib/health-api';
import type { MoodRecord } from '@/types/health';

const CHART_HEIGHT = 180;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - Spacing.lg * 4;
const COLLAPSED_ITEMS = 3;

const MOOD_EMOJIS = ['😞', '😕', '😐', '🙂', '😊'];
const MOOD_LABELS = ['Плохо', 'Так себе', 'Нейтрально', 'Хорошо', 'Отлично'];

function getMoodEmoji(value: number): string {
  if (value <= 2) return '😞';
  if (value <= 4) return '😕';
  if (value <= 6) return '😐';
  if (value <= 8) return '😊';
  return '😄';
}

function getMoodLabel(value: number): string {
  if (value <= 2) return 'Плохо';
  if (value <= 4) return 'Так себе';
  if (value <= 6) return 'Нейтрально';
  if (value <= 8) return 'Хорошо';
  return 'Отлично';
}

function getMoodColor(value: number): string {
  if (value <= 2) return '#ef4444';
  if (value <= 4) return '#f97316';
  if (value <= 6) return '#eab308';
  if (value <= 8) return '#22c55e';
  return '#10b981';
}

function formatDay(date: string) {
  return new Date(date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
}

function aggregateByDay(records: MoodRecord[]) {
  const map = new Map<string, number[]>();
  for (const r of records) {
    const day = r.date.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(r.value);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, values]) => ({
      date: formatDay(date),
      value: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
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
  record: MoodRecord;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [showActions, setShowActions] = useState(false);
  const moodColor = getMoodColor(record.value);

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
            <View style={[styles.historyIconWrapper, { backgroundColor: moodColor + '20' }]}>
              <Text style={styles.moodEmoji}>{getMoodEmoji(record.value)}</Text>
            </View>
            <View style={styles.historyContent}>
              <Text style={styles.historyDate}>
                {new Date(record.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </Text>
              <Text style={[styles.historyLabel, { color: moodColor }]}>{getMoodLabel(record.value)}</Text>
            </View>
            <View style={styles.historyStats}>
              <Text style={styles.historyValue}>{record.value}/10</Text>
            </View>
          </View>

          {record.notes && (
            <View style={styles.notesPreview}>
              <Ionicons name="chatbubble-outline" size={12} color={Colors.mutedForeground} />
              <Text style={styles.notesText} numberOfLines={1}>{record.notes}</Text>
            </View>
          )}

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

// Mood Picker
function MoodPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.moodPickerContainer}>
      {[1, 2, 3, 4, 5].map((level) => {
        const moodValue = level * 2;
        const isSelected = value === moodValue;
        return (
          <TouchableOpacity
            key={level}
            style={[styles.moodPickerItem, isSelected && styles.moodPickerItemActive]}
            onPress={() => onChange(moodValue)}
            activeOpacity={0.7}
          >
            <Text style={[styles.moodPickerEmoji, isSelected && styles.moodPickerEmojiActive]}>
              {MOOD_EMOJIS[level - 1]}
            </Text>
            <Text style={[styles.moodPickerLabel, isSelected && styles.moodPickerLabelActive]}>
              {MOOD_LABELS[level - 1]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Modal
function MoodModal({
  visible,
  onClose,
  onSave,
  editRecord,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { date: string; value: number; notes?: string }) => void;
  editRecord: MoodRecord | null;
  isLoading: boolean;
}) {
  const [date, setDate] = useState(toLocalDateStr(new Date()));
  const [value, setValue] = useState(6);
  const [notes, setNotes] = useState('');

  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (editRecord) {
        setDate(editRecord.date.slice(0, 10));
        setValue(editRecord.value);
        setNotes(editRecord.notes ?? '');
      } else {
        setDate(toLocalDateStr(new Date()));
        setValue(6);
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
    onSave({ date, value, notes: notes || undefined });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
          <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editRecord ? 'Редактировать' : 'Как настроение?'}</Text>

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

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ваше настроение</Text>
              <MoodPicker value={value} onChange={setValue} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Заметка (опционально)</Text>
              <View style={[styles.inputWrapper, { minHeight: 80, alignItems: 'flex-start' }]}>
                <TextInput
                  style={[styles.input, { textAlignVertical: 'top', paddingTop: 8 }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Что повлияло на ваше настроение?"
                  placeholderTextColor={Colors.mutedForeground}
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
                style={[styles.saveButton, { backgroundColor: Colors.mood }, isLoading && styles.saveButtonDisabled]}
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

export default function MoodScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState<MoodRecord | null>(null);
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
    queryKey: ['mood'],
    queryFn: getMoodRecords,
  });

  const addMutation = useMutation({
    mutationFn: addMoodRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mood'] });
      setModalVisible(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MoodRecord> }) => updateMoodRecord(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mood'] });
      setModalVisible(false);
      setEditRecord(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMoodRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mood'] });
    },
  });

  async function onRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['mood'] });
    setRefreshing(false);
  }

  const handleSave = (data: { date: string; value: number; notes?: string }) => {
    if (editRecord) {
      updateMutation.mutate({ id: editRecord.id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const chartData = useMemo(() => aggregateByDay(records), [records]);
  const avgMood = useMemo(() => {
    if (chartData.length === 0) return null;
    return Math.round(chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length);
  }, [chartData]);

  const todayMood = useMemo(() => {
    const todayRecords = records.filter((r) => r.date.slice(0, 10) === todayStr);
    if (todayRecords.length === 0) return null;
    return Math.round(todayRecords.reduce((s, r) => s + r.value, 0) / todayRecords.length);
  }, [records, todayStr]);

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
            <View style={[styles.iconWrapper, { backgroundColor: Colors.moodMuted }]}>
              <Ionicons name="happy" size={26} color={Colors.mood} />
            </View>
            <View>
              <Text style={styles.title}>Настроение</Text>
              <Text style={styles.subtitle}>Отслеживание эмоций</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.addHeaderButton, { backgroundColor: Colors.mood }]}
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
          <Text style={styles.todayLabel}>Сегодня</Text>
          {todayMood ? (
            <View style={styles.todayContent}>
              <Text style={styles.todayEmoji}>{getMoodEmoji(todayMood)}</Text>
              <View style={styles.todayValueWrapper}>
                <Text style={styles.todayValue}>{todayMood}/10</Text>
                <Text style={[styles.todayMoodLabel, { color: getMoodColor(todayMood) }]}>{getMoodLabel(todayMood)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.todayEmpty}>
              <Ionicons name="happy-outline" size={32} color={Colors.mutedForeground} />
              <Text style={styles.todayEmptyText}>Как ваше настроение?</Text>
              <TouchableOpacity
                style={[styles.todayAddButton, { backgroundColor: Colors.moodMuted }]}
                onPress={() => {
                  setEditRecord(null);
                  setModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color={Colors.mood} />
                <Text style={[styles.todayAddText, { color: Colors.mood }]}>Добавить</Text>
              </TouchableOpacity>
            </View>
          )}
        </AnimatedCard>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <AnimatedCard index={cardIdx++} style={styles.statCard}>
            <Text style={styles.statEmoji}>{avgMood ? getMoodEmoji(avgMood) : '😐'}</Text>
            <Text style={styles.statValue}>{avgMood ?? '—'}/10</Text>
            <Text style={styles.statLabel}>среднее за 7 дней</Text>
          </AnimatedCard>
          <AnimatedCard index={cardIdx++} style={styles.statCard}>
            <Ionicons name="document-text" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{records.length}</Text>
            <Text style={styles.statLabel}>записей</Text>
          </AnimatedCard>
        </View>

        {/* Chart */}
        <AnimatedCard index={cardIdx++} style={styles.chartCard}>
          <Text style={styles.cardTitle}>Настроение за 7 дней</Text>
          {chartData.length === 0 ? (
            <View style={styles.emptyChart}>
              <Ionicons name="analytics-outline" size={32} color={Colors.mutedForeground} />
              <Text style={styles.emptyText}>Нет данных за последние 7 дней</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                {/* Grid lines */}
                {[2, 4, 6, 8, 10].map((y) => (
                  <Line
                    key={y}
                    x1={0}
                    y1={CHART_HEIGHT - 30 - ((y / 10) * (CHART_HEIGHT - 50))}
                    x2={CHART_WIDTH}
                    y2={CHART_HEIGHT - 30 - ((y / 10) * (CHART_HEIGHT - 50))}
                    stroke={Colors.border}
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                ))}
                {/* Line */}
                {chartData.map((d, i) => {
                  if (i === 0) return null;
                  const prev = chartData[i - 1];
                  const gap = CHART_WIDTH / (chartData.length - 1 || 1);
                  const x1 = (i - 1) * gap;
                  const y1 = CHART_HEIGHT - 30 - ((prev.value / 10) * (CHART_HEIGHT - 50));
                  const x2 = i * gap;
                  const y2 = CHART_HEIGHT - 30 - ((d.value / 10) * (CHART_HEIGHT - 50));
                  return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={Colors.mood} strokeWidth={3} />;
                })}
                {/* Points */}
                {chartData.map((d, i) => {
                  const gap = CHART_WIDTH / (chartData.length - 1 || 1);
                  const x = chartData.length === 1 ? CHART_WIDTH / 2 : i * gap;
                  const y = CHART_HEIGHT - 30 - ((d.value / 10) * (CHART_HEIGHT - 50));
                  return (
                    <React.Fragment key={i}>
                      <Circle cx={x} cy={y} r={6} fill={Colors.mood} />
                      <Circle cx={x} cy={y} r={3} fill="#fff" />
                      <SvgText x={x} y={CHART_HEIGHT - 8} fontSize={10} fill={Colors.mutedForeground} textAnchor="middle">
                        {d.date}
                      </SvgText>
                      <SvgText x={x} y={y - 12} fontSize={11} fill={Colors.foreground} fontWeight="600" textAnchor="middle">
                        {d.value}
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
              <Ionicons name="happy-outline" size={40} color={Colors.mutedForeground} />
              <Text style={styles.emptyTitle}>Нет записей</Text>
              <Text style={styles.emptyHint}>Добавьте первую запись настроения</Text>
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
          style={[styles.fabButton, { backgroundColor: Colors.mood }]}
          onPress={() => {
            setEditRecord(null);
            setModalVisible(true);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.fabText}>Добавить настроение</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl + 20 }} />
      </ScrollView>

      <MoodModal
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
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWrapper: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.foreground },
  subtitle: { fontSize: FontSize.sm, color: Colors.mutedForeground, marginTop: 2 },
  addHeaderButton: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowColor: Colors.mood, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 6 } }),
  },
  todayCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginBottom: Spacing.md,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  todayLabel: { fontSize: FontSize.sm, color: Colors.mutedForeground, marginBottom: Spacing.md },
  todayContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  todayEmoji: { fontSize: 56 },
  todayValueWrapper: { flex: 1 },
  todayValue: { fontSize: 32, fontWeight: FontWeight.bold, color: Colors.foreground },
  todayMoodLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginTop: 2 },
  todayEmpty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  todayEmptyText: { fontSize: FontSize.sm, color: Colors.mutedForeground },
  todayAddButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  todayAddText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', paddingVertical: Spacing.lg, gap: 4,
  },
  statEmoji: { fontSize: 28 },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.foreground },
  statLabel: { fontSize: 10, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3 },
  chartCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginBottom: Spacing.lg },
  cardTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.mutedForeground, marginBottom: Spacing.md },
  chartContainer: { alignItems: 'center' },
  emptyChart: { height: 140, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.mutedForeground },
  historySection: { marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.foreground },
  expandButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  expandText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  emptyHistory: { backgroundColor: Colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.foreground },
  emptyHint: { fontSize: FontSize.sm, color: Colors.mutedForeground },
  historyList: { gap: Spacing.sm },
  historyCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  historyMain: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  historyIconWrapper: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  moodEmoji: { fontSize: 22 },
  historyContent: { flex: 1 },
  historyDate: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: Colors.foreground },
  historyLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: 2 },
  historyStats: { alignItems: 'flex-end' },
  historyValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.foreground },
  notesPreview: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  notesText: { fontSize: FontSize.xs, color: Colors.mutedForeground, flex: 1 },
  actionsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  actionText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  fabButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 16, borderRadius: BorderRadius.xl,
    ...Platform.select({ ios: { shadowColor: Colors.mood, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 }, android: { elevation: 6 } }),
  },
  fabText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.lg },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.foreground, marginBottom: Spacing.lg, textAlign: 'center' },
  inputGroup: { marginBottom: Spacing.md },
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.foreground, marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.secondary, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 12 },
  input: { flex: 1, fontSize: FontSize.base, color: Colors.foreground },
  moodPickerContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  moodPickerItem: { alignItems: 'center', padding: Spacing.sm, borderRadius: 12, backgroundColor: Colors.secondary, flex: 1, marginHorizontal: 2 },
  moodPickerItemActive: { backgroundColor: Colors.moodMuted, borderWidth: 2, borderColor: Colors.mood },
  moodPickerEmoji: { fontSize: 24, opacity: 0.5 },
  moodPickerEmojiActive: { opacity: 1 },
  moodPickerLabel: { fontSize: 9, color: Colors.mutedForeground, marginTop: 4, textAlign: 'center' },
  moodPickerLabelActive: { color: Colors.mood, fontWeight: FontWeight.medium },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.lg, backgroundColor: Colors.secondary, alignItems: 'center' },
  cancelButtonText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.foreground },
  saveButton: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: BorderRadius.lg },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: '#fff' },
});