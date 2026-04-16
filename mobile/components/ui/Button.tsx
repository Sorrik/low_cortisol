import React from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { Colors, BorderRadius, Spacing, FontSize, FontWeight } from '@/constants/theme'

interface ButtonProps {
  onPress: () => void
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
  icon?: React.ReactNode
}

export function Button({
  onPress,
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const isDisabled = disabled || loading

  const buttonStyles = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    isDisabled && styles.disabled,
    style,
  ]

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
    isDisabled && styles.textDisabled,
    textStyle,
  ]

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={buttonStyles}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? Colors.primaryForeground : Colors.foreground}
        />
      ) : (
        <>
          {icon}
          <Text style={textStyles}>{children}</Text>
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },

  // Variants
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  destructive: {
    backgroundColor: Colors.destructive,
  },

  // Sizes
  size_sm: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 36,
  },
  size_md: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  size_lg: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    minHeight: 52,
  },

  // Disabled
  disabled: {
    opacity: 0.5,
  },

  // Text
  text: {
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  text_primary: {
    color: Colors.primaryForeground,
  },
  text_secondary: {
    color: Colors.foreground,
  },
  text_outline: {
    color: Colors.foreground,
  },
  text_ghost: {
    color: Colors.foreground,
  },
  text_destructive: {
    color: Colors.primaryForeground,
  },

  // Text sizes
  text_sm: {
    fontSize: FontSize.sm,
  },
  text_md: {
    fontSize: FontSize.base,
  },
  text_lg: {
    fontSize: FontSize.md,
  },

  textDisabled: {
    opacity: 0.7,
  },
})
