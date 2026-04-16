import React from 'react'
import { View, StyleSheet, ViewStyle, TouchableOpacity, StyleProp } from 'react-native'
import { Colors, BorderRadius, Spacing } from '@/constants/theme'

interface CardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  onPress?: () => void
  variant?: 'default' | 'outlined'
}

export function Card({ children, style, onPress, variant = 'default' }: CardProps) {
  const cardStyle = [
    styles.card,
    variant === 'outlined' && styles.outlined,
    style,
  ]

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    )
  }

  return <View style={cardStyle}>{children}</View>
}

interface CardContentProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function CardContent({ children, style }: CardContentProps) {
  return <View style={[styles.content, style]}>{children}</View>
}

interface CardHeaderProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function CardHeader({ children, style }: CardHeaderProps) {
  return <View style={[styles.header, style]}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  outlined: {
    backgroundColor: 'transparent',
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
})