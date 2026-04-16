import React, { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DarkColors, LightColors, Colors as ColorsRef } from '@/constants/theme'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  isDark: true,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    AsyncStorage.getItem('theme').then(saved => {
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    })
  }, [])

  // Обновляем глобальный объект Colors при смене темы
  useEffect(() => {
    const newColors = theme === 'dark' ? DarkColors : LightColors
    Object.assign(ColorsRef, newColors)
  }, [theme])

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    await AsyncStorage.setItem('theme', next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)