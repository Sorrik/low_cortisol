// app/modals/add-nutrition.tsx
// Упрощённая версия без searchFoods — вводим БЖУ вручную
// (searchFoods требует FatSecret API на бэкенде, добавим позже)
import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react-native'
import { createNutrition } from '@/lib/health-api'  // ← исправлено

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Завтрак', emoji: '🍳' },
  { value: 'lunch',     label: 'Обед',    emoji: '🍲' },
  { value: 'dinner',    label: 'Ужин',    emoji: '🍽️' },
  { value: 'snack',     label: 'Перекус', emoji: '🍎' },
]

export default function AddNutritionModal() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [mealType, setMealType]     = useState('lunch')
  const [calories, setCalories]     = useState('')
  const [proteins, setProteins]     = useState('')
  const [fats, setFats]             = useState('')
  const [carbs, setCarbs]           = useState('')
  const [description, setDescription] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const kcal = parseInt(calories, 10)
      if (!kcal || kcal < 1) throw new Error('calories required')

      return createNutrition({  // ← исправлено
        date:         todayStr(),
        time:         nowTime(),
        mealType:     mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
        description:  description.trim() || MEAL_TYPES.find(m => m.value === mealType)?.label || '',
        calories:     kcal,
        proteinGrams: parseFloat(proteins) || 0,
        carbsGrams:   parseFloat(carbs)    || 0,
        fatGrams:     parseFloat(fats)     || 0,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition'] })
      Alert.alert('✅ Успешно', 'Приём пищи сохранён')
      router.back()
    },
    onError: (err: any) => {
      if (err.message === 'calories required') {
        Alert.alert('⚠️ Внимание', 'Укажите калории')
      } else {
        Alert.alert('❌ Ошибка', 'Не удалось сохранить')
      }
    },
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Добавить: Питание</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <X size={28} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Тип приёма */}
        <View style={styles.field}>
          <Text style={styles.label}>Приём пищи</Text>
          <View style={styles.mealTypeRow}>
            {MEAL_TYPES.map(type => (
              <TouchableOpacity
                key={type.value}
                style={[styles.mealTypeOption, mealType === type.value && styles.mealTypeOptionActive]}
                onPress={() => setMealType(type.value)}
              >
                <Text style={styles.mealTypeEmoji}>{type.emoji}</Text>
                <Text style={[styles.mealTypeLabel, mealType === type.value && styles.mealTypeLabelActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Название блюда */}
        <View style={styles.field}>
          <Text style={styles.label}>Название блюда <Text style={styles.optional}>(необязательно)</Text></Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Овсянка с ягодами, куриная грудка..."
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Калории */}
        <View style={styles.field}>
          <Text style={styles.label}>Калории (ккал) *</Text>
          <TextInput
            style={styles.input}
            value={calories}
            onChangeText={setCalories}
            placeholder="500"
            placeholderTextColor="#6b7280"
            keyboardType="number-pad"
          />
        </View>

        {/* БЖУ */}
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Белки (г)</Text>
            <TextInput
              style={styles.input}
              value={proteins}
              onChangeText={setProteins}
              placeholder="0"
              placeholderTextColor="#6b7280"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ width: 10 }} />
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Жиры (г)</Text>
            <TextInput
              style={styles.input}
              value={fats}
              onChangeText={setFats}
              placeholder="0"
              placeholderTextColor="#6b7280"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ width: 10 }} />
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Углеводы (г)</Text>
            <TextInput
              style={styles.input}
              value={carbs}
              onChangeText={setCarbs}
              placeholder="0"
              placeholderTextColor="#6b7280"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Превью */}
        {(calories || proteins || fats || carbs) && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Итого</Text>
            <View style={styles.previewRow}>
              {[
                { label: 'ккал', value: calories || '0', color: 'rgba(249,115,22,0.15)' },
                { label: 'Б',    value: proteins || '0', color: 'rgba(59,130,246,0.15)'  },
                { label: 'Ж',    value: fats     || '0', color: 'rgba(234,179,8,0.15)'   },
                { label: 'У',    value: carbs    || '0', color: 'rgba(34,197,94,0.15)'   },
              ].map(item => (
                <View key={item.label} style={[styles.previewBadge, { backgroundColor: item.color }]}>
                  <Text style={styles.previewValue}>{item.value}</Text>
                  <Text style={styles.previewLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
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
  container:            { flex: 1, backgroundColor: '#0f0f0f' },
  header:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  title:                { fontSize: 20, fontWeight: '700', color: '#f5f5f5' },
  content:              { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  row:                  { flexDirection: 'row', alignItems: 'flex-start' },
  field:                { marginBottom: 20 },
  label:                { fontSize: 15, fontWeight: '500', color: '#9ca3af', marginBottom: 8 },
  optional:             { fontSize: 12, color: '#6b7280', fontWeight: '400' },
  input:                { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#27272a', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: '#f5f5f5' },
  mealTypeRow:          { flexDirection: 'row', gap: 10 },
  mealTypeOption:       { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 2, borderColor: '#27272a' },
  mealTypeOptionActive: { borderColor: '#a3e635', backgroundColor: 'rgba(163,230,53,0.1)' },
  mealTypeEmoji:        { fontSize: 20, marginBottom: 4 },
  mealTypeLabel:        { fontSize: 11, color: '#9ca3af' },
  mealTypeLabelActive:  { color: '#a3e635', fontWeight: '600' },
  previewCard:          { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 20 },
  previewTitle:         { fontSize: 12, color: '#6b7280', marginBottom: 10 },
  previewRow:           { flexDirection: 'row', gap: 8 },
  previewBadge:         { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  previewValue:         { fontSize: 14, fontWeight: '700', color: '#f5f5f5' },
  previewLabel:         { fontSize: 10, color: '#9ca3af' },
  footer:               { padding: 20, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  saveBtn:              { backgroundColor: '#a3e635', borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  saveBtnDisabled:      { opacity: 0.6 },
  saveBtnText:          { fontSize: 16, fontWeight: '700', color: '#0a0a0a', letterSpacing: 0.5 },
})