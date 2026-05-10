'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadUserRecordMarks, setUserRecordDone } from '@/app/atelier/user-record/actions'

type MarksMap = Map<string, boolean>

function key(scope: string, recordId: string) {
  return `${scope}\t${recordId}`
}

interface UserRecordDoneContextValue {
  ready: boolean
  isDone: (scope: string, recordId: string) => boolean
  toggle: (scope: string, recordId: string) => Promise<void>
}

const UserRecordDoneContext = createContext<UserRecordDoneContextValue | null>(null)

export function UserRecordDoneProvider({ children }: { children: ReactNode }) {
  const [marks, setMarks] = useState<MarksMap>(() => new Map())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user || cancelled) {
        setReady(true)
        return
      }
      const grouped = await loadUserRecordMarks()
      if (cancelled) return
      const m = new Map<string, boolean>()
      for (const [sc, ids] of Object.entries(grouped)) {
        for (const id of ids) {
          m.set(key(sc, id), true)
        }
      }
      setMarks(m)
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  const isDone = useCallback(
    (scope: string, recordId: string) => !!marks.get(key(scope, recordId)),
    [marks],
  )

  const toggle = useCallback(async (scope: string, recordId: string) => {
    const k = key(scope, recordId)
    let nextDone = false
    setMarks((prev) => {
      nextDone = !prev.get(k)
      const n = new Map(prev)
      if (nextDone) n.set(k, true)
      else n.delete(k)
      return n
    })
    const ok = await setUserRecordDone(scope, recordId, nextDone)
    if (!ok) {
      setMarks((prev) => {
        const n = new Map(prev)
        if (nextDone) n.delete(k)
        else n.set(k, true)
        return n
      })
    }
  }, [])

  const value = useMemo(
    () => ({ ready, isDone, toggle }),
    [ready, isDone, toggle],
  )

  return (
    <UserRecordDoneContext.Provider value={value}>
      {children}
    </UserRecordDoneContext.Provider>
  )
}

export function useUserRecordDone(): UserRecordDoneContextValue {
  const ctx = useContext(UserRecordDoneContext)
  if (!ctx) {
    return {
      ready: true,
      isDone: () => false,
      toggle: async () => {},
    }
  }
  return ctx
}
