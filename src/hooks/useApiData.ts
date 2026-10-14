import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getCacheRevision, hydrateFromApi, subscribeDataCache } from '@/lib/dataCache'

/** Reload API cache when a page mounts or route changes; returns a tick for list/stat memo deps. */
export function useApiData(): number {
  const { pathname } = useLocation()
  const [tick, setTick] = useState(() => getCacheRevision())

  useEffect(() => {
    const bump = () => setTick(getCacheRevision())
    const unsub = subscribeDataCache(bump)
    return unsub
  }, [])

  useEffect(() => {
    hydrateFromApi()
      .then(() => setTick(getCacheRevision()))
      .catch(() => setTick(getCacheRevision()))
  }, [pathname])

  return tick
}
