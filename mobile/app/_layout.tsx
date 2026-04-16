// app/_layout.tsx
import { useEffect }              from 'react'
import { Stack }                  from 'expo-router'
import { QueryClientProvider }    from '@tanstack/react-query'
import { StatusBar }              from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { queryClient }            from '@/lib/query-client'
import { useAuthStore }           from '@/store/auth.store'
import { AuthProvider }           from '@/context/AuthContext'
import { ThemeProvider }          from '@/context/ThemeContext'

export default function RootLayout() {
  const hydrate = useAuthStore(s => s.hydrate)

  useEffect(() => { hydrate() }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <StatusBar style="light" backgroundColor="#0a0a0a" />
            
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="auth/login" />
              <Stack.Screen name="auth/register" />

              {/* Главные табы */}
              <Stack.Screen 
                name="(tabs)" 
                options={{ headerShown: false }} 
              />

              {/* Онбординг — на корневом уровне (рекомендуемый вариант) */}
              <Stack.Screen 
                name="onboarding" 
                options={{ headerShown: false }} 
              />

              {/* Модалки */}
              <Stack.Screen 
                name="(modals)" 
                options={{ presentation: 'modal', headerShown: false }}
              />
            </Stack>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}