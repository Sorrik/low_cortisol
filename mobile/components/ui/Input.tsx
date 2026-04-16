import React, { useState } from 'react'
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
import { Colors, BorderRadius, Spacing, FontSize, FontWeight } from '@/constants/theme'

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
  const [showPassword, setShowPassword] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

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
          placeholderTextColor={Colors.mutedForeground}
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
              color={Colors.mutedForeground}
            />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    color: Colors.secondaryForeground,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.lg,
    minHeight: 48,
  },
  inputWrapperFocused: {
    borderColor: Colors.primary,
  },
  inputWrapperError: {
    borderColor: Colors.destructive,
  },
  input: {
    flex: 1,
    color: Colors.foreground,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 48,
  },
  leftIcon: {
    paddingLeft: Spacing.lg,
  },
  rightIcon: {
    position: 'absolute',
    right: Spacing.lg,
    padding: Spacing.xs,
  },
  error: {
    color: Colors.destructive,
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
})
