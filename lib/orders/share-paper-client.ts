'use client'

// « Partager » an order's paper (Pem 2026-11-18: « Send the file itself, no link »).
// The file comes from /api/export/order-paper (team session, same origin: the Vault bucket has no
// CORS, so the browser cannot read a signed R2 URL itself). Phone / tablet: the share sheet with the
// file (Web Share API level 2). Computer, or no file sharing: the file is downloaded.

/** Files fetched this visit, so a second tap can share at once (Safari wants the share inside the tap). */
const ready = new Map<string, File>()

export type SharePaperResult = 'shared' | 'downloaded' | 'cancelled' | 'needs_second_tap' | { error: string }

function fileNameOf(storagePath: string): string {
  return storagePath.split('/').pop() || 'document.pdf'
}

function touchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

async function fetchFile(docId: string, storagePath: string): Promise<File | { error: string }> {
  const res = await fetch(`/api/export/order-paper?doc=${encodeURIComponent(docId)}`, { cache: 'no-store' })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    return { error: body?.error ?? String(res.status) }
  }
  const blob = await res.blob()
  return new File([blob], fileNameOf(storagePath), { type: blob.type || 'application/pdf' })
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export async function sharePaperFile(docId: string, storagePath: string, title: string): Promise<SharePaperResult> {
  let file = ready.get(docId)
  if (!file) {
    const got = await fetchFile(docId, storagePath)
    if ('error' in got) return got
    file = got
    ready.set(docId, file)
  }
  const canShareFile = touchDevice() && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  if (!canShareFile) {
    download(file)
    return 'downloaded'
  }
  try {
    // Files only: no url, no text — the file itself is what is sent.
    await navigator.share({ files: [file], title })
    return 'shared'
  // eslint-disable-next-line pem-i18n/no-silent-catch -- not silent: cancel / second tap / the error go back to the screen
  } catch (e) {
    const name = e instanceof DOMException ? e.name : ''
    if (name === 'AbortError') return 'cancelled'
    // The fetch took the tap's permission (iOS Safari): the file is kept, a second tap shares it.
    if (name === 'NotAllowedError') return 'needs_second_tap'
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
