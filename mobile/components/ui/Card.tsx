import React, { useMemo } from 'react'
import { View, StyleSheet, ViewStyle, TouchableOpacity, StyleProp } from 'react-native'
import { BorderRadius, Spacing } from '@/constants/theme'
import { useTheme } from '@/context/ThemeContext'

interface CardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  onPress?: () => void
  variant?: 'default' | 'outlined'
}

export function Card({ children, style, onPress, variant = 'default' }: CardProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    outlined: { backgroundColor: 'transparent' },
  }), [colors])

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
  return <View style={[contentStyles.content, style]}>{children}</View>
}

interface CardHeaderProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function CardHeader({ children, style }: CardHeaderProps) {
  return <View style={[contentStyles.header, style]}>{children}</View>
}

const contentStyles = StyleSheet.create({
  content: { padding: Spacing.lg },
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
})
