// app/modals/add-nutrition.tsx
// Фото → gpt-4o vision → FatSecret → предзаполнение формы.
// Fallback: ручной ввод БЖУ (как раньше).
import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Check, Sparkles } from 'lucide-react-native'
import {
  createNutrition,
  analyzeFoodPhoto,
  type AnalyzedFoodItem,
} from '@/lib/health-api'
import { PhotoPicker, type PhotoResult } from '@/components/ui/PhotoPicker'
import { VoiceInputButton } from '@/components/ui/VoiceInputButton'

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

interface PickedItem extends AnalyzedFoodItem {
  selected: boolean
}

export default function AddNutritionModal() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [mealType, setMealType]       = useState('lunch')
  const [mealTime, setMealTime]       = useState(nowTime())
  const [calories, setCalories]       = useState('')
  const [proteins, setProteins]       = useState('')
  const [fats, setFats]               = useState('')
  const [carbs, setCarbs]             = useState('')
  const [description, setDescription] = useState('')

  const [recognized, setRecognized] = useState<PickedItem[] | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const visionMutation = useMutation({
    mutationFn: async (photo: PhotoResult) => {
      setPhotoPreview(photo.uri)
      return analyzeFoodPhoto(photo.base64, photo.mimeType)
    },
    onSuccess: (res) => {
      if (!res.items.length) {
        Alert.alert('Не распознано', res.message ?? 'Попробуйте другой ракурс или введите вручную')
        setPhotoPreview(null)
        return
      }
      setRecognized(res.items.map((i) => ({ ...i, selected: i.matched })))
    },
    onError: () => {
      setPhotoPreview(null)
      Alert.alert('Ошибка', 'Не удалось распознать фото. Проверьте соединение.')
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const kcal = parseInt(calories, 10)
      if (!kcal || kcal < 1) throw new Error('calories required')

      return createNutrition({
        date:         todayStr(),
        time:         mealTime || nowTime(),
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

  function toggleItem(idx: number) {
    setRecognized((prev) =>
      prev ? prev.map((it, i) => (i === idx ? { ...it, selected: !it.selected } : it)) : prev,
    )
  }

  function applyRecognized() {
    if (!recognized) return
    const picked = recognized.filter((i) => i.selected)
    if (picked.length === 0) {
      Alert.alert('Выберите хотя бы одно блюдо')
      return
    }

    const totals = picked.reduce(
      (acc, it) => ({
        kcal: acc.kcal + it.calories,
        p:    acc.p    + it.proteinGrams,
        f:    acc.f    + it.fatGrams,
        c:    acc.c    + it.carbsGrams,
      }),
      { kcal: 0, p: 0, f: 0, c: 0 },
    )

    setCalories(String(Math.round(totals.kcal)))
    setProteins(totals.p.toFixed(1))
    setFats(totals.f.toFixed(1))
    setCarbs(totals.c.toFixed(1))
    setDescription(picked.map((i) => `${i.name} (${i.grams}г)`).join(', '))

    setRecognized(null)
    setPhotoPreview(null)
  }

  function cancelRecognized() {
    setRecognized(null)
    setPhotoPreview(null)
  }

  // ── Render: экран подтверждения распознанного ─────────────
  if (recognized) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Распознано</Text>
          <TouchableOpacity onPress={cancelRecognized} hitSlop={12}>
            <X size={28} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>Снимите галочку с ложных блюд или отредактируйте потом вручную</Text>

          {recognized.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.recCard, item.selected && styles.recCardSelected]}
              onPress={() => toggleItem(idx)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, item.selected && styles.checkboxActive]}>
                {item.selected && <Check size={14} color="#0a0a0a" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recName}>{item.name}</Text>
                <Text style={styles.recMeta}>
                  {item.grams}г · {item.matched ? item.matchedFoodName : '— БЖУ не найдены'}
                </Text>
                {item.matched && (
                  <Text style={styles.recNutri}>
                    {item.calories} ккал · Б {item.proteinGrams} · Ж {item.fatGrams} · У {item.carbsGrams}
                  </Text>
                )}
              </View>
              <Text style={styles.recConf}>{Math.round(item.confidence * 100)}%</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveBtn} onPress={applyRecognized}>
            <Text style={styles.saveBtnText}>ПОДТВЕРДИТЬ</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // ── Render: обычная форма ─────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Добавить: Питание</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <X size={28} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Voice input */}
        <View style={styles.field}>
          <View style={styles.aiHeader}>
            <Sparkles size={16} color="#a3e635" />
            <Text style={styles.aiLabel}>Надиктовать</Text>
          </View>
          <VoiceInputButton
            context="food"
            hint='Пример: «курица двести грамм и рис сто пятьдесят, обед»'
            onResult={(r) => {
              const f = r.fields as {
                meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null
                items?: Array<{
                  name_ru: string
                  grams_estimate: number
                  kcal_per_100g?: number
                  protein_per_100g?: number
                  fat_per_100g?: number
                  carbs_per_100g?: number
                }>
                notes?: string
              }
              if (f.meal_type) setMealType(f.meal_type)
              if (f.items?.length) {
                setDescription(
                  f.items.map((i) => `${i.name_ru} (${Math.round(i.grams_estimate)}г)`).join(', '),
                )
                const totals = f.items.reduce(
                  (acc, it) => {
                    const scale = (it.grams_estimate ?? 0) / 100
                    return {
                      kcal: acc.kcal + (it.kcal_per_100g    ?? 0) * scale,
                      p:    acc.p    + (it.protein_per_100g ?? 0) * scale,
                      fat:  acc.fat  + (it.fat_per_100g     ?? 0) * scale,
                      c:    acc.c    + (it.carbs_per_100g   ?? 0) * scale,
                    }
                  },
                  { kcal: 0, p: 0, fat: 0, c: 0 },
                )
                if (totals.kcal > 0) {
                  setCalories(String(Math.round(totals.kcal)))
                  setProteins(totals.p.toFixed(1))
                  setFats(totals.fat.toFixed(1))
                  setCarbs(totals.c.toFixed(1))
                }
              } else if (f.notes) {
                setDescription(f.notes)
              }
            }}
          />
        </View>

        {/* AI photo picker */}
        <View style={styles.field}>
          <View style={styles.aiHeader}>
            <Sparkles size={16} color="#a3e635" />
            <Text style={styles.aiLabel}>Распознать по фото</Text>
          </View>
          {visionMutation.isPending ? (
            <View style={styles.aiLoading}>
              <ActivityIndicator color="#a3e635" />
              <Text style={styles.aiLoadingText}>AI анализирует фото…</Text>
            </View>
          ) : (
            <PhotoPicker
              onPick={(photo) => visionMutation.mutate(photo)}
              disabled={visionMutation.isPending}
            />
          )}
          {photoPreview && !visionMutation.isPending && (
            <Text style={styles.hint}>Фото выбрано · обрабатывается…</Text>
          )}
        </View>

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

        {/* Время приёма пищи */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Время приёма <Text style={styles.optional}>(ЧЧ:ММ)</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={mealTime}
            onChangeText={setMealTime}
            placeholder="21:30"
            placeholderTextColor="#6b7280"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <Text style={styles.hint}>Еда после 21:00 влияет на кортизол и сон</Text>
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
          style={[styles.saveBtn, saveMutation.isPending && styles.saveBtnDisabled]}
          onPress={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending
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
  hint:                 { fontSize: 11, color: '#6b7280', marginTop: 4 },

  aiHeader:             { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  aiLabel:              { fontSize: 15, fontWeight: '600', color: '#a3e635' },
  aiLoading:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, backgroundColor: 'rgba(163,230,53,0.1)', borderRadius: 12 },
  aiLoadingText:        { fontSize: 14, color: '#a3e635', fontWeight: '500' },

  recCard:              { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, marginBottom: 10, borderRadius: 12, backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#27272a' },
  recCardSelected:      { borderColor: '#a3e635', backgroundColor: 'rgba(163,230,53,0.08)' },
  checkbox:             { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#3f3f46', marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxActive:       { backgroundColor: '#a3e635', borderColor: '#a3e635' },
  recName:              { fontSize: 15, fontWeight: '600', color: '#f5f5f5', marginBottom: 2 },
  recMeta:              { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
  recNutri:             { fontSize: 12, color: '#d4d4d8' },
  recConf:              { fontSize: 11, color: '#6b7280', marginTop: 2 },
})
