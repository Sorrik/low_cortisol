// app/modals/add-water.tsx
import { useState } from 'react'
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Minus, Plus, Droplets } from 'lucide-react-native'
import { createWater } from '@/lib/health-api'  // ← исправлено

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const QUICK_OPTIONS = [1, 2, 4, 6, 8]

export default function AddWaterModal() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [glasses, setGlasses] = useState(4)

  const mutation = useMutation({
    mutationFn: () => createWater({  // ← исправлено
      date:     todayStr(),
      time:     nowTime(),
      amountMl: glasses * 250,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water'] })
      Alert.alert('✅ Успешно', 'Вода сохранена')
      router.back()
    },
    onError: () => {
      Alert.alert('❌ Ошибка', 'Не удалось сохранить')
    },
  })

  const totalMl = glasses * 250

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Добавить: Вода</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <X size={28} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Droplets size={48} color="#38bdf8" />
        </View>

        {/* Stepper */}
        <View style={styles.stepperContainer}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => setGlasses(v => Math.max(0, v - 1))}
            disabled={glasses <= 0}
          >
            <Minus size={28} color={glasses <= 0 ? '#4b5563' : '#f5f5f5'} />
          </TouchableOpacity>

          <View style={styles.valueContainer}>
            <Text style={styles.valueText}>{glasses}</Text>
            <Text style={styles.unitText}>стаканов</Text>
          </View>

          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => setGlasses(v => Math.min(20, v + 1))}
            disabled={glasses >= 20}
          >
            <Plus size={28} color={glasses >= 20 ? '#4b5563' : '#f5f5f5'} />
          </TouchableOpacity>
        </View>

        <Text style={styles.totalText}>
          {totalMl} мл (~{(totalMl / 1000).toFixed(1)} л)
        </Text>

        {/* Quick options */}
        <View style={styles.quickContainer}>
          <Text style={styles.quickLabel}>Быстрый выбор:</Text>
          <View style={styles.quickRow}>
            {QUICK_OPTIONS.map(num => (
              <TouchableOpacity
                key={num}
                style={[styles.quickOption, glasses === num && styles.quickOptionActive]}
                onPress={() => setGlasses(num)}
              >
                <Text style={[styles.quickOptionText, glasses === num && styles.quickOptionTextActive]}>
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Рекомендация</Text>
          <Text style={styles.infoText}>
            Рекомендуется 6–8 стаканов воды в день (1.5–2 литра).
            При тренировках потребность увеличивается.
          </Text>
        </View>
      </View>

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
  container:           { flex: 1, backgroundColor: '#0f0f0f' },
  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  title:               { fontSize: 20, fontWeight: '700', color: '#f5f5f5' },
  content:             { flex: 1, paddingHorizontal: 20, paddingTop: 32, alignItems: 'center' },
  iconWrapper:         { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(56,189,248,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  stepperContainer:    { flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 12 },
  stepperBtn:          { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  valueContainer:      { alignItems: 'center', minWidth: 100 },
  valueText:           { fontSize: 56, fontWeight: '700', color: '#f5f5f5' },
  unitText:            { fontSize: 14, color: '#9ca3af', marginTop: -4 },
  totalText:           { fontSize: 16, color: '#6b7280', marginBottom: 32 },
  quickContainer:      { width: '100%', marginBottom: 24 },
  quickLabel:          { fontSize: 12, color: '#6b7280', marginBottom: 10, textAlign: 'center' },
  quickRow:            { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  quickOption:         { width: 48, height: 48, borderRadius: 12, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  quickOptionActive:   { borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.1)' },
  quickOptionText:     { fontSize: 18, fontWeight: '600', color: '#9ca3af' },
  quickOptionTextActive:{ color: '#38bdf8' },
  infoCard:            { width: '100%', backgroundColor: 'rgba(56,189,248,0.08)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.15)', borderRadius: 12, padding: 16 },
  infoTitle:           { fontSize: 13, fontWeight: '600', color: '#38bdf8', marginBottom: 6 },
  infoText:            { fontSize: 13, color: '#9ca3af', lineHeight: 20 },
  footer:              { padding: 20, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  saveBtn:             { backgroundColor: '#a3e635', borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  saveBtnDisabled:     { opacity: 0.6 },
  saveBtnText:         { fontSize: 16, fontWeight: '700', color: '#0a0a0a', letterSpacing: 0.5 },
})