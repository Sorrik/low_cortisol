// app/(modals)/_layout.tsx
import { Stack } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'

export default function ModalsLayout() {
  const { colors } = useTheme()
  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        headerShown: false,
        animation: 'slide_from_bottom',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="add-sleep" />
      <Stack.Screen name="add-stress" />
      <Stack.Screen name="add-mood" />
      <Stack.Screen name="add-activity" />
      <Stack.Screen name="add-water" />
      <Stack.Screen name="add-nutrition" />
    </Stack>
  )
}