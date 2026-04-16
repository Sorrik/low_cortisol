// app/(tabs)/nutrition.tsx
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
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { getNutritionRecords, addNutritionRecord, updateNutritionRecord, deleteNutritionRecord } from '@/lib/health-api';
import type { NutritionRecord } from '@/types/health';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLLAPSED_ITEMS = 3;

const MEAL_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  breakfast: { label: 'Завтрак', icon: 'sunny', color: '#f59e0b' },
  lunch: { label: 'Обед', icon: 'restaurant', color: '#22c55e' },
  dinner: { label: 'Ужин', icon: 'moon', color: '#6366f1' },
  snack: { label: 'Перекус', icon: 'cafe', color: '#ec4899' },
};

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Progress Ring Component
function ProgressRing({ progress, size = 120, strokeWidth = 10, color = Colors.nutrition }: { progress: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <View
          style={{
            width: size - strokeWidth * 2,
            height: size - strokeWidth * 2,
            borderRadius: (size - strokeWidth * 2) / 2,
            backgroundColor: Colors.secondary,
          }}
        />
      </View>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          borderTopColor: clampedProgress < 25 ? Colors.secondary : color,
          borderRightColor: clampedProgress < 50 ? Colors.secondary : color,
          borderBottomColor: clampedProgress < 75 ? Colors.secondary : color,
          borderLeftColor: clampedProgress < 100 ? Colors.secondary : color,
          transform: [{ rotate: '-90deg' }],
        }}
      />
    </View>
  );
}

// Progress Bar
function ProgressBar({ progress, color = Colors.primary, height = 6 }: { progress: number; color?: string; height?: number }) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  return (
    <View style={[styles.progressBar, { height }]}>
      <View style={[styles.progressFill, { width: `${clampedProgress}%`, backgroundColor: color }]} />
    </View>
  );
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

// Meal Item
function MealItem({
  record,
  index,
  onEdit,
  onDelete,
}: {
  record: NutritionRecord;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [showActions, setShowActions] = useState(false);
  const mealConfig = MEAL_CONFIG[record.mealType ?? 'snack'] || MEAL_CONFIG.snack;

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
        <Animated.View style={[styles.mealCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.mealMain}>
            <View style={[styles.mealIconWrapper, { backgroundColor: mealConfig.color + '20' }]}>
              <Ionicons name={mealConfig.icon} size={18} color={mealConfig.color} />
            </View>
            <View style={styles.mealContent}>
              <View style={styles.mealHeaderRow}>
                <Text style={[styles.mealType, { color: mealConfig.color }]}>{mealConfig.label}</Text>
                <Text style={styles.mealDate}>
                  {new Date(record.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
              {record.description && (
                <Text style={styles.mealDescription} numberOfLines={1}>{record.description}</Text>
              )}
            </View>
            <View style={styles.mealStats}>
              <Text style={styles.mealKcal}>{record.kcal}</Text>
              <Text style={styles.mealKcalUnit}>ккал</Text>
            </View>
          </View>

          <View style={styles.macrosPreview}>
            <View style={styles.macroMini}>
              <View style={[styles.macroDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.macroMiniText}>Б: {record.proteins}г</Text>
            </View>
            <View style={styles.macroMini}>
              <View style={[styles.macroDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.macroMiniText}>Ж: {record.fats}г</Text>
            </View>
            <View style={styles.macroMini}>
              <View style={[styles.macroDot, { backgroundColor: '#6366f1' }]} />
              <Text style={styles.macroMiniText}>У: {record.carbs}г</Text>
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

// Meal Type Selector
function MealTypeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.mealTypeGrid}>
      {Object.entries(MEAL_CONFIG).map(([key, config]) => (
        <TouchableOpacity
          key={key}
          style={[styles.mealTypeItem, value === key && { backgroundColor: config.color + '20', borderColor: config.color }]}
          onPress={() => onChange(key)}
          activeOpacity={0.7}
        >
          <Ionicons name={config.icon} size={20} color={value === key ? config.color : Colors.mutedForeground} />
          <Text style={[styles.mealTypeText, value === key && { color: config.color }]}>{config.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Add/Edit Modal
function NutritionModal({
  visible,
  onClose,
  onSave,
  editRecord,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { date: string; mealType: string; kcal: number; proteins: number; fats: number; carbs: number; description?: string }) => void;
  editRecord: NutritionRecord | null;
  isLoading: boolean;
}) {
  const [date, setDate] = useState(toLocalDateStr(new Date()));
  const [mealType, setMealType] = useState('lunch');
  const [kcal, setKcal] = useState('');
  const [proteins, setProteins] = useState('');
  const [fats, setFats] = useState('');
  const [carbs, setCarbs] = useState('');
  const [description, setDescription] = useState('');

  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (editRecord) {
        setDate(editRecord.date.slice(0, 10));
        setMealType(editRecord.mealType ?? 'lunch');
        setKcal(String(editRecord.kcal));
        setProteins(String(editRecord.proteins));
        setFats(String(editRecord.fats));
        setCarbs(String(editRecord.carbs));
        setDescription(editRecord.description ?? '');
      } else {
        setDate(toLocalDateStr(new Date()));
        setMealType('lunch');
        setKcal('');
        setProteins('');
        setFats('');
        setCarbs('');
        setDescription('');
      }
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 500, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, editRecord]);

  const handleSave = () => {
    onSave({
      date,
      mealType,
      kcal: parseInt(kcal) || 0,
      proteins: parseInt(proteins) || 0,
      fats: parseInt(fats) || 0,
      carbs: parseInt(carbs) || 0,
      description: description || undefined,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
          <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editRecord ? 'Редактировать' : 'Добавить прием пищи'}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
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

              {/* Meal Type */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Тип приема пищи</Text>
                <MealTypeSelector value={mealType} onChange={setMealType} />
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Описание (опционально)</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="document-text" size={18} color={Colors.mutedForeground} />
                  <TextInput
                    style={styles.input}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Овсянка с ягодами..."
                    placeholderTextColor={Colors.mutedForeground}
                  />
                </View>
              </View>

              {/* Calories */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Калории</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="flame" size={18} color={Colors.nutrition} />
                  <TextInput
                    style={styles.input}
                    value={kcal}
                    onChangeText={setKcal}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor={Colors.mutedForeground}
                  />
                  <Text style={styles.inputSuffix}>ккал</Text>
                </View>
              </View>

              {/* Macros */}
              <View style={styles.macrosInputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Белки</Text>
                  <View style={[styles.inputWrapper, styles.inputWrapperCompact]}>
                    <TextInput
                      style={styles.input}
                      value={proteins}
                      onChangeText={setProteins}
                      placeholder="0"
                      keyboardType="numeric"
                      placeholderTextColor={Colors.mutedForeground}
                    />
                    <Text style={styles.inputSuffix}>г</Text>
                  </View>
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Жиры</Text>
                  <View style={[styles.inputWrapper, styles.inputWrapperCompact]}>
                    <TextInput
                      style={styles.input}
                      value={fats}
                      onChangeText={setFats}
                      placeholder="0"
                      keyboardType="numeric"
                      placeholderTextColor={Colors.mutedForeground}
                    />
                    <Text style={styles.inputSuffix}>г</Text>
                  </View>
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Углеводы</Text>
                  <View style={[styles.inputWrapper, styles.inputWrapperCompact]}>
                    <TextInput
                      style={styles.input}
                      value={carbs}
                      onChangeText={setCarbs}
                      placeholder="0"
                      keyboardType="numeric"
                      placeholderTextColor={Colors.mutedForeground}
                    />
                    <Text style={styles.inputSuffix}>г</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

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

export default function NutritionScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState<NutritionRecord | null>(null);
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

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['nutrition'],
    queryFn: getNutritionRecords,
  });

  const addMutation = useMutation({
    mutationFn: addNutritionRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition'] });
      setModalVisible(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NutritionRecord> }) => updateNutritionRecord(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition'] });
      setModalVisible(false);
      setEditRecord(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNutritionRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition'] });
    },
  });

  async function onRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['nutrition'] });
    setRefreshing(false);
  }

  const handleSave = (data: { date: string; mealType: string; kcal: number; proteins: number; fats: number; carbs: number; description?: string }) => {
    if (editRecord) {
      updateMutation.mutate({ id: editRecord.id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const handleEdit = (record: NutritionRecord) => {
    setEditRecord(record);
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const todayData = useMemo(() => {
    const todayRecords = records.filter((r) => r.date.slice(0, 10) === todayStr);
    return {
      kcal: todayRecords.reduce((s, r) => s + r.kcal, 0),
      proteins: todayRecords.reduce((s, r) => s + r.proteins, 0),
      fats: todayRecords.reduce((s, r) => s + r.fats, 0),
      carbs: todayRecords.reduce((s, r) => s + r.carbs, 0),
      records: todayRecords,
    };
  }, [records, todayStr]);

  const goals = { kcal: 2000, proteins: 120, fats: 65, carbs: 250 };

  const macros = [
    { label: 'Белки', value: todayData.proteins, goal: goals.proteins, color: '#22c55e', icon: 'fitness' as const },
    { label: 'Жиры', value: todayData.fats, goal: goals.fats, color: '#f59e0b', icon: 'water' as const },
    { label: 'Углеводы', value: todayData.carbs, goal: goals.carbs, color: '#6366f1', icon: 'flash' as const },
  ];

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
              <Ionicons name="restaurant" size={26} color={Colors.nutrition} />
            </View>
            <View>
              <Text style={styles.title}>Питание</Text>
              <Text style={styles.subtitle}>Калории и БЖУ</Text>
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

        {/* Today's Calories Card */}
        <AnimatedCard index={cardIdx++} style={styles.calorieCard}>
          <View style={styles.calorieContent}>
            <View style={styles.calorieLeft}>
              <Text style={styles.calorieLabel}>Сегодня</Text>
              <View style={styles.calorieValueRow}>
                <Text style={styles.calorieValue}>{todayData.kcal}</Text>
                <Text style={styles.calorieUnit}>ккал</Text>
              </View>
              <View style={styles.calorieGoal}>
                <ProgressBar progress={(todayData.kcal / goals.kcal) * 100} color={Colors.nutrition} height={8} />
                <Text style={styles.calorieGoalText}>из {goals.kcal} ккал</Text>
              </View>
            </View>
            <View style={styles.calorieRight}>
              <View style={styles.mealsCountBadge}>
                <Text style={styles.mealsCountValue}>{todayData.records.length}</Text>
                <Text style={styles.mealsCountLabel}>приемов</Text>
              </View>
            </View>
          </View>
        </AnimatedCard>

        {/* Macros */}
        <View style={styles.macrosRow}>
          {macros.map((macro, i) => (
            <AnimatedCard key={macro.label} index={cardIdx++} style={styles.macroCard}>
              <View style={[styles.macroIconBg, { backgroundColor: macro.color + '15' }]}>
                <Ionicons name={macro.icon} size={16} color={macro.color} />
              </View>
              <Text style={styles.macroValue}>{macro.value}г</Text>
              <Text style={styles.macroLabel}>{macro.label}</Text>
              <ProgressBar progress={(macro.value / macro.goal) * 100} color={macro.color} height={4} />
              <Text style={styles.macroGoal}>из {macro.goal}г</Text>
            </AnimatedCard>
          ))}
        </View>

        {/* Today's Meals */}
        {todayData.records.length > 0 && (
          <View style={styles.todayMealsSection}>
            <Text style={styles.sectionTitle}>Приемы пищи сегодня</Text>
            <View style={styles.todayMealsList}>
              {todayData.records.map((record, index) => (
                <MealItem
                  key={record.id}
                  record={record}
                  index={index}
                  onEdit={() => handleEdit(record)}
                  onDelete={() => handleDelete(record.id)}
                />
              ))}
            </View>
          </View>
        )}

        {/* History */}
        <View style={styles.historySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Вся история</Text>
            {hasMoreRecords && (
              <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} activeOpacity={0.7} style={styles.expandButton}>
                <Text style={styles.expandText}>{isExpanded ? 'Свернуть' : `Ещё ${records.length - COLLAPSED_ITEMS}`}</Text>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {records.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="restaurant-outline" size={40} color={Colors.mutedForeground} />
              <Text style={styles.emptyTitle}>Нет записей</Text>
              <Text style={styles.emptyHint}>Добавьте первый прием пищи</Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {displayedRecords.map((record, index) => (
                <MealItem
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

        {/* FAB */}
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => {
            setEditRecord(null);
            setModalVisible(true);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.fabText}>Добавить прием пищи</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl + 20 }} />
      </ScrollView>

      <NutritionModal
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
    backgroundColor: Colors.nutritionMuted,
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
    backgroundColor: Colors.nutrition,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: Colors.nutrition, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  calorieCard: {
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
  calorieContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calorieLeft: {
    flex: 1,
  },
  calorieLabel: {
    fontSize: FontSize.sm,
    color: Colors.mutedForeground,
    marginBottom: 4,
  },
  calorieValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  calorieValue: {
    fontSize: 42,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  calorieUnit: {
    fontSize: FontSize.lg,
    color: Colors.mutedForeground,
  },
  calorieGoal: {
    marginTop: Spacing.md,
    gap: 6,
  },
  calorieGoalText: {
    fontSize: FontSize.xs,
    color: Colors.mutedForeground,
  },
  calorieRight: {
    marginLeft: Spacing.lg,
  },
  mealsCountBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.nutritionMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealsCountValue: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.nutrition,
  },
  mealsCountLabel: {
    fontSize: 9,
    color: Colors.nutrition,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  progressBar: {
    width: '100%',
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  macrosRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  macroCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    padding: Spacing.md,
    gap: 4,
  },
  macroIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  macroValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  macroLabel: {
    fontSize: 10,
    color: Colors.mutedForeground,
    marginBottom: 4,
  },
  macroGoal: {
    fontSize: 9,
    color: Colors.mutedForeground,
    marginTop: 4,
  },
  todayMealsSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.foreground,
    marginBottom: Spacing.md,
  },
  todayMealsList: {
    gap: Spacing.sm,
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
  },
  historyList: {
    gap: Spacing.sm,
  },
  mealCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  mealMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  mealIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealContent: {
    flex: 1,
  },
  mealHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealType: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mealDate: {
    fontSize: FontSize.xs,
    color: Colors.mutedForeground,
  },
  mealDescription: {
    fontSize: FontSize.sm,
    color: Colors.foreground,
    marginTop: 2,
  },
  mealStats: {
    alignItems: 'flex-end',
  },
  mealKcal: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  mealKcalUnit: {
    fontSize: FontSize.xs,
    color: Colors.mutedForeground,
  },
  macrosPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  macroMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  macroMiniText: {
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
    backgroundColor: Colors.nutrition,
    paddingVertical: 16,
    borderRadius: BorderRadius.xl,
    ...Platform.select({
      ios: { shadowColor: Colors.nutrition, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
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
    maxHeight: '85%',
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
  inputWrapperCompact: {
    paddingHorizontal: Spacing.sm,
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
  mealTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  mealTypeItem: {
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
  mealTypeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.mutedForeground,
  },
  macrosInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
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
    backgroundColor: Colors.nutrition,
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