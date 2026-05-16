'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type CacheEntry<T> = {
  data: T
  updatedAt: number
}

type LoadState = 'idle' | 'loading' | 'refreshing' | 'error'

const cache = new Map<string, CacheEntry<unknown>>()

function readCache<T>(key: string): CacheEntry<T> | null {
  return (cache.get(key) as CacheEntry<T> | undefined) ?? null
}

function writeCache<T>(key: string, data: T): CacheEntry<T> {
  const entry = { data, updatedAt: Date.now() }
  cache.set(key, entry)
  return entry
}

export function invalidateAtelierTabResource(keyOrPrefix: string) {
  for (const key of cache.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) cache.delete(key)
  }
}

export function peekAtelierTabResource<T>(key: string): T | null {
  return readCache<T>(key)?.data ?? null
}

export function updateAtelierTabResource<T>(
  key: string,
  updater: T | ((prev: T) => T),
): T {
  const prev = readCache<T>(key)?.data
  const next = typeof updater === 'function'
    ? (updater as (prev: T) => T)(prev as T)
    : updater
  writeCache(key, next)
  return next
}

export function useAtelierTabResource<T>({
  cacheKey,
  staleMs,
  load,
  enabled = true,
  refreshToken,
  initialData,
}: {
  cacheKey: string
  staleMs: number
  load: () => Promise<T>
  enabled?: boolean
  refreshToken?: unknown
  initialData?: T | (() => T)
}) {
  const initial = useMemo(() => {
    const cached = readCache<T>(cacheKey)
    if (cached) return cached
    if (initialData === undefined) return null
    const data = typeof initialData === 'function'
      ? (initialData as () => T)()
      : initialData
    return { data, updatedAt: 0 }
  }, [cacheKey, initialData])

  const [data, setDataState] = useState<T | null>(initial?.data ?? null)
  const [updatedAt, setUpdatedAt] = useState(initial?.updatedAt ?? 0)
  const [state, setState] = useState<LoadState>(initial ? 'idle' : 'loading')
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef<Promise<T> | null>(null)

  const setCachedData = useCallback((updater: T | ((prev: T) => T)) => {
    const prev = readCache<T>(cacheKey)?.data ?? data
    const next = typeof updater === 'function'
      ? (updater as (prev: T) => T)(prev as T)
      : updater
    writeCache(cacheKey, next)
    setDataState(next)
    setUpdatedAt(Date.now())
  }, [cacheKey, data])

  const refresh = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    const cached = readCache<T>(cacheKey)
    const now = Date.now()
    if (!force && cached && now - cached.updatedAt <= staleMs) {
      setDataState(cached.data)
      setUpdatedAt(cached.updatedAt)
      setState('idle')
      setError(null)
      return cached.data
    }

    if (inFlightRef.current) return inFlightRef.current

    setState(cached ? 'refreshing' : 'loading')
    setError(null)

    const promise = load()
    inFlightRef.current = promise
    try {
      const next = await promise
      const entry = writeCache(cacheKey, next)
      setDataState(entry.data)
      setUpdatedAt(entry.updatedAt)
      setState('idle')
      return next
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState('error')
      throw err
    } finally {
      if (inFlightRef.current === promise) inFlightRef.current = null
    }
  }, [cacheKey, load, staleMs])

  useEffect(() => {
    if (!enabled) return
    void refresh({ force: refreshToken !== undefined }).catch(() => {
      /* exposed through `error` */
    })
  }, [enabled, refresh, refreshToken])

  return {
    data,
    setCachedData,
    refresh,
    loading: state === 'loading',
    refreshing: state === 'refreshing',
    error,
    updatedAt,
    hasCachedData: data != null,
  }
}
