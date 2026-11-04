import { useEffect, useState, useCallback, useRef } from 'react'
import { Pedometer } from 'expo-sensors'

export interface PedometerState {
  steps: number
  isAvailable: boolean
  isGranted: boolean
  isLoading: boolean
  refresh: () => Promise<void>
}

export function usePedometer(): PedometerState {
  const [steps, setSteps]           = useState(0)
  const [isAvailable, setIsAvailable] = useState(false)
  const [isGranted, setIsGranted]   = useState(false)
  const [isLoading, setIsLoading]   = useState(true)
  const grantedRef = useRef(false)

  const fetchTodaySteps = useCallback(async () => {
    if (!grantedRef.current) return
    try {
      const now   = new Date()
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      const result = await Pedometer.getStepCountAsync(start, now)
      setSteps(result.steps)
    } catch {
      // hardware step counter unavailable or permission revoked
    }
  }, [])

  useEffect(() => {
    let mounted = true
    // watchStepCount subscription — accumulates incremental steps on top of today's snapshot
    let subscription: ReturnType<typeof Pedometer.watchStepCount> | null = null

    async function init() {
      try {
        const available = await Pedometer.isAvailableAsync()
        if (!mounted) return
        setIsAvailable(available)

        if (!available) return

        const { status } = await Pedometer.requestPermissionsAsync()
        if (!mounted) return
        const granted = status === 'granted'
        setIsGranted(granted)
        grantedRef.current = granted

        if (!granted) return

        // Get today's baseline steps
        const now   = new Date()
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        const baseline = await Pedometer.getStepCountAsync(start, now)
        if (!mounted) return
        setSteps(baseline.steps)

        // Subscribe to live incremental updates
        subscription = Pedometer.watchStepCount(({ steps: delta }) => {
          setSteps(prev => prev + delta)
        })
      } catch {
        // Sensor unavailable
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    init()

    return () => {
      mounted = false
      subscription?.remove()
    }
  }, [])

  return { steps, isAvailable, isGranted, isLoading, refresh: fetchTodaySteps }
}
