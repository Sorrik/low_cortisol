import { Redirect } from 'expo-router'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useAuthStore } from '@/store/auth.store'
import { DarkColors } from '@/constants/theme';
import { useThemedStyles, ColorPalette } from '@/lib/useThemedStyles';
import { useTheme } from '@/context/ThemeContext';
export default function Index() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { token, isReady } = useAuthStore()

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return <Redirect href={token ? '/(tabs)' : '/auth/login'} />
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
})