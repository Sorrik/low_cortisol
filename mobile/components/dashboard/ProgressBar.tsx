// components/dashboard/ProgressBar.tsx
import React from 'react'
import { View, StyleSheet } from 'react-native'
import { BorderRadius } from '@/constants/theme'
import { useTheme } from '@/context/ThemeContext'

interface Props {
  progress: number   // 0–100
  height?:  number
  color?:   string
}

export function ProgressBar({ progress, height = 6, color }: Props) {
  const { colors } = useTheme()
  const fillColor = color ?? colors.primary
  const w = Math.max(0, Math.min(100, progress))
  return (
    <View style={[styles.track, { backgroundColor: colors.border, height }]}>
      <View style={[styles.fill, { width: `${w}%` as any, backgroundColor: fillColor, height }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    width:        '100%',
    borderRadius: BorderRadius.full,
    overflow:     'hidden',
  },
  fill: {
    borderRadius: BorderRadius.full,
  },
})
