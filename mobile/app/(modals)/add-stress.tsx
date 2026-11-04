// app/modals/add-stress.tsx
import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import Slider from '@react-native-community/slider'
import { createStress } from '@/lib/health-api'  // ← исправлено
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

export default function AddStressModal() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      queryClient.invalidateQueries({ queryKey: ['stress'] })
      Alert.alert('✅ Успешно', 'Стресс сохранён')
      router.back()
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('❌ Ошибка', 'Не удалось сохранить')
    },
  })

  function getStressColor(): string {
    if (level <= 3) return colors.success
    if (level <= 6) return colors.warning
    return colors.destructive
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Добавить: Стресс</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <X size={28} color={colors.mutedForeground} />
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
            maximumTrackTintColor={colors.inputBorder}
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
            placeholderTextColor={colors.mutedForeground}
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
            ? <ActivityIndicator color={colors.primaryForeground} />
            : <Text style={styles.saveBtnText}>СОХРАНИТЬ</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.background },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title:          { fontSize: 20, fontWeight: '700', color: colors.foreground },
  content:        { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  field:          { marginBottom: 24 },
  label:          { fontSize: 15, fontWeight: '500', color: colors.mutedForeground, marginBottom: 8 },
  input:          { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: colors.foreground },
  textarea:       { minHeight: 110, paddingTop: 14 },
  levelIndicator: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 8 },
  levelValue:     { fontSize: 48, fontWeight: '700' },
  levelMax:       { fontSize: 24, color: colors.mutedForeground, marginLeft: 4 },
  slider:         { width: '100%', height: 40 },
  sliderLabels:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  sliderLabel:    { fontSize: 12, color: colors.mutedForeground },
  tipCard:        { backgroundColor: colors.destructiveMuted, borderWidth: 1, borderColor: colors.destructiveMuted, borderRadius: 12, padding: 16 },
  tipTitle:       { fontSize: 14, fontWeight: '600', color: colors.destructive, marginBottom: 8 },
  tipText:        { fontSize: 13, color: colors.mutedForeground, lineHeight: 20 },
  footer:         { padding: 20, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn:        { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  saveBtnDisabled:{ opacity: 0.6 },
  saveBtnText:    { fontSize: 16, fontWeight: '700', color: colors.primaryForeground, letterSpacing: 0.5 },
})