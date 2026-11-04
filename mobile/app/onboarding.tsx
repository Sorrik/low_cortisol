import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { useThemedStyles, ColorPalette } from '@/lib/useThemedStyles';
import { useTheme } from '@/context/ThemeContext';
import { completeOnboarding } from '@/lib/onboarding-api'
import type { OnboardingData, GoalType, SleepChronotype, ActivityLevel, SportType, AgeRange, Gender } from '@/lib/onboarding-api'

const TOTAL_STEPS = 5

interface FormState {
  name: string
  ageRange: AgeRange | ''
  gender: Gender | ''
  selectedGoals: GoalType[]
  primaryGoal: GoalType | ''
  chronotype: SleepChronotype | ''
  sleepGoalHours: number
  activityLevel: ActivityLevel | ''
  sportTypes: SportType[]
  workoutsPerWeek: number
  avgWorkoutDurationMin: number
  sportGoal: string
  baselineStress: number
}

const DEFAULTS: FormState = {
  name: '', ageRange: '', gender: '',
  selectedGoals: [], primaryGoal: '',
  chronotype: '', sleepGoalHours: 8,
  activityLevel: '', sportTypes: [],
  workoutsPerWeek: 3, avgWorkoutDurationMin: 45,
  sportGoal: '', baselineStress: 5,
}

const GOALS: { id: GoalType; label: string; desc: string }[] = [
  { id: 'sleep',  label: 'Улучшить сон',    desc: 'Качество и продолжительность' },
  { id: 'energy', label: 'Больше энергии',  desc: 'Бодрость в течение дня'       },
  { id: 'stress', label: 'Снизить стресс',  desc: 'Спокойствие и баланс'         },
  { id: 'weight', label: 'Контроль веса',   desc: 'Здоровая масса тела'          },
  { id: 'mood',   label: 'Настроение',      desc: 'Эмоциональное здоровье'       },
]

const CHRONOTYPES: { id: SleepChronotype; label: string; desc: string }[] = [
  { id: 'early_bird', label: 'Жаворонок', desc: 'Легко встаю рано, продуктивен утром'   },
  { id: 'no_routine', label: 'Гибкий',    desc: 'Стандартный режим, гибкий график'      },
  { id: 'night_owl',  label: 'Сова',      desc: 'Активен вечером, сложно вставать рано' },
]

const ACTIVITY_LEVELS: { id: ActivityLevel; label: string; desc: string }[] = [
  { id: 'sedentary', label: 'Сидячий образ жизни', desc: 'Минимум движения'         },
  { id: 'light',     label: 'Лёгкая активность',   desc: '1–2 тренировки в неделю'  },
  { id: 'moderate',  label: 'Умеренная активность', desc: '3–4 тренировки в неделю' },
  { id: 'active',    label: 'Высокая активность',   desc: '5+ тренировок в неделю'  },
]

const SPORT_TYPES: { id: SportType; label: string }[] = [
  { id: 'running',      label: 'Бег'               },
  { id: 'gym',          label: 'Тренажёрный зал'   },
  { id: 'yoga',         label: 'Йога'              },
  { id: 'cycling',      label: 'Велосипед'         },
  { id: 'swimming',     label: 'Плавание'          },
  { id: 'team_sports',  label: 'Командные виды'    },
  { id: 'martial_arts', label: 'Единоборства'      },
  { id: 'home_workout', label: 'Дома без инвентаря'},
]

const AGE_RANGES: AgeRange[] = ['18-25', '26-35', '36-45', '46+']
const GENDERS: { id: Gender; label: string }[] = [
  { id: 'male',              label: 'Мужской'      },
  { id: 'female',            label: 'Женский'      },
  { id: 'other',             label: 'Другой'       },
  { id: 'prefer_not_to_say', label: 'Не указывать' },
]

function StressBar({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.stressRow}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <TouchableOpacity
          key={n}
          onPress={() => onChange(n)}
          style={[
            styles.stressBtn,
            value >= n && { backgroundColor: n <= 4 ? '#22c55e' : n <= 7 ? '#f59e0b' : '#ef4444' }
          ]}
        >
          <Text style={[styles.stressBtnText, value >= n && { color: '#fff' }]}>{n}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

export default function OnboardingScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(DEFAULTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleGoal(id: GoalType) {
    const next = form.selectedGoals.includes(id)
      ? form.selectedGoals.filter(g => g !== id)
      : form.selectedGoals.length < 3 ? [...form.selectedGoals, id] : form.selectedGoals
    set('selectedGoals', next)
    if (!next.includes(form.primaryGoal as GoalType)) set('primaryGoal', next[0] ?? '')
  }

  function toggleSport(id: SportType) {
    set('sportTypes', form.sportTypes.includes(id)
      ? form.sportTypes.filter(s => s !== id)
      : [...form.sportTypes, id])
  }

  function canProceed() {
    switch (step) {
      case 1: return !!(form.name && form.ageRange && form.gender)
      case 2: return form.selectedGoals.length > 0 && !!form.primaryGoal
      case 3: return !!form.chronotype
      case 4: return !!form.activityLevel
      case 5: return true
      default: return false
    }
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      const data: OnboardingData = {
        name:                  form.name,
        ageRange:              form.ageRange as AgeRange,
        gender:                form.gender as Gender,
        goals:                 form.selectedGoals,
        primaryGoal:           form.primaryGoal as GoalType,
        chronotype:            form.chronotype as SleepChronotype,
        sleepGoalHours:        form.sleepGoalHours,
        activityLevel:         form.activityLevel as ActivityLevel,
        sportTypes:            form.activityLevel === 'sedentary' ? [] : form.sportTypes,
        workoutsPerWeek:       form.activityLevel === 'sedentary' ? 0 : form.workoutsPerWeek,
        avgWorkoutDurationMin: form.activityLevel === 'sedentary' ? 0 : form.avgWorkoutDurationMin,
        sportGoal:             form.sportGoal || null,
        baselineStress:        form.baselineStress,
      }
      await completeOnboarding(data)
      router.replace('/(tabs)')
    } catch {
      setError('Ошибка сохранения. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  const stepTitles = ['О вас', 'Цели', 'Сон', 'Активность', 'Стресс']

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Настройка профиля</Text>
            <Text style={styles.headerStep}>Шаг {step} из {TOTAL_STEPS}</Text>
          </View>
          <View style={styles.progressRow}>
            {stepTitles.map((title, i) => (
              <View key={i} style={styles.progressItem}>
                <View style={[styles.progressDot, i + 1 <= step && styles.progressDotActive,
                  i + 1 < step && styles.progressDotDone]}>
                  {i + 1 < step
                    ? <Ionicons name="checkmark" size={12} color="#fff" />
                    : <Text style={[styles.progressDotText, i + 1 === step && { color: '#fff' }]}>{i + 1}</Text>
                  }
                </View>
                {i < stepTitles.length - 1 && (
                  <View style={[styles.progressLine, i + 1 < step && styles.progressLineDone]} />
                )}
              </View>
            ))}
          </View>
          <Text style={styles.stepTitle}>{stepTitles[step - 1]}</Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled">

          {/* Шаг 1 */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Как вас зовут?</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={18} color={colors.mutedForeground} />
                  <TextInput
                    style={styles.input}
                    value={form.name}
                    onChangeText={v => set('name', v)}
                    placeholder="Ваше имя"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Возраст</Text>
                <View style={styles.chipRow}>
                  {AGE_RANGES.map(r => (
                    <TouchableOpacity key={r}
                      style={[styles.chip, form.ageRange === r && styles.chipActive]}
                      onPress={() => set('ageRange', r)}>
                      <Text style={[styles.chipText, form.ageRange === r && styles.chipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Пол</Text>
                <View style={styles.optionList}>
                  {GENDERS.map(g => (
                    <TouchableOpacity key={g.id}
                      style={[styles.optionItem, form.gender === g.id && styles.optionItemActive]}
                      onPress={() => set('gender', g.id)}>
                      <View style={[styles.radio, form.gender === g.id && styles.radioActive]}>
                        {form.gender === g.id && <View style={styles.radioDot} />}
                      </View>
                      <Text style={styles.optionText}>{g.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Шаг 2 */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Выберите до 3 целей ({form.selectedGoals.length}/3)</Text>
                {GOALS.map(goal => {
                  const selected = form.selectedGoals.includes(goal.id)
                  const disabled = !selected && form.selectedGoals.length >= 3
                  return (
                    <TouchableOpacity key={goal.id} disabled={disabled}
                      style={[styles.goalItem, selected && styles.goalItemActive, disabled && styles.goalItemDisabled]}
                      onPress={() => toggleGoal(goal.id)}>
                      <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                        {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.goalLabel}>{goal.label}</Text>
                        <Text style={styles.goalDesc}>{goal.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {form.selectedGoals.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Главная цель</Text>
                  {form.selectedGoals.map(id => {
                    const goal = GOALS.find(g => g.id === id)!
                    return (
                      <TouchableOpacity key={id}
                        style={[styles.optionItem, form.primaryGoal === id && styles.optionItemActive]}
                        onPress={() => set('primaryGoal', id)}>
                        <View style={[styles.radio, form.primaryGoal === id && styles.radioActive]}>
                          {form.primaryGoal === id && <View style={styles.radioDot} />}
                        </View>
                        <Text style={styles.optionText}>{goal.label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
            </View>
          )}

          {/* Шаг 3 */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ваш хронотип</Text>
                {CHRONOTYPES.map(c => (
                  <TouchableOpacity key={c.id}
                    style={[styles.optionItem, form.chronotype === c.id && styles.optionItemActive]}
                    onPress={() => set('chronotype', c.id)}>
                    <View style={[styles.radio, form.chronotype === c.id && styles.radioActive]}>
                      {form.chronotype === c.id && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionText}>{c.label}</Text>
                      <Text style={styles.optionDesc}>{c.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.label}>Желаемые часы сна</Text>
                  <Text style={styles.sliderValue}>{form.sleepGoalHours} ч</Text>
                </View>
                <View style={styles.sliderRow}>
                  {[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12].map(h => (
                    <TouchableOpacity key={h} onPress={() => set('sleepGoalHours', h)}
                      style={[styles.sliderDot, form.sleepGoalHours >= h && styles.sliderDotActive]} />
                  ))}
                </View>
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>5 ч</Text>
                  <Text style={styles.sliderLabel}>8 ч</Text>
                  <Text style={styles.sliderLabel}>12 ч</Text>
                </View>
              </View>
            </View>
          )}

          {/* Шаг 4 */}
          {step === 4 && (
            <View style={styles.stepContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Уровень активности</Text>
                {ACTIVITY_LEVELS.map(lvl => (
                  <TouchableOpacity key={lvl.id}
                    style={[styles.optionItem, form.activityLevel === lvl.id && styles.optionItemActive]}
                    onPress={() => set('activityLevel', lvl.id)}>
                    <View style={[styles.radio, form.activityLevel === lvl.id && styles.radioActive]}>
                      {form.activityLevel === lvl.id && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionText}>{lvl.label}</Text>
                      <Text style={styles.optionDesc}>{lvl.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {form.activityLevel && form.activityLevel !== 'sedentary' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Виды спорта</Text>
                    <View style={styles.chipRow}>
                      {SPORT_TYPES.map(s => (
                        <TouchableOpacity key={s.id}
                          style={[styles.chip, form.sportTypes.includes(s.id) && styles.chipActive]}
                          onPress={() => toggleSport(s.id)}>
                          <Text style={[styles.chipText, form.sportTypes.includes(s.id) && styles.chipTextActive]}>
                            {s.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.rowInputs}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Тренировок/нед</Text>
                      <View style={styles.counter}>
                        <TouchableOpacity onPress={() => set('workoutsPerWeek', Math.max(1, form.workoutsPerWeek - 1))}
                          style={styles.counterBtn}>
                          <Text style={styles.counterBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.counterValue}>{form.workoutsPerWeek}</Text>
                        <TouchableOpacity onPress={() => set('workoutsPerWeek', Math.min(7, form.workoutsPerWeek + 1))}
                          style={styles.counterBtn}>
                          <Text style={styles.counterBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Длительность</Text>
                      <View style={styles.chipRow}>
                        {[30, 45, 60, 90].map(m => (
                          <TouchableOpacity key={m}
                            style={[styles.chip, form.avgWorkoutDurationMin === m && styles.chipActive]}
                            onPress={() => set('avgWorkoutDurationMin', m)}>
                            <Text style={[styles.chipText, form.avgWorkoutDurationMin === m && styles.chipTextActive]}>
                              {m}м
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Шаг 5 */}
          {step === 5 && (
            <View style={styles.stepContent}>
              <View style={styles.stressCenter}>
                <Text style={[styles.stressBig, {
                  color: form.baselineStress <= 4 ? '#22c55e' : form.baselineStress <= 7 ? '#f59e0b' : '#ef4444'
                }]}>{form.baselineStress}</Text>
                <Text style={styles.stressSubtitle}>
                  {form.baselineStress <= 2 ? 'Очень низкий' : form.baselineStress <= 4 ? 'Низкий' :
                   form.baselineStress <= 6 ? 'Умеренный' : form.baselineStress <= 8 ? 'Высокий' : 'Очень высокий'}
                </Text>
              </View>
              <StressBar value={form.baselineStress} onChange={v => set('baselineStress', v)} />

              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>Что учитывает этот показатель?</Text>
                <Text style={styles.infoText}>• Общий уровень тревожности в последние недели</Text>
                <Text style={styles.infoText}>• Частота стрессовых ситуаций на работе/учёбе</Text>
                <Text style={styles.infoText}>• Качество эмоционального состояния</Text>
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)} disabled={step === 1}>
            <Ionicons name="chevron-back" size={20} color={step === 1 ? colors.border : colors.foreground} />
            <Text style={[styles.backBtnText, step === 1 && { color: colors.border }]}>Назад</Text>
          </TouchableOpacity>

          {step < TOTAL_STEPS ? (
            <TouchableOpacity
              style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
              onPress={() => setStep(s => s + 1)}
              disabled={!canProceed()}>
              <Text style={styles.nextBtnText}>Далее</Text>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.nextBtn, loading && styles.nextBtnDisabled]}
              onPress={handleSubmit} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.nextBtnText}>Завершить</Text></>
              }
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: Spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  headerTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: colors.foreground },
  headerStep: { fontSize: FontSize.sm, color: colors.mutedForeground },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  progressItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  progressDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border },
  progressDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  progressDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  progressDotText: { fontSize: 11, fontWeight: FontWeight.bold, color: colors.mutedForeground },
  progressLine: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 2 },
  progressLineDone: { backgroundColor: colors.primary },
  stepTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.foreground },
  content: { flex: 1 },
  contentInner: { padding: Spacing.lg },
  stepContent: { gap: Spacing.lg },
  inputGroup: { gap: Spacing.sm },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: colors.foreground },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: colors.secondary, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 12 },
  input: { flex: 1, fontSize: FontSize.base, color: colors.foreground },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.full, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: colors.mutedForeground },
  chipTextActive: { color: colors.primary },
  optionList: { gap: Spacing.sm },
  optionItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, backgroundColor: colors.secondary, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: colors.border },
  optionItemActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  optionText: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: colors.foreground },
  optionDesc: { fontSize: FontSize.xs, color: colors.mutedForeground, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  goalItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, backgroundColor: colors.secondary, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: colors.border },
  goalItemActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  goalItemDisabled: { opacity: 0.5 },
  goalLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: colors.foreground },
  goalDesc: { fontSize: FontSize.xs, color: colors.mutedForeground },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.primary },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: Spacing.md },
  sliderDot: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.secondary },
  sliderDotActive: { backgroundColor: colors.primary },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { fontSize: FontSize.xs, color: colors.mutedForeground },
  rowInputs: { flexDirection: 'row', gap: Spacing.md },
  counter: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.secondary, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  counterBtn: { padding: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  counterBtnText: { fontSize: FontSize.xl, color: colors.foreground },
  counterValue: { flex: 1, textAlign: 'center', fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.foreground },
  stressCenter: { alignItems: 'center', paddingVertical: Spacing.xl },
  stressBig: { fontSize: 72, fontWeight: FontWeight.bold },
  stressSubtitle: { fontSize: FontSize.lg, color: colors.mutedForeground, marginTop: Spacing.sm },
  stressRow: { flexDirection: 'row', gap: 6 },
  stressBtn: { flex: 1, aspectRatio: 1, borderRadius: BorderRadius.md, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  stressBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.mutedForeground },
  infoBox: { backgroundColor: colors.secondary, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.sm, marginTop: Spacing.lg },
  infoTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: colors.foreground },
  infoText: { fontSize: FontSize.sm, color: colors.mutedForeground },
  errorText: { color: colors.destructive, textAlign: 'center', fontSize: FontSize.sm },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  backBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: colors.foreground },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: colors.primaryForeground },
})