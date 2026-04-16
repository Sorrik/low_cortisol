import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Colors, BorderRadius, Spacing, FontSize, FontWeight } from '@/constants/theme'
import { Sparkline } from './Sparkline'

type IoniconsName = keyof typeof Ionicons.glyphMap

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon: IoniconsName
  href: string
  progress?: number
  sparklineData: number[]
  color: string
  colorMuted: string
  onAdd?: () => void
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  href,
  progress,
  sparklineData,
  color,
  colorMuted,
  onAdd,
}: MetricCardProps) {
  const router = useRouter()

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(href as any)}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconRow}>
          <View style={[styles.iconWrapper, { backgroundColor: colorMuted }]}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>

        {onAdd && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={(e) => {
              e.stopPropagation()
              onAdd()
            }}
          >
            <Ionicons name="add" size={18} color={Colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Value */}
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {/* Progress bar */}
      {progress !== undefined && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      )}

      {/* Sparkline */}
      <Sparkline data={sparklineData} color={color} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.mutedForeground,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  value: {
    color: Colors.foreground,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    color: Colors.mutedForeground,
    fontSize: FontSize.xs,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
})
