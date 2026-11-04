import React, { useState, useMemo } from 'react'
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BorderRadius, Spacing, FontSize, FontWeight } from '@/constants/theme'
import { useTheme } from '@/context/ThemeContext'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  containerStyle?: ViewStyle
  leftIcon?: React.ReactNode
  isPassword?: boolean
}

export function Input({
  label,
  error,
  containerStyle,
  leftIcon,
  isPassword = false,
  style,
  ...props
}: InputProps) {
  const { colors } = useTheme()
  const [showPassword, setShowPassword] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  const styles = useMemo(() => StyleSheet.create({
    container: { marginBottom: Spacing.lg },
    label: {
      color: colors.secondaryForeground,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.medium,
      marginBottom: Spacing.sm,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: BorderRadius.lg,
      minHeight: 48,
    },
    inputWrapperFocused: { borderColor: colors.primary },
    inputWrapperError: { borderColor: colors.destructive },
    input: {
      flex: 1,
      color: colors.foreground,
      fontSize: FontSize.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    inputWithLeftIcon: { paddingLeft: 0 },
    inputWithRightIcon: { paddingRight: 48 },
    leftIcon: { paddingLeft: Spacing.lg },
    rightIcon: { position: 'absolute', right: Spacing.lg, padding: Spacing.xs },
    error: { color: colors.destructive, fontSize: FontSize.xs, marginTop: Spacing.xs },
  }), [colors])

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          error && styles.inputWrapperError,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : undefined,
            isPassword ? styles.inputWithRightIcon : undefined,
            style,
          ]}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.rightIcon}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}
