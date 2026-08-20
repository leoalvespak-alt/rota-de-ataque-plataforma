'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * usePolling — stale-while-revalidate polling with background throttle
 *
 * @param fetcher  async function returning data
 * @param opts.interval           ms between polls when page is visible
 * @param opts.backgroundInterval ms between polls when page is hidden (default: interval * 4)
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  opts: { interval: number; backgroundInterval?: number }
): { data: T | null; isStale: boolean } {
  const { interval, backgroundInterval = interval * 4 } = opts
  const [data, setData] = useState<T | null>(null)
  const [isStale, setIsStale] = useState(false)
  const savedFetcher = useRef(fetcher)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { savedFetcher.current = fetcher }, [fetcher])

  useEffect(() => {
    let cancelled = false

    function getDelay() {
      return document.visibilityState === 'hidden' ? backgroundInterval : interval
    }

    async function tick() {
      try {
        const result = await savedFetcher.current()
        if (!cancelled) {
          setData(result)
          setIsStale(false)
        }
      } catch {
        if (!cancelled) setIsStale(true)
      } finally {
        if (!cancelled) {
          timerRef.current = setTimeout(tick, getDelay())
        }
      }
    }

    // Start immediately
    void tick()

    function handleVisibility() {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (!cancelled) timerRef.current = setTimeout(tick, getDelay())
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [interval, backgroundInterval])

  return { data, isStale }
}

// Legacy overload kept for backward compat (callback-based)
export function usePollingCallback(callback: () => void | Promise<void>, delay: number | null) {
  const savedCallback = useRef(callback)

  useEffect(() => { savedCallback.current = callback }, [callback])

  useEffect(() => {
    if (delay === null) return
    let timeoutId: ReturnType<typeof setTimeout>
    const tick = async () => {
      try { await savedCallback.current() }
      finally { timeoutId = setTimeout(tick, delay) }
    }
    timeoutId = setTimeout(tick, delay)
    return () => clearTimeout(timeoutId)
  }, [delay])
}

