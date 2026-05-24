'use client'

import { ConstellationCanvas } from '@/components/atelier/ConstellationCanvas'
import type { Oeuvre } from '@/lib/types/database'

interface Props {
  oeuvres: Oeuvre[]
  tM: Record<number, string>
  themes: { id: number; name: string }[]
  themeWorkCount?: Record<number, number>
  oeuvreThemeIdsByOeuvre?: Record<number, number[]>
  groups?: { id: string; name: string }[]
  groupWorkCount?: Record<string, number>
  oeuvreGroupIdsByOeuvre?: Record<number, string[]>
  selection: Set<number>
  setSelection: (s: Set<number>) => void
  onOpen: (o: Oeuvre) => void
  onSaveGroup: (name: string, ids: number[]) => Promise<string | null>
}

/** Thin tab wrapper — canvas stays in `components/atelier/ConstellationCanvas.tsx`. */
export function Constellation(props: Props) {
  return <ConstellationCanvas {...props} />
}
