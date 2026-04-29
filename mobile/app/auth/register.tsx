import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { useThemedStyles, ColorPalette } from '@/lib/useThemedStyles';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'

interface RegisterFormValues {
  firstName: string
  lastName: string
  email: string
  password: string
}

export default function RegisterScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const router = useRouter()
  const { signUp } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: RegisterFormValues) {
    setError(null)
    setIsLoading(true)

    try {
      await signUp({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      })
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 409) {
        setError('Пользователь с таким email уже существует')
      } else if (status === 400 || status === 422) {
        setError('Проверьте правильность введённых данных')
      } else {
        setError('Ошибка соединения. Попробуйте снова')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoWrapper}>
              <Ionicons name="heart-circle" size={40} color={colors.primary} />
              <Text style={styles.logoText}>LowCor</Text>
            </View>
            <Text style={styles.tagline}>Следи за здоровьем. Понимай себя.</Text>
          </View>

          {/* Register Card */}
          <Card style={styles.card}>
            <CardContent style={styles.cardContent}>
              {/* Error */}
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Name row */}
              <View style={styles.nameRow}>
                <View style={styles.nameField}>
                  <Controller
                    control={control}
                    name="firstName"
                    rules={{ required: 'Имя обязательно' }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Имя"
                        placeholder="Иван"
                        autoCapitalize="words"
                        autoComplete="given-name"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        error={errors.firstName?.message}
                      />
                    )}
                  />
                </View>

                <View style={styles.nameField}>
                  <Controller
                    control={control}
                    name="lastName"
                    rules={{ required: 'Фамилия обязательна' }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Фамилия"
                        placeholder="Иванов"
                        autoCapitalize="words"
                        autoComplete="family-name"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        error={errors.lastName?.message}
                      />
                    )}
                  />
                </View>
              </View>

              {/* Email */}
              <Controller
                control={control}
                name="email"
                rules={{
                  required: 'Email обязателен',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Введите корректный email',
                  },
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Email"
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.email?.message}
                    leftIcon={
                      <Ionicons name="mail-outline" size={20} color={colors.mutedForeground} />
                    }
                  />
                )}
              />

              {/* Password */}
              <Controller
                control={control}
                name="password"
                rules={{
                  required: 'Пароль обязателен',
                  minLength: {
                    value: 6,
                    message: 'Минимум 6 символов',
                  },
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Пароль"
                    placeholder="Минимум 6 символов"
                    isPassword
                    autoCapitalize="none"
                    autoComplete="new-password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    leftIcon={
                      <Ionicons name="lock-closed-outline" size={20} color={colors.mutedForeground} />
                    }
                  />
                )}
              />

              {/* Submit */}
              <Button
                onPress={handleSubmit(onSubmit)}
                loading={isLoading}
                style={styles.submitButton}
              >
                Зарегистрироваться
              </Button>
            </CardContent>
          </Card>

          {/* Login link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Уже есть аккаунт? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.footerLink}>Войти</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  logoText: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  card: {
    marginBottom: Spacing.xl,
  },
  cardContent: {
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  errorContainer: {
    backgroundColor: colors.destructiveMuted,
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: colors.destructive,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  nameField: {
    flex: 1,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: colors.mutedForeground,
    fontSize: FontSize.sm,
  },
  footerLink: {
    color: colors.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
})
