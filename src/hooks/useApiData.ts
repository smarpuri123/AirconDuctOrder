import { useEffect, useState } from 'react'
import { isApiMode } from '@/lib/api'
import { getCacheRevision, hydrateFromApi, subscribeDataCache } from '@/lib/dataCache'

/** Reload API cache when a page mounts; returns a tick for list/stat memo deps. */
export function useApiData(): number {
  const [tick, setTick] = useState(() => getCacheRevision())

  useEffect(() => {
    const bump = () => setTick(getCacheRevision())
    const unsub = subscribeDataCache(bump)
    if (isApiMode) {
      hydrateFromApi().catch(bump)
    }
    return unsub
  }, [])

  return tick
}
