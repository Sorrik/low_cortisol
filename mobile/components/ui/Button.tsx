import React, { useMemo } from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { BorderRadius, Spacing, FontSize, FontWeight } from '@/constants/theme'
import { useTheme } from '@/context/ThemeContext'

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
  const { colors } = useTheme()
  const isDisabled = disabled || loading

  const styles = useMemo(() => StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
    },
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: colors.secondary },
    outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
    ghost: { backgroundColor: 'transparent' },
    destructive: { backgroundColor: colors.destructive },

    size_sm: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 36 },
    size_md: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, minHeight: 44 },
    size_lg: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, minHeight: 52 },

    disabled: { opacity: 0.5 },

    text: { fontWeight: FontWeight.semibold, textAlign: 'center' },
    text_primary: { color: colors.primaryForeground },
    text_secondary: { color: colors.foreground },
    text_outline: { color: colors.foreground },
    text_ghost: { color: colors.foreground },
    text_destructive: { color: colors.destructiveForeground },

    text_sm: { fontSize: FontSize.sm },
    text_md: { fontSize: FontSize.base },
    text_lg: { fontSize: FontSize.md },

    textDisabled: { opacity: 0.7 },
  }), [colors])

  const buttonStyles = [
    styles.base,
    styles[variant],
    styles[`size_${size}` as const],
    isDisabled && styles.disabled,
    style,
  ]

  const textStyles = [
    styles.text,
    styles[`text_${variant}` as const],
    styles[`text_${size}` as const],
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
          color={variant === 'primary' || variant === 'destructive' ? colors.primaryForeground : colors.foreground}
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
