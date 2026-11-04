// mobile/components/nutrition/FoodSearchInput.tsx
//
// Поиск продуктов через бэкенд-каскад (локальная БД → FatSecret →
// OpenFoodFacts RU/EN). Пользователь ищет на русском, выбирает продукт,
// указывает граммы — БЖУ считаются автоматически. Можно собрать приём
// пищи из нескольких позиций; родителю отдаём массив entries.

import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme'
import { useThemedStyles, ColorPalette } from '@/lib/useThemedStyles'
import { useTheme } from '@/context/ThemeContext'
import { searchFoods, calcMacros, type FoodItem, type FoodMacros } from '@/lib/health-api'

export interface MealEntry {
  food:   FoodItem
  grams:  number
  macros: FoodMacros
}

export function sumMacros(entries: MealEntry[]): FoodMacros {
  return entries.reduce<FoodMacros>(
    (acc, e) => ({
      proteins: Math.round((acc.proteins + e.macros.proteins) * 10) / 10,
      fats:     Math.round((acc.fats     + e.macros.fats)     * 10) / 10,
      carbs:    Math.round((acc.carbs    + e.macros.carbs)    * 10) / 10,
      kcal:     acc.kcal + e.macros.kcal,
    }),
    { proteins: 0, fats: 0, carbs: 0, kcal: 0 },
  )
}

interface Props {
  entries:  MealEntry[]
  onChange: (entries: MealEntry[]) => void
}

export function FoodSearchInput({ entries, onChange }: Props) {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()

  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<FoodItem[]>([])
  const [loading,  setLoading]  = useState(false)
  const [open,     setOpen]     = useState(false)
  const [selected, setSelected] = useState<FoodItem | null>(null)
  const [grams,    setGrams]    = useState('100')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqIdRef    = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (selected && q === selected.name) {
      // только что выбрали продукт — не перезапускаем поиск
      return
    }
    if (q.length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const reqId = ++reqIdRef.current
      setLoading(true)
      try {
        const found = await searchFoods(q)
        if (reqId !== reqIdRef.current) return // пришёл устаревший ответ
        setResults(found)
        setOpen(found.length > 0)
      } catch {
        if (reqId === reqIdRef.current) setResults([])
      } finally {
        if (reqId === reqIdRef.current) setLoading(false)
      }
    }, 500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, selected])

  function selectFood(food: FoodItem) {
    setSelected(food)
    setQuery(food.name)
    setOpen(false)
    setResults([])
    setGrams('100')
  }

  function clearSearch() {
    setQuery('')
    setSelected(null)
    setResults([])
    setOpen(false)
  }

  function addEntry() {
    if (!selected) return
    const g = parseFloat(grams.replace(',', '.')) || 0
    if (g <= 0) return
    onChange([...entries, { food: selected, grams: g, macros: calcMacros(selected.per100g, g) }])
    clearSearch()
    setGrams('100')
  }

  function removeEntry(index: number) {
    onChange(entries.filter((_, i) => i !== index))
  }

  const gramsNum = parseFloat(grams.replace(',', '.')) || 0
  const preview  = selected && gramsNum > 0 ? calcMacros(selected.per100g, gramsNum) : null
  const total    = sumMacros(entries)

  return (
    <View style={styles.wrap}>
      {/* Search field */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={(t) => { setQuery(t); setSelected(null) }}
          placeholder="Найти продукт (мин. 2 символа)"
          placeholderTextColor={colors.mutedForeground}
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color={colors.nutrition} />}
        {!loading && query.length > 0 && (
          <TouchableOpacity onPress={clearSearch} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <View style={styles.dropdown}>
          <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {results.map((food) => (
              <TouchableOpacity
                key={food.id}
                style={styles.resultRow}
                onPress={() => selectFood(food)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                  <Text style={styles.resultName} numberOfLines={1}>{food.name}</Text>
                  {!!food.brand && <Text style={styles.resultBrand} numberOfLines={1}>{food.brand}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.resultKcal}>{food.per100g.kcal} ккал</Text>
                  <Text style={styles.resultPer100}>на 100 г</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Selected food + grams */}
      {selected && (
        <View style={styles.selectedCard}>
          <Text style={styles.selectedName} numberOfLines={1}>{selected.name}</Text>
          <Text style={styles.selectedMacros}>
            На 100 г: {selected.per100g.kcal} ккал · Б {selected.per100g.proteins} · Ж {selected.per100g.fats} · У {selected.per100g.carbs}
          </Text>

          <View style={styles.gramsRow}>
            <View style={styles.gramsInputWrap}>
              <TextInput
                style={styles.gramsInput}
                value={grams}
                onChangeText={setGrams}
                keyboardType="numeric"
                placeholder="100"
                placeholderTextColor={colors.mutedForeground}
              />
              <Text style={styles.gramsUnit}>г</Text>
            </View>

            {preview && (
              <Text style={styles.previewText}>
                = {preview.kcal} ккал · Б {preview.proteins} · Ж {preview.fats} · У {preview.carbs}
              </Text>
            )}

            <TouchableOpacity style={styles.addBtn} onPress={addEntry} activeOpacity={0.8}>
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Added entries */}
      {entries.length > 0 && (
        <View style={styles.entriesWrap}>
          <Text style={styles.entriesTitle}>Состав приёма пищи</Text>
          {entries.map((entry, i) => (
            <View key={`${entry.food.id}-${i}`} style={styles.entryRow}>
              <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                <Text style={styles.entryName} numberOfLines={1}>{entry.food.name}</Text>
                <Text style={styles.entryMacros}>
                  {entry.grams} г · {entry.macros.kcal} ккал · Б {entry.macros.proteins} · Ж {entry.macros.fats} · У {entry.macros.carbs}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeEntry(i)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          ))}

          {entries.length > 1 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Итого</Text>
              <Text style={styles.totalValue}>
                {total.kcal} ккал · Б {total.proteins} · Ж {total.fats} · У {total.carbs}
              </Text>
            </View>
          )}
        </View>
      )}

      {entries.length === 0 && !selected && (
        <Text style={styles.hint}>Найдите продукт и укажите граммы — БЖУ посчитаются автоматически</Text>
      )}
    </View>
  )
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  wrap: { gap: Spacing.sm },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.base,
    color: colors.foreground,
  },
  dropdown: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resultName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: colors.foreground },
  resultBrand: { fontSize: FontSize.xs, color: colors.mutedForeground, marginTop: 1 },
  resultKcal: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.foreground },
  resultPer100: { fontSize: FontSize.xs, color: colors.mutedForeground },
  selectedCard: {
    backgroundColor: colors.nutritionMuted,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 8,
  },
  selectedName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.foreground },
  selectedMacros: { fontSize: FontSize.xs, color: colors.mutedForeground },
  gramsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  gramsInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    minWidth: 80,
  },
  gramsInput: { flex: 1, fontSize: FontSize.base, color: colors.foreground, textAlign: 'center' },
  gramsUnit: { fontSize: FontSize.sm, color: colors.mutedForeground },
  previewText: { flex: 1, fontSize: FontSize.xs, color: colors.foreground },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.nutrition,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  entriesWrap: { gap: Spacing.sm, marginTop: 4 },
  entriesTitle: {
    fontSize: 10,
    fontWeight: FontWeight.medium,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  entryName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: colors.foreground },
  entryMacros: { fontSize: FontSize.xs, color: colors.mutedForeground, marginTop: 1 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  totalValue: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.foreground },
  hint: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: 2,
  },
})
