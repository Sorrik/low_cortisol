// components/dashboard/ProgressBar.tsx
import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Colors, BorderRadius } from '@/constants/theme'

interface Props {
  progress: number   // 0–100
  height?:  number
  color?:   string
}

export function ProgressBar({ progress, height = 6, color = Colors.primary }: Props) {
  const w = Math.max(0, Math.min(100, progress))
  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${w}%` as any, backgroundColor: color, height }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    width:           '100%',
    backgroundColor: Colors.border,
    borderRadius:    BorderRadius.full,
    overflow:        'hidden',
  },
  fill: {
    borderRadius: BorderRadius.full,
  },
})