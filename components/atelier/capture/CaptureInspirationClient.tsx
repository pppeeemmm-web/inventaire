'use client'

// Photo · doc → Inspiration (R1 / R2, PhoneToday.notes.md v3 answer 3): one photo taken on the phone (or
// picked), a caption, and optionally a work number and / or an idée. It joins today's Journal entries.
// Taking a photo uses the camera (`capture="environment"`, allowed here: not a work-image path, CLAUDE.md
// exceptions); the image is shrunk on the phone before upload (Vercel 4.5 MB body cap) and normalised to
// AVIF on the server. Behind INSPIRATION_SQL_LIVE: until the SQL runs the screen says so and saves nothing.

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import { WorkChip } from '@/components/atelier/WorkChip'
import { downscaleImageFileForMobileIfNeeded } from '@/lib/mobile/image-upload-client'
import { INSPIRATION_MAX_EDGE, INSPIRATION_SQL_LIVE } from '@/lib/inspiration-photo'
import { addInspirationPhoto } from '@/app/atelier/capture/inspiration-actions'
import { doorErrorText } from '@/components/journal/DeskImageCapture'
import { enqueueCapture, isNetworkFailure, newCaptureId } from '@/lib/mobile/capture-queue'
import { listNoteRouteTargets } from '@/app/atelier/(portal)/notes/actions'

export function CaptureInspirationClient() {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [busy, startBusy] = useTransition()
  // Shown on the button for a moment before the page moves on (a toast alone is lost in the page load).
  const [done, setDone] = useState<string | null>(null)
  const leave = (msg: string, href: string, ms = 1200) => {
    setDone(msg)
    window.setTimeout(() => { window.location.href = href }, ms)
  }
  const [file, setFile] = useState<File | null>(null)
  const [clientId, setClientId] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [workNo, setWorkNo] = useState('')
  const [conceptId, setConceptId] = useState('')
  const [concepts, setConcepts] = useState<Array<{ id: string; titre: string }>>([])

  useEffect(() => {
    let live = true
    void listNoteRouteTargets().then((r) => {
      if (live && !('error' in r)) setConcepts(r.concepts)
    })
    return () => {
      live = false
    }
  }, [])
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const sortedConcepts = useMemo(() => [...concepts].sort((a, b) => a.titre.localeCompare(b.titre, loc)), [concepts, loc])
  const workId = /^\d{1,6}$/.test(workNo.trim().replace(/^#/, '')) ? Number(workNo.trim().replace(/^#/, '')) : null

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    setFile(f)
    setClientId(newCaptureId())
    setPreview(URL.createObjectURL(f))
  }

  function save() {
    if (!file) return
    if (!INSPIRATION_SQL_LIVE) {
      toast.error(t('insp_waiting'))
      return
    }
    startBusy(async () => {
      const small = await downscaleImageFileForMobileIfNeeded(file, narrow, INSPIRATION_MAX_EDGE)
      // One-time id (capture queue): a resend after a lost answer never saves the photo twice.
      const fields: Record<string, string> = {
        caption,
        client_id: clientId,
        ...(workId != null ? { oeuvre_id: String(workId) } : {}),
        ...(conceptId ? { concept_id: conceptId } : {}),
      }
      // No network: the photo stays on the phone and is sent when the network returns.
      const keepOnPhone = async () => {
        // Taken now with no network: it keeps today's date when it is sent later (an online pick lands on today,
        // as before; only a capture that waited carries its day).
        await enqueueCapture({ id: clientId, kind: 'photo', fields: { ...fields, taken_at: new Date().toISOString() }, blob: small, blobName: small instanceof File ? small.name : 'photo.jpg', createdAt: file.lastModified || Date.now() })
        toast.success(t('cq_kept'))
        leave(t('cq_kept'), '/hub')
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await keepOnPhone()
        return
      }
      const fd = new FormData()
      fd.set('photo', small)
      for (const [k, v] of Object.entries(fields)) fd.set(k, v)
      let res: Awaited<ReturnType<typeof addInspirationPhoto>>
      try {
        res = await addInspirationPhoto(fd)
      // eslint-disable-next-line pem-i18n/no-silent-catch -- network → kept on the phone; otherwise a toast
      } catch (err) {
        if (isNetworkFailure(err)) {
          await keepOnPhone()
          return
        }
        toast.error(t('je_err_fmt').replace('{msg}', err instanceof Error ? err.message : String(err)))
        return
      }
      if ('error' in res) {
        toast.error(doorErrorText(res.error, t))
        return
      }
      const already = t('jd_already').replace('{day}', new Date(`${res.day}T12:00:00Z`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' }))
      const textFailed = res.textError ? t('insp_text_failed').replace('{why}', doorErrorText(res.textError, t)) : null
      if (res.already) toast.info(already)
      else if (textFailed) toast.error(textFailed)
      else toast.success(t('insp_saved'))
      // A text that failed stays readable on the button a little longer.
      leave(res.already ? already : textFailed ?? t('insp_saved'), `/atelier/journal?day=${res.day}`, textFailed ? 4000 : 1200)
    })
  }

  const field: CSSProperties = {
    minHeight: 44,
    fontSize: 16,
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid var(--bd)',
    borderRadius: 6,
    background: 'var(--bg0)',
    color: 'var(--tx)',
  }
  const pickBtn: CSSProperties = {
    minHeight: 48,
    flex: '1 1 140px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    cursor: 'pointer',
  }
  const hiddenInput: CSSProperties = { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }

  return (
    <main
      data-testid="capture-inspiration-root"
      style={{
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(80px, calc(24px + env(safe-area-inset-bottom)))',
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      <h1 className="serif" style={{ fontSize: 22, marginBottom: 8 }}>{t('insp_label')}</h1>
      <p className="t-mono-sm" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 16 }}>{t('insp_intro')}</p>
      {INSPIRATION_SQL_LIVE ? null : (
        <p
          role="status"
          data-testid="capture-inspiration-waiting"
          style={{ fontSize: 13, lineHeight: 1.45, margin: '0 0 16px', padding: 10, border: '1px dashed var(--bd)', borderRadius: 8, color: 'var(--tx2)' }}
        >
          {t('insp_waiting')}
        </p>
      )}

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- local preview of the picked file (blob: URL)
        <img src={preview} alt="" style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 8, background: 'var(--bg1)', marginBottom: 12 }} />
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <label className={preview ? 'btn ghost' : 'btn'} style={pickBtn} data-testid="capture-inspiration-take">
          <span>{t('insp_take')}</span>
          <input type="file" accept="image/*" capture="environment" onChange={onFile} disabled={!!done} style={hiddenInput} aria-label={t('insp_take')} />
        </label>
        <label className="btn ghost" style={pickBtn}>
          <span>{t('insp_pick')}</span>
          <input type="file" accept="image/*" onChange={onFile} disabled={!!done} style={hiddenInput} aria-label={t('insp_pick')} />
        </label>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, marginBottom: 12 }}>
        <span>{t('insp_caption')}</span>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2000} rows={2} style={{ ...field, minHeight: 64 }} />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, marginBottom: 6 }}>
        <span>{t('insp_work')}</span>
        <input inputMode="numeric" value={workNo} onChange={(e) => setWorkNo(e.target.value)} placeholder={t('je_voice_link_work_ph')} style={field} data-testid="capture-inspiration-work" />
      </label>
      {workId != null ? (
        <div style={{ marginBottom: 12 }}>
          <WorkChip id={workId} size="chip" />
        </div>
      ) : (
        <div style={{ marginBottom: 12 }} />
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, marginBottom: 16 }}>
        <span>{t('insp_idea')}</span>
        <select value={conceptId} onChange={(e) => setConceptId(e.target.value)} style={field}>
          <option value="">{t('insp_idea_none')}</option>
          {sortedConcepts.map((c) => (
            <option key={c.id} value={c.id}>{c.titre}</option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="btn primary"
        style={{ minHeight: 48, width: '100%', whiteSpace: 'normal', position: 'sticky', bottom: 'max(12px, env(safe-area-inset-bottom))' }}
        disabled={busy || !!done || !file || !INSPIRATION_SQL_LIVE}
        data-testid="capture-inspiration-save"
        onClick={save}
      >
        {done ?? (busy ? t('insp_sending') : t('insp_save'))}
      </button>

      <Link href="/hub" className="btn ghost" aria-disabled={!!done} style={{ minHeight: 44, marginTop: 12, display: 'block', textAlign: 'center', pointerEvents: done ? 'none' : undefined }}>
        {t('field_stub_cta_hub')}
      </Link>
    </main>
  )
}
