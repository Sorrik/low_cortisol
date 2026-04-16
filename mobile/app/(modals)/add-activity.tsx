// app/modals/add-activity.tsx
import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
  Platform, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Check } from 'lucide-react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { createActivity } from '@/lib/health-api'  // ← исправлено

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const ACTIVITY_TYPES = [
  { value: 'walking', label: 'Ходьба',  emoji: '🚶' },
  { value: 'running', label: 'Бег',     emoji: '🏃' },
  { value: 'gym',     label: 'Зал',     emoji: '🏋️' },
  { value: 'other',   label: 'Йога',    emoji: '🧘' },
  { value: 'other',   label: 'Спорт',   emoji: '⚽' },
  { value: 'other',   label: 'Другое',  emoji: '✨' },
]

const INTENSITY_OPTIONS = [
  { value: 'light',    label: 'Лёгкая'  },
  { value: 'moderate', label: 'Средняя' },
  { value: 'vigorous', label: 'Высокая' },
]

export default function AddActivityModal() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [activityIdx, setActivityIdx]  = useState(0)
  const [intensity, setIntensity]      = useState('moderate')
  const [duration, setDuration]        = useState('30')
  const [steps, setSteps]              = useState('')
  const [description, setDescription] = useState('')
  const [time, setTime]                = useState<Date | null>(null)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const mutation = useMutation({
    mutationFn: () => {
      const durationNum   = parseInt(duration, 10) || 30
      const selectedType  = ACTIVITY_TYPES[activityIdx]
      const notes = description.trim()
        ? `${selectedType.label}: ${description.trim()}`
        : selectedType.label

      return createActivity({  // ← исправлено
        date:            todayStr(),
        ...(time ? { time: formatTime(time) } : {}),
        type:            selectedType.value as any,
        durationMinutes: durationNum,
        intensity:       intensity as 'light' | 'moderate' | 'vigorous',
        ...(steps ? { steps: parseInt(steps, 10) } : {}),
        notes,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      Alert.alert('✅ Успешно', 'Активность сохранена')
      router.back()
    },
    onError: () => {
      Alert.alert('❌ Ошибка', 'Не удалось сохранить')
    },
  })

  function handleSave() {
    const durationNum = parseInt(duration, 10)
    if (!durationNum || durationNum < 1) {
      Alert.alert('⚠️ Внимание', 'Укажите длительность тренировки')
      return
    }
    mutation.mutate()
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Добавить: Активность</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <X size={28} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Тип активности */}
        <View style={styles.field}>
          <Text style={styles.label}>Тип активности</Text>
          <View style={styles.typeGrid}>
            {ACTIVITY_TYPES.map((type, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.typeOption, activityIdx === idx && styles.typeOptionActive]}
                onPress={() => setActivityIdx(idx)}
              >
                <Text style={styles.typeEmoji}>{type.emoji}</Text>
                <Text style={[styles.typeLabel, activityIdx === idx && styles.typeLabelActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Время (необязательно) */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Время тренировки <Text style={styles.optional}>(необязательно)</Text>
          </Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={time ?? new Date()}
              mode="time"
              display="compact"
              onChange={(_, date) => setTime(date ?? null)}
              style={{ backgroundColor: '#1a1a1a' }}
            />
          ) : (
            <>
              <TouchableOpacity style={styles.timeButton} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.timeButtonText}>
                  {time ? formatTime(time) : 'Не указано'}
                </Text>
              </TouchableOpacity>
              {showTimePicker && (
                <DateTimePicker
                  value={time ?? new Date()}
                  mode="time"
                  is24Hour
                  onChange={(_, date) => { setShowTimePicker(false); if (date) setTime(date) }}
                />
              )}
            </>
          )}
          <Text style={styles.hint}>
            Укажите время — система учтёт вечерние тренировки при анализе сна
          </Text>
        </View>

        {/* Интенсивность */}
        <View style={styles.field}>
          <Text style={styles.label}>Интенсивность</Text>
          <View style={styles.intensityRow}>
            {INTENSITY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.intensityOption, intensity === opt.value && styles.intensityOptionActive]}
                onPress={() => setIntensity(opt.value)}
              >
                {intensity === opt.value && <Check size={14} color="#a3e635" style={{ marginRight: 6 }} />}
                <Text style={[styles.intensityLabel, intensity === opt.value && styles.intensityLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Длительность и шаги */}
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Длительность (мин)</Text>
            <TextInput
              style={styles.input}
              value={duration}
              onChangeText={setDuration}
              placeholder="30"
              placeholderTextColor="#6b7280"
              keyboardType="number-pad"
            />
          </View>
          <View style={{ width: 12 }} />
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Шаги <Text style={styles.optional}>(необяз.)</Text></Text>
            <TextInput
              style={styles.input}
              value={steps}
              onChangeText={setSteps}
              placeholder="0"
              placeholderTextColor="#6b7280"
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Описание */}
        <View style={styles.field}>
          <Text style={styles.label}>Описание <Text style={styles.optional}>(необязательно)</Text></Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Маршрут, упражнения, самочувствие..."
            placeholderTextColor="#6b7280"
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, mutation.isPending && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? <ActivityIndicator color="#0a0a0a" />
            : <Text style={styles.saveBtnText}>СОХРАНИТЬ</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: '#0f0f0f' },
  header:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  title:                { fontSize: 20, fontWeight: '700', color: '#f5f5f5' },
  content:              { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  row:                  { flexDirection: 'row', alignItems: 'flex-start' },
  field:                { marginBottom: 24 },
  label:                { fontSize: 15, fontWeight: '500', color: '#9ca3af', marginBottom: 8 },
  optional:             { fontSize: 12, color: '#6b7280', fontWeight: '400' },
  hint:                 { fontSize: 12, color: '#6b7280', marginTop: 8 },
  input:                { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#27272a', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: '#f5f5f5' },
  textarea:             { minHeight: 70, paddingTop: 14 },
  typeGrid:             { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeOption:           { width: '31%', alignItems: 'center', paddingVertical: 14, backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 2, borderColor: '#27272a' },
  typeOptionActive:     { borderColor: '#a3e635', backgroundColor: 'rgba(163,230,53,0.1)' },
  typeEmoji:            { fontSize: 24, marginBottom: 4 },
  typeLabel:            { fontSize: 12, color: '#9ca3af' },
  typeLabelActive:      { color: '#a3e635', fontWeight: '600' },
  intensityRow:         { flexDirection: 'row', gap: 10 },
  intensityOption:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 2, borderColor: '#27272a' },
  intensityOptionActive:{ borderColor: '#a3e635', backgroundColor: 'rgba(163,230,53,0.1)' },
  intensityLabel:       { fontSize: 14, color: '#9ca3af' },
  intensityLabelActive: { color: '#a3e635', fontWeight: '600' },
  timeButton:           { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#27272a', borderRadius: 12, padding: 16, alignItems: 'center' },
  timeButtonText:       { fontSize: 18, fontWeight: '600', color: '#f5f5f5' },
  footer:               { padding: 20, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  saveBtn:              { backgroundColor: '#a3e635', borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  saveBtnDisabled:      { opacity: 0.6 },
  saveBtnText:          { fontSize: 16, fontWeight: '700', color: '#0a0a0a', letterSpacing: 0.5 },
})