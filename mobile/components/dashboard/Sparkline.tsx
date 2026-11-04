import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Polyline, Defs, LinearGradient, Stop, Rect } from 'react-native-svg'
import { BorderRadius } from '@/constants/theme'

interface SparklineProps {
  data: number[]
  color: string
  height?: number
}

export function Sparkline({ data, color, height = 40 }: SparklineProps) {
  if (!data || data.length < 2) {
    return <View style={[styles.container, { height }]} />
  }

  const width = 200
  const padding = 4
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  // Generate points for polyline
  const points = data
    .map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2)
      const y = height - padding - ((value - min) / range) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <View style={[styles.container, { height }]}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Background gradient area */}
        <Polyline
          points={`${padding},${height} ${points} ${width - padding},${height}`}
          fill="url(#sparklineGradient)"
          stroke="none"
        />

        {/* Line */}
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: BorderRadius.sm,
  },
})
