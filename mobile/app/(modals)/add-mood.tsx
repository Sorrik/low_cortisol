// app/modals/add-mood.tsx
import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { createMood } from '@/lib/health-api'
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

// 5-балльная шкала → 10-балльная
function scale5to10(v: number): number {
  return Math.round((v / 5) * 10)
}

const MOOD_OPTIONS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Плохо'      },
  { value: 2, emoji: '😕', label: 'Так себе'   },
  { value: 3, emoji: '😐', label: 'Нейтрально' },
  { value: 4, emoji: '😊', label: 'Хорошо'     },
  { value: 5, emoji: '😄', label: 'Отлично'    },
]

export default function AddMoodModal() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)

  const [moodValue, setMoodValue] = useState(3)
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () => createMood({  // ← исправлено
      date:      todayStr(),
      time:      nowTime(),
      moodScore: scale5to10(moodValue),
      notes:     notes.trim() || '',
    }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      queryClient.invalidateQueries({ queryKey: ['mood'] })
      Alert.alert('✅ Успешно', 'Настроение сохранено')
      router.back()
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('❌ Ошибка', 'Не удалось сохранить')
    },
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Добавить: Настроение</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <X size={28} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.field}>
          <Text style={styles.label}>Как вы себя чувствуете?</Text>
          <View style={styles.moodPicker}>
            {MOOD_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[styles.moodOption, moodValue === option.value && styles.moodOptionActive]}
                onPress={() => setMoodValue(option.value)}
              >
                <Text style={styles.moodEmoji}>{option.emoji}</Text>
                <Text style={[styles.moodLabel, moodValue === option.value && styles.moodLabelActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Заметки</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Что повлияло на настроение..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
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
  container:       { flex: 1, backgroundColor: colors.background },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title:           { fontSize: 20, fontWeight: '700', color: colors.foreground },
  content:         { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  field:           { marginBottom: 24 },
  label:           { fontSize: 15, fontWeight: '500', color: colors.mutedForeground, marginBottom: 12 },
  input:           { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: colors.foreground },
  textarea:        { minHeight: 110, paddingTop: 14 },
  moodPicker:      { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  moodOption:      { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, backgroundColor: colors.input, borderRadius: 12, borderWidth: 2, borderColor: colors.inputBorder },
  moodOptionActive:{ borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  moodEmoji:       { fontSize: 28, marginBottom: 4 },
  moodLabel:       { fontSize: 10, color: colors.mutedForeground, textAlign: 'center' },
  moodLabelActive: { color: colors.primary, fontWeight: '600' },
  footer:          { padding: 20, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn:         { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { fontSize: 16, fontWeight: '700', color: colors.primaryForeground, letterSpacing: 0.5 },
})