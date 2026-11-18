// Slice names for the "one read per screen open" bundles (TODO 18, owner GO 2026-11-16).
// Shared by the server read actions (`app/atelier/works/drawer-open-actions.ts`,
// `app/atelier/atelier-open-actions.ts`) and the client registry (`lib/atelier/open-reads.ts`),
// so both sides name each slice the same way. Plain module: no 'use server' / 'use client'.

/** Server → client: one result per slice; `ok: false` = that read failed, the section reads it again itself. */
export type OpenReadSlice<T = unknown> = { ok: true; v: T } | { ok: false }
export type OpenReadBundle = Record<string, OpenReadSlice>

export const linkedVoiceNotesKey = (field: string, value: string | number) => `voiceNotes:${field}:${value}`

/** Work card (drawer) — everything its sections read when a work opens. */
export const drawerOpenKey = {
  images: (id: number) => `drawer.images:${id}`,
  longText: (id: number) => `drawer.longText:${id}`,
  links: (id: number) => `drawer.links:${id}`,
  voiceNotes: (id: number) => linkedVoiceNotesKey('oeuvre_id', id),
  conditionReports: (id: number) => `drawer.conditionReports:${id}`,
  sessions: (id: number) => `drawer.sessions:${id}`,
  sessionLocations: (id: number) => `drawer.sessionLocations:${id}`,
  description: (id: number) => `drawer.description:${id}`,
  cost: (id: number) => `drawer.cost:${id}`,
  returnHint: (id: number) => `drawer.returnHint:${id}`,
} as const

export type DrawerOpenOptions = { cost: boolean; returnHint: boolean }

export function drawerOpenKeys(id: number, opts: DrawerOpenOptions): string[] {
  const k = drawerOpenKey
  const keys = [k.images(id), k.longText(id), k.links(id), k.voiceNotes(id), k.conditionReports(id), k.sessions(id), k.sessionLocations(id), k.description(id)]
  if (opts.cost) keys.push(k.cost(id))
  if (opts.returnHint) keys.push(k.returnHint(id))
  return keys
}

/** Atelier frame (every tab) — reads it makes once when the page opens. */
export const shellOpenKey = {
  postPaint: 'shell.postPaint',
  teamActivity: (since: string) => `shell.teamActivity:${since}`,
  kaizen: 'shell.kaizen',
  conflicts: 'shell.conflicts',
  /** Menu counts of work under way (TODO 19): with the frame's read, not a separate action ahead of the tab's. */
  sidebar: 'shell.sidebar',
} as const

/** Overview tab — carried by the frame's read when the page opens on Overview. */
export const overviewOpenKey = {
  seeAgain: 'overview.seeAgain',
  reminders: 'overview.reminders',
  /** Counts over the whole catalogue (TODO 18): right before the background load finishes. */
  counts: 'overview.counts',
} as const

export const OVERVIEW_REMINDER_LIMIT = 200

export function shellOpenKeys(since: string, overview: boolean): string[] {
  const keys: string[] = [shellOpenKey.postPaint, shellOpenKey.teamActivity(since), shellOpenKey.kaizen, shellOpenKey.conflicts, shellOpenKey.sidebar]
  if (overview) keys.push(overviewOpenKey.seeAgain, overviewOpenKey.reminders, overviewOpenKey.counts)
  return keys
}

export const overviewOpenKeys = (): string[] => [overviewOpenKey.seeAgain, overviewOpenKey.reminders, overviewOpenKey.counts]
