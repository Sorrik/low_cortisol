"use client"

// components/dashboard/food-search.tsx

import { useState, useEffect, useRef } from "react"
import { Search, X, Plus, Loader2 } from "lucide-react"
import { Input }  from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"

// ── Types ─────────────────────────────────────────────────────

export interface FoodMacros {
  proteins: number
  fats:     number
  carbs:    number
  kcal:     number
}

export interface FoodItem {
  id:      string
  name:    string
  brand?:  string
  per100g: FoodMacros
}

export interface MealEntry {
  food:   FoodItem
  grams:  number
  macros: FoodMacros
}

// ── FatSecret API (через бэкенд /nutrition/food-search) ───────

const searchCache = new Map<string, FoodItem[]>()

async function searchFoods(query: string): Promise<FoodItem[]> {
  if (!query.trim()) return []

  const cacheKey = query.toLowerCase().trim()
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey)!

  let data: {
    foods: Array<{
      food_id: string
      name:    string
      brand?:  string
      per100g: { kcal: number; protein: number; fat: number; carbs: number }
    }>
  }

  try {
    const res = await api.get(
      `/nutrition/food-search?q=${encodeURIComponent(query)}`,
    )
    data = res.data
  } catch {
    return []
  }

  // Маппим ответ FatSecret → локальный FoodItem (сохраняем proteins/fats)
  const result: FoodItem[] = (data.foods ?? []).map(f => ({
    id:    f.food_id,
    name:  f.name,
    brand: f.brand,
    per100g: {
      kcal:     Math.round(f.per100g.kcal),
      proteins: Math.round(f.per100g.protein * 10) / 10,
      fats:     Math.round(f.per100g.fat     * 10) / 10,
      carbs:    Math.round(f.per100g.carbs   * 10) / 10,
    },
  }))

  searchCache.set(cacheKey, result)
  return result
}

// ── Helpers ───────────────────────────────────────────────────

function calcMacros(per100g: FoodMacros, grams: number): FoodMacros {
  const k = grams / 100
  return {
    proteins: Math.round(per100g.proteins * k * 10) / 10,
    fats:     Math.round(per100g.fats     * k * 10) / 10,
    carbs:    Math.round(per100g.carbs    * k * 10) / 10,
    kcal:     Math.round(per100g.kcal     * k),
  }
}

export function sumMacros(entries: MealEntry[]): FoodMacros {
  return entries.reduce((acc, e) => ({
    proteins: Math.round((acc.proteins + e.macros.proteins) * 10) / 10,
    fats:     Math.round((acc.fats     + e.macros.fats)     * 10) / 10,
    carbs:    Math.round((acc.carbs    + e.macros.carbs)    * 10) / 10,
    kcal:     acc.kcal + e.macros.kcal,
  }), { proteins: 0, fats: 0, carbs: 0, kcal: 0 })
}

// ── MacroBadge ────────────────────────────────────────────────

function MacroBadge({ label, value, unit = "г", color }: {
  label: string; value: number; unit?: string; color: string
}) {
  return (
    <div className={`flex flex-col items-center rounded-lg px-2.5 py-1.5 ${color}`}>
      <span className="text-xs font-bold tabular-nums">{value}{unit}</span>
      <span className="text-[10px] opacity-70">{label}</span>
    </div>
  )
}

// ── Food Search Component ─────────────────────────────────────

interface FoodSearchProps {
  entries:  MealEntry[]
  onChange: (entries: MealEntry[]) => void
}

export function FoodSearch({ entries, onChange }: FoodSearchProps) {
  const [query,    setQuery]    = useState("")
  const [results,  setResults]  = useState<FoodItem[]>([])
  const [loading,  setLoading]  = useState(false)
  const [open,     setOpen]     = useState(false)
  const [selected, setSelected] = useState<FoodItem | null>(null)
  const [grams,    setGrams]    = useState<string>("100")
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef                = useRef<HTMLInputElement>(null)
  const dropdownRef             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!query.trim() || query.length < 3) {
      setResults([])
      setOpen(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const found = await searchFoods(query)
        setResults(found)
        setOpen(found.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 600)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function selectFood(food: FoodItem) {
    setSelected(food)
    setQuery(food.name)
    setOpen(false)
    setGrams("100")
  }

  function addEntry() {
    if (!selected) return
    const g = parseFloat(grams) || 100
    if (g <= 0) return
    const entry: MealEntry = {
      food:   selected,
      grams:  g,
      macros: calcMacros(selected.per100g, g),
    }
    onChange([...entries, entry])
    setSelected(null)
    setQuery("")
    setGrams("100")
    setResults([])
  }

  function removeEntry(index: number) {
    onChange(entries.filter((_, i) => i !== index))
  }

  function updateGrams(index: number, newGrams: string) {
    const g = parseFloat(newGrams) || 0
    onChange(entries.map((e, i) =>
      i === index
        ? { ...e, grams: g, macros: calcMacros(e.food.per100g, g) }
        : e
    ))
  }

  const total = sumMacros(entries)

  return (
    <div className="flex flex-col gap-3">

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null) }}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Поиск продукта... (мин. 3 символа)"
            className="h-11 border-border bg-input pl-9 pr-9 text-foreground"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          {query && !loading && (
            <button
              type="button"
              onClick={() => { setQuery(""); setSelected(null); setResults([]); setOpen(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto
                       rounded-xl border border-border bg-card shadow-xl"
          >
            {results.map(food => (
              <button
                key={food.id}
                type="button"
                onClick={() => selectFood(food)}
                className="flex w-full items-start justify-between gap-3 px-4 py-3
                           text-left transition-colors hover:bg-secondary/60
                           border-b border-border/40 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{food.name}</p>
                  {food.brand && (
                    <p className="text-xs text-muted-foreground">{food.brand}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-foreground">{food.per100g.kcal} ккал</p>
                  <p className="text-xs text-muted-foreground">на 100г</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected food + grams */}
      {selected && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="mb-2">
            <p className="truncate text-sm font-semibold text-foreground">{selected.name}</p>
            <p className="text-xs text-muted-foreground">
              На 100г: {selected.per100g.kcal} ккал •
              Б: {selected.per100g.proteins}г •
              Ж: {selected.per100g.fats}г •
              У: {selected.per100g.carbs}г
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={grams}
                onChange={e => setGrams(e.target.value)}
                min="1"
                max="2000"
                className="h-9 w-24 border-border bg-input text-center text-foreground"
              />
              <span className="text-sm text-muted-foreground">г</span>
            </div>

            {parseFloat(grams) > 0 && (() => {
              const preview = calcMacros(selected.per100g, parseFloat(grams))
              return (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <MacroBadge label="ккал" value={preview.kcal}     unit=""  color="bg-orange-500/10 text-orange-400" />
                  <MacroBadge label="Б"    value={preview.proteins}          color="bg-blue-500/10 text-blue-400"     />
                  <MacroBadge label="Ж"    value={preview.fats}              color="bg-yellow-500/10 text-yellow-400" />
                  <MacroBadge label="У"    value={preview.carbs}             color="bg-green-500/10 text-green-400"   />
                </div>
              )
            })()}

            <Button
              type="button"
              size="sm"
              onClick={addEntry}
              className="ml-auto shrink-0 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Добавить
            </Button>
          </div>
        </div>
      )}

      {/* Added entries */}
      {entries.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Состав приёма пищи
          </p>

          {entries.map((entry, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{entry.food.name}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.macros.kcal} ккал • Б {entry.macros.proteins}г • Ж {entry.macros.fats}г • У {entry.macros.carbs}г
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Input
                  type="number"
                  value={entry.grams}
                  onChange={e => updateGrams(i, e.target.value)}
                  min="1"
                  className="h-7 w-16 border-border bg-input text-center text-xs text-foreground"
                />
                <span className="text-xs text-muted-foreground">г</span>
              </div>
              <button
                type="button"
                onClick={() => removeEntry(i)}
                className="shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          {entries.length > 1 && (
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Итого</span>
              <div className="flex items-center gap-1.5">
                <MacroBadge label="ккал" value={total.kcal}     unit=""  color="bg-orange-500/10 text-orange-400" />
                <MacroBadge label="Б"    value={total.proteins}          color="bg-blue-500/10 text-blue-400"     />
                <MacroBadge label="Ж"    value={total.fats}              color="bg-yellow-500/10 text-yellow-400" />
                <MacroBadge label="У"    value={total.carbs}             color="bg-green-500/10 text-green-400"   />
              </div>
            </div>
          )}
        </div>
      )}

      {entries.length === 0 && !selected && (
        <p className="text-center text-xs text-muted-foreground/50 py-1">
          Найдите продукт и укажите граммы — БЖУ посчитается автоматически
        </p>
      )}
    </div>
  )
}