// app/_layout.tsx
import { useEffect }              from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Stack }                  from 'expo-router'
import { QueryClientProvider }    from '@tanstack/react-query'
import { StatusBar }              from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { queryClient }            from '@/lib/query-client'
import { useAuthStore }           from '@/store/auth.store'
import { AuthProvider }           from '@/context/AuthContext'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'
import { ErrorBoundary }          from '@/components/ErrorBoundary'

function ThemedShell() {
  const { colors, isDark } = useTheme()
  const isReady = useAuthStore(s => s.isReady)

  return (
    <>
      {/* backgroundColor убран из StatusBarProps в expo-status-bar (SDK 57) —
          Android теперь всегда edge-to-edge, цвет статус-бара приложением
          не задаётся. style по-прежнему управляет цветом иконок. */}
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {!isReady ? (
        <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/register" />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(modals)" options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
      )}
    </>
  )
}

export default function RootLayout() {
  const hydrate = useAuthStore(s => s.hydrate)

  useEffect(() => { hydrate() }, [])

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <ThemedShell />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}
