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
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'

interface LoginFormValues {
  email: string
  password: string
}

export default function LoginScreen() {
  const router = useRouter()
  const { signIn } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: LoginFormValues) {
    setError(null)
    setIsLoading(true)

    try {
      await signIn(data.email, data.password)
    } catch (err) {
      setError('Неверный email или пароль')
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
              <Ionicons name="heart-circle" size={40} color={Colors.primary} />
              <Text style={styles.logoText}>LowCor</Text>
            </View>
            <Text style={styles.tagline}>Следи за здоровьем. Понимай себя.</Text>
          </View>

          {/* Login Card */}
          <Card style={styles.card}>
            <CardContent style={styles.cardContent}>
              {/* Error */}
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

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
                      <Ionicons name="mail-outline" size={20} color={Colors.mutedForeground} />
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
                    autoComplete="password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    leftIcon={
                      <Ionicons name="lock-closed-outline" size={20} color={Colors.mutedForeground} />
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
                Войти
              </Button>
            </CardContent>
          </Card>

          {/* Register link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Нет аккаунта? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/register')}>
              <Text style={styles.footerLink}>Зарегистрироваться</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.foreground,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.mutedForeground,
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
    backgroundColor: Colors.destructiveMuted,
    borderWidth: 1,
    borderColor: Colors.destructive,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: Colors.destructive,
    fontSize: FontSize.sm,
    textAlign: 'center',
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
    color: Colors.mutedForeground,
    fontSize: FontSize.sm,
  },
  footerLink: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
})
