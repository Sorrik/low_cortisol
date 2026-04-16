import { Redirect } from 'expo-router'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useAuthStore } from '@/store/auth.store'
import { Colors } from '@/constants/theme'

export default function Index() {
  const { token, isReady } = useAuthStore()

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return <Redirect href={token ? '/(tabs)' : '/auth/login'} />
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
})