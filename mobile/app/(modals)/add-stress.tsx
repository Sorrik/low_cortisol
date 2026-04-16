// app/modals/add-stress.tsx
import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react-native'
import Slider from '@react-native-community/slider'
import { createStress } from '@/lib/health-api'  // ← исправлено

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AddStressModal() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [level, setLevel] = useState(5)
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () => createStress({  // ← исправлено
      date:  todayStr(),
      time:  nowTime(),
      level,
      ...(notes.trim() ? { cause: notes.trim() } : {}),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stress'] })
      Alert.alert('✅ Успешно', 'Стресс сохранён')
      router.back()
    },
    onError: () => {
      Alert.alert('❌ Ошибка', 'Не удалось сохранить')
    },
  })

  function getStressColor(): string {
    if (level <= 3) return '#22c55e'
    if (level <= 6) return '#eab308'
    return '#ef4444'
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Добавить: Стресс</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <X size={28} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.field}>
          <Text style={styles.label}>Уровень стресса</Text>
          <View style={styles.levelIndicator}>
            <Text style={[styles.levelValue, { color: getStressColor() }]}>{level}</Text>
            <Text style={styles.levelMax}>/10</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={level}
            onValueChange={setLevel}
            minimumTrackTintColor={getStressColor()}
            maximumTrackTintColor="#27272a"
            thumbTintColor={getStressColor()}
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>Спокойно</Text>
            <Text style={styles.sliderLabel}>Стресс</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Что вызвало стресс?</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Работа, отношения, здоровье..."
            placeholderTextColor="#6b7280"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {level >= 7 && (
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>Высокий уровень стресса</Text>
            <Text style={styles.tipText}>
              Попробуйте сделать несколько глубоких вдохов или короткую прогулку.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, mutation.isPending && styles.saveBtnDisabled]}
          onPress={() => mutation.mutate()}
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
  container:      { flex: 1, backgroundColor: '#0f0f0f' },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  title:          { fontSize: 20, fontWeight: '700', color: '#f5f5f5' },
  content:        { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  field:          { marginBottom: 24 },
  label:          { fontSize: 15, fontWeight: '500', color: '#9ca3af', marginBottom: 8 },
  input:          { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#27272a', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: '#f5f5f5' },
  textarea:       { minHeight: 110, paddingTop: 14 },
  levelIndicator: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 8 },
  levelValue:     { fontSize: 48, fontWeight: '700' },
  levelMax:       { fontSize: 24, color: '#6b7280', marginLeft: 4 },
  slider:         { width: '100%', height: 40 },
  sliderLabels:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  sliderLabel:    { fontSize: 12, color: '#6b7280' },
  tipCard:        { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 12, padding: 16 },
  tipTitle:       { fontSize: 14, fontWeight: '600', color: '#ef4444', marginBottom: 8 },
  tipText:        { fontSize: 13, color: '#9ca3af', lineHeight: 20 },
  footer:         { padding: 20, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  saveBtn:        { backgroundColor: '#a3e635', borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  saveBtnDisabled:{ opacity: 0.6 },
  saveBtnText:    { fontSize: 16, fontWeight: '700', color: '#0a0a0a', letterSpacing: 0.5 },
})