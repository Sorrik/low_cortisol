// mobile/hooks/useSleepSession.ts
// Активная сессия сна — юзер тапнул "Иду спать", но ещё не тапнул "Проснулся".
// Хранится в AsyncStorage; несколько компонентов (sleep tab, dashboard banner)
// читают одно состояние через queryClient.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

const STORAGE_KEY = 'sleep_session_v1'
const QUERY_KEY = ['sleepSession']

export interface SleepSession {
  /** ISO timestamp when user tapped "Иду спать" */
  bedTime: string
  /** 'HH:MM' for UI */
  bedTimeHHMM: string
}

interface EndResult {
  bedTime: string   // 'HH:MM'
  wakeTime: string  // 'HH:MM'
  hours: number     // decimal
}

function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function readSession(): Promise<SleepSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { bedTime?: string }
    if (!parsed.bedTime) return null
    const d = new Date(parsed.bedTime)
    if (isNaN(d.getTime())) return null
    return { bedTime: parsed.bedTime, bedTimeHHMM: toHHMM(d) }
  } catch {
    return null
  }
}

export function useSleepSession() {
  const qc = useQueryClient()

  const { data: session = null, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: readSession,
    staleTime: Infinity,
  })

  const startSession = useCallback(async () => {
    const now = new Date()
    const payload = { bedTime: now.toISOString() }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    qc.setQueryData<SleepSession>(QUERY_KEY, {
      bedTime: payload.bedTime,
      bedTimeHHMM: toHHMM(now),
    })
  }, [qc])

  const endSession = useCallback(async (): Promise<EndResult | null> => {
    const current = await readSession()
    if (!current) return null

    const bed = new Date(current.bedTime)
    const wake = new Date()
    const hours = Math.round(((wake.getTime() - bed.getTime()) / 3_600_000) * 10) / 10

    await AsyncStorage.removeItem(STORAGE_KEY)
    qc.setQueryData(QUERY_KEY, null)

    // sanity: меньше часа или больше 16 часов — подозрительно, не создаём запись
    if (hours < 1 || hours > 16) return null

    return {
      bedTime: toHHMM(bed),
      wakeTime: toHHMM(wake),
      hours,
    }
  }, [qc])

  const cancelSession = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY)
    qc.setQueryData(QUERY_KEY, null)
  }, [qc])

  return {
    session,
    isLoaded: !isLoading,
    startSession,
    endSession,
    cancelSession,
  }
}
