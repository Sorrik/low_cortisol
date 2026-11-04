// mobile/components/dashboard/SleepSessionBanner.tsx
// Показывает баннер "Сплю с HH:MM · Проснуться ▸" на dashboard,
// если юзер начал сессию сна через sleep.tsx, но ещё не закрыл её.

import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme'
import { useTheme } from '@/context/ThemeContext'
import { useSleepSession } from '@/hooks/useSleepSession'

export function SleepSessionBanner() {
  const router = useRouter()
  const { colors } = useTheme()
  const { session } = useSleepSession()

  const styles = useMemo(() => StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.sleepMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.md,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1, minWidth: 0 },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { fontSize: FontSize.xs, color: colors.mutedForeground },
    time: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: colors.foreground },
    right: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
    action: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.sleep },
  }), [colors])

  if (!session) return null

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.wrap}
      onPress={() => router.push('/(tabs)/sleep')}
    >
      <View style={styles.left}>
        <View style={styles.iconWrap}>
          <Ionicons name="moon" size={18} color={colors.sleep} />
        </View>
        <View>
          <Text style={styles.label}>Активная сессия</Text>
          <Text style={styles.time}>Сплю с {session.bedTimeHHMM}</Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={styles.action}>Проснуться</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.sleep} />
      </View>
    </TouchableOpacity>
  )
}
