import { useMemo } from 'react'
import { DarkColors } from '@/constants/theme'
import { useTheme } from '@/context/ThemeContext'

export type ColorPalette = typeof DarkColors

export function useThemedStyles<T>(factory: (colors: ColorPalette) => T): T {
  const { colors } = useTheme()
  return useMemo(() => factory(colors), [colors])
}
