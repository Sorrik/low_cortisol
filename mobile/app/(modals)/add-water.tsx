// app/modals/add-water.tsx
import { useState } from 'react'
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Minus, Plus, Droplets } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { createWater } from '@/lib/health-api'
import { useThemedStyles, ColorPalette } from '@/lib/useThemedStyles'
import { useTheme } from '@/context/ThemeContext'

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
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)

  const [glasses, setGlasses] = useState(4)

  const mutation = useMutation({
    mutationFn: () => createWater({  // ← исправлено
      date:     todayStr(),
      time:     nowTime(),
      amountMl: glasses * 250,
    }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      queryClient.invalidateQueries({ queryKey: ['water'] })
      Alert.alert('✅ Успешно', 'Вода сохранена')
      router.back()
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('❌ Ошибка', 'Не удалось сохранить')
    },
  })

  const totalMl = glasses * 250

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Добавить: Вода</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <X size={28} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Droplets size={48} color={colors.water} />
        </View>

        {/* Stepper */}
        <View style={styles.stepperContainer}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => setGlasses(v => Math.max(0, v - 1))}
            disabled={glasses <= 0}
          >
            <Minus size={28} color={glasses <= 0 ? colors.mutedForeground : colors.foreground} />
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
            <Plus size={28} color={glasses >= 20 ? colors.mutedForeground : colors.foreground} />
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
            ? <ActivityIndicator color={colors.primaryForeground} />
            : <Text style={styles.saveBtnText}>СОХРАНИТЬ</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container:           { flex: 1, backgroundColor: colors.background },
  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title:               { fontSize: 20, fontWeight: '700', color: colors.foreground },
  content:             { flex: 1, paddingHorizontal: 20, paddingTop: 32, alignItems: 'center' },
  iconWrapper:         { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.waterMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  voiceWrap:           { width: '100%', marginBottom: 24 },
  stepperContainer:    { flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 12 },
  stepperBtn:          { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  valueContainer:      { alignItems: 'center', minWidth: 100 },
  valueText:           { fontSize: 56, fontWeight: '700', color: colors.foreground },
  unitText:            { fontSize: 14, color: colors.mutedForeground, marginTop: -4 },
  totalText:           { fontSize: 16, color: colors.mutedForeground, marginBottom: 32 },
  quickContainer:      { width: '100%', marginBottom: 24 },
  quickLabel:          { fontSize: 12, color: colors.mutedForeground, marginBottom: 10, textAlign: 'center' },
  quickRow:            { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  quickOption:         { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  quickOptionActive:   { borderColor: colors.water, backgroundColor: colors.waterMuted },
  quickOptionText:     { fontSize: 18, fontWeight: '600', color: colors.mutedForeground },
  quickOptionTextActive:{ color: colors.water },
  infoCard:            { width: '100%', backgroundColor: colors.waterMuted, borderWidth: 1, borderColor: colors.waterMuted, borderRadius: 12, padding: 16 },
  infoTitle:           { fontSize: 13, fontWeight: '600', color: colors.water, marginBottom: 6 },
  infoText:            { fontSize: 13, color: colors.mutedForeground, lineHeight: 20 },
  footer:              { padding: 20, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn:             { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  saveBtnDisabled:     { opacity: 0.6 },
  saveBtnText:         { fontSize: 16, fontWeight: '700', color: colors.primaryForeground, letterSpacing: 0.5 },
})