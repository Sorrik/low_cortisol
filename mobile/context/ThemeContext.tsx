import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DarkColors, LightColors } from '@/constants/theme'

type Theme = 'dark' | 'light'
type ColorPalette = typeof DarkColors

interface ThemeContextValue {
  theme: Theme
  colors: ColorPalette
  toggleTheme: () => void
  setTheme: (t: Theme) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  colors: DarkColors,
  toggleTheme: () => {},
  setTheme: () => {},
  isDark: true,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    AsyncStorage.getItem('theme').then(saved => {
      if (saved === 'light' || saved === 'dark') setThemeState(saved)
    })
  }, [])

  const setTheme = async (next: Theme) => {
    setThemeState(next)
    await AsyncStorage.setItem('theme', next)
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    colors: theme === 'dark' ? DarkColors : LightColors,
    toggleTheme,
    setTheme,
    isDark: theme === 'dark',
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
