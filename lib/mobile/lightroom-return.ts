/** Remember active work session when user leaves for Lightroom Mobile. */

export const LIGHTROOM_RETURN_KEY = 'pem_lightroom_return'

export const LIGHTROOM_IOS_APP_STORE_URL =
  'https://apps.apple.com/app/adobe-lightroom-photo-editor/id878783582'

export type LightroomReturnContext = {
  kind: 'session'
  sessionId: string
  itemId: string
  /** Calendar day for `/atelier/session/new?date=` */
  date: string
}

export function setLightroomReturn(ctx: LightroomReturnContext): void {
  try {
    localStorage.setItem(LIGHTROOM_RETURN_KEY, JSON.stringify(ctx))
  } catch {
    /* ignore quota / private mode */
  }
}

export function readLightroomReturn(): LightroomReturnContext | null {
  try {
    const raw = localStorage.getItem(LIGHTROOM_RETURN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LightroomReturnContext>
    if (parsed?.kind !== 'session') return null
    if (!parsed.sessionId || !parsed.itemId) return null
    if (!parsed.date || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) return null
    return {
      kind: 'session',
      sessionId: parsed.sessionId,
      itemId: parsed.itemId,
      date: parsed.date,
    }
  } catch {
    return null
  }
}

export function clearLightroomReturn(): void {
  try {
    localStorage.removeItem(LIGHTROOM_RETURN_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Best-effort launch from an in-page tap. Adobe does not document a stable scheme for PWAs;
 * `lightroom-cc://` often triggers iOS “cannot open app”. Prefer manual open from Home Screen.
 */
export function tryOpenLightroomIosApp(): void {
  if (typeof document === 'undefined') return
  const scheme = 'lightroom://'
  const a = document.createElement('a')
  a.href = scheme
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** @deprecated Use tryOpenLightroomIosApp — kept for any stale imports. */
export function openLightroomMobile(): void {
  tryOpenLightroomIosApp()
}
