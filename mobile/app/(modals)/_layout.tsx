// app/(modals)/_layout.tsx
import { Stack } from 'expo-router'

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        headerShown: false,
        animation: 'slide_from_bottom',
        contentStyle: { backgroundColor: '#0f0f0f' },
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