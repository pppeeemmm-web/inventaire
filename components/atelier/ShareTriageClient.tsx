'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import type { DictKey } from '@/lib/i18n/dictionary'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl } from '@/lib/data'
import { toast } from '@/lib/ui/toast'
import { deleteShareInboxEntry, type ShareInboxListRow } from '@/app/atelier/share-inbox-actions'
import {
  attachShareInboxToWork,
  attachShareInboxToWorkSession,
  createDraftWorkFromShareInbox,
  splitShareInboxIntoDrafts,
  type RecentWorkAttachRow,
} from '@/app/atelier/share-triage/actions'
import { ShareAttachPanel } from '@/components/atelier/ShareAttachPanel'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { shareImageFiles } from '@/lib/share-inbox-titre'
import { FieldHubBackLink } from '@/components/shared/FieldHubBackLink'
import {
  clearLightroomReturn,
  readLightroomReturn,
  type LightroomReturnContext,
} from '@/lib/mobile/lightroom-return'
import type { ShareInboxPayloadV1 } from '@/lib/share-inbox-types'
import { isShareInboxPayloadV1 } from '@/lib/share-inbox-types'

export type ShareTriageDetail = {
  id: string
  created_at: string
  expires_at: string
  payload: unknown
} | null

function errLabel(err: string | undefined | null, t: (k: DictKey) => string): string | null {
  if (!err) return null
  if (err === 'empty') return t('share_triage_err_empty')
  if (err === 'schema') return t('share_triage_err_schema')
  if (err === 'save') return t('share_triage_err_save')
  return t('share_triage_err_save')
}

export function ShareTriageClient(props: {
  err?: string | null
  requestedInboxId?: string | null
  detail: ShareTriageDetail
  recent: ShareInboxListRow[]
  recentWorks?: RecentWorkAttachRow[]
}) {
  const { t, lang } = useI18n()
  const router = useRouter()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [autoNavDone, setAutoNavDone] = useState(false)
  const [returnSession, setReturnSession] = useState<LightroomReturnContext | null>(null)

  useEffect(() => {
    setReturnSession(readLightroomReturn())
  }, [])

  const errBanner = useMemo(() => errLabel(props.err, t), [props.err, t])

  const detailPayload = props.detail?.payload
  const parsed = isShareInboxPayloadV1(detailPayload) ? detailPayload : null
  const showNotFound = Boolean(props.requestedInboxId && !props.detail)
  const corruptDetail =
    props.detail && !parsed && props.requestedInboxId && !showNotFound ? props.detail : null

  const localeTag = lang === 'fr' ? 'fr-FR' : 'en-GB'

  const onDismiss = useCallback(
    async (id: string) => {
      setBusyId(id)
      const res = await deleteShareInboxEntry(id)
      setBusyId(null)
      if ('error' in res) {
        toast.error(`${t('error_prefix')} ${res.error}`)
        return
      }
      startTransition(() => {
        router.replace('/atelier/share-triage')
        router.refresh()
      })
    },
    [router, t],
  )

  const onAttachDone = useCallback(() => {
    startTransition(() => {
      router.replace('/atelier/share-triage')
      router.refresh()
    })
  }, [router])

  const imageFiles = parsed ? shareImageFiles(parsed) : []

  useEffect(() => {
    if (returnSession) return
    if (!narrow || autoNavDone || !props.detail?.id || !parsed) return
    if (imageFiles.length !== 1) return
    setAutoNavDone(true)
    router.replace(`/atelier/works/new?shareInbox=${encodeURIComponent(props.detail.id)}`)
  }, [returnSession, narrow, autoNavDone, props.detail?.id, parsed, imageFiles.length, router])

  const attachToSession = useCallback(() => {
    if (!returnSession || !props.detail?.id) return
    startTransition(async () => {
      const res = await attachShareInboxToWorkSession(
        props.detail!.id,
        returnSession.sessionId,
        returnSession.itemId,
        returnSession.date,
      )
      if ('error' in res) {
        toast.error(`${t('error_prefix')} ${res.error}`)
        return
      }
      clearLightroomReturn()
      setReturnSession(null)
      toast.success(t('share_triage_session_attached'))
      if (res.href) router.push(res.href)
      else router.refresh()
    })
  }, [props.detail, returnSession, router, t])

  return (
    <div
      data-testid="share-triage-root"
      style={{
        padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
        maxWidth: 560,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <h1 className="serif" style={{ fontSize: 22 }}>{t('share_triage_title')}</h1>
      <p className="t-mono-sm" style={{ color: 'var(--tx2)', lineHeight: 1.5, fontSize: 12 }}>
        {t('share_triage_intro')}
      </p>

      {returnSession ? (
        <div
          data-testid="share-triage-return-session"
          style={{
            border: '1px solid var(--ac)',
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: 'var(--bg1)',
          }}
        >
          <p className="t-mono-sm" style={{ fontSize: 12, color: 'var(--tx2)', margin: 0, lineHeight: 1.45 }}>
            {t('share_triage_return_session_hint')}
          </p>
          {props.detail?.id && imageFiles.length > 0 ? (
            <button
              type="button"
              className="btn primary"
              style={{ minHeight: 44 }}
              disabled={pending}
              onClick={() => attachToSession()}
              data-testid="share-triage-attach-session"
            >
              {t('share_triage_attach_session')}
            </button>
          ) : null}
          <Link
            href={`/atelier/session/new?date=${encodeURIComponent(returnSession.date)}`}
            className="btn ghost"
            style={{ minHeight: 44, textAlign: 'center', textDecoration: 'none' }}
            onClick={() => clearLightroomReturn()}
            data-testid="share-triage-return-session-link"
          >
            {t('share_triage_return_session')}
          </Link>
        </div>
      ) : null}

      {errBanner ? (
        <div
          role="alert"
          style={{
            padding: 12,
            border: '1px solid var(--rust)',
            background: 'var(--rust)11',
            color: 'var(--tx)',
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {errBanner}
        </div>
      ) : null}

      <div
        data-testid="share-triage-import-form"
        style={{
          border: '1px solid var(--bd)',
          padding: 14,
          borderRadius: 8,
          background: 'var(--bg1)',
        }}
      >
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>{t('share_triage_import_heading')}</div>
        <form
          action="/atelier/share-receive"
          method="post"
          encType="multipart/form-data"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            <span>{t('share_triage_field_title')}</span>
            <input
              type="text"
              name="title"
              maxLength={500}
              autoComplete="off"
              style={{ minHeight: 44, fontSize: 14, width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--bg0)', color: 'var(--tx)' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            <span>{t('share_triage_field_text')}</span>
            <textarea
              name="text"
              maxLength={12_000}
              rows={4}
              style={{ minHeight: 88, fontSize: 14, width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--bg0)', color: 'var(--tx)', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            <span>{t('share_triage_field_urls')}</span>
            <input
              type="text"
              name="url"
              inputMode="url"
              maxLength={4000}
              autoComplete="off"
              placeholder={t('share_triage_import_url_placeholder')}
              style={{ minHeight: 44, fontSize: 14, width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--bg0)', color: 'var(--tx)' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            <span>{t('share_triage_import_files_label')}</span>
            <input
              type="file"
              name="files"
              multiple
              accept="image/*,application/pdf"
              style={{ minHeight: 44, fontSize: 14, width: '100%' }}
            />
          </label>
          <button type="submit" className="btn primary" style={{ minHeight: 44 }}>
            {t('share_triage_import_submit')}
          </button>
        </form>
        <p className="t-mono-sm" style={{ marginTop: 10, marginBottom: 0, fontSize: 11, color: 'var(--tx3)', lineHeight: 1.45 }}>
          {t('share_triage_import_hint')}
        </p>
      </div>

      {showNotFound ? (
        <div role="alert" style={{ padding: 12, border: '1px solid var(--bd)', fontSize: 12 }}>
          {t('share_triage_err_not_found')}
        </div>
      ) : null}

      {corruptDetail ? (
        <div role="alert" style={{ padding: 12, border: '1px solid var(--bd)', fontSize: 12, lineHeight: 1.45 }}>
          {t('share_triage_err_payload')}
          <button
            type="button"
            className="btn primary"
            style={{ minHeight: 44, marginTop: 12, width: '100%' }}
            disabled={pending || busyId === corruptDetail.id}
            onClick={() => void onDismiss(corruptDetail.id)}
          >
            {t('share_triage_dismiss')}
          </button>
        </div>
      ) : null}

      {parsed && props.detail ? (
        <ParsedShareDetail
          parsed={parsed}
          detail={props.detail}
          pending={pending}
          busyId={busyId}
          onDismiss={onDismiss}
          onAttachDone={onAttachDone}
          recentWorks={props.recentWorks ?? []}
          narrow={narrow}
          t={t}
          router={router}
          startTransition={startTransition}
        />
      ) : null}

      <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 16 }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>{t('share_triage_recent_heading')}</div>
        {props.recent.length === 0 ? (
          <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', lineHeight: 1.5 }}>
            {t('share_triage_empty_hint')}
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {props.recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/atelier/share-triage?inbox=${encodeURIComponent(r.id)}`}
                  className="btn ghost sm"
                  style={{ display: 'flex', justifyContent: 'space-between', width: '100%', minHeight: 44, alignItems: 'center' }}
                >
                  <span className="t-mono-sm" style={{ fontSize: 10 }}>{r.id.slice(0, 8)}…</span>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>
                    {new Date(r.created_at).toLocaleString(localeTag, { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link href="/atelier" className="btn ghost" style={{ minHeight: 44, textAlign: 'center' }}>
        {t('field_stub_cta_atelier')}
      </Link>
      <FieldHubBackLink style={{ marginTop: 8 }} />
    </div>
  )
}

function ParsedShareDetail(props: {
  parsed: ShareInboxPayloadV1
  detail: NonNullable<ShareTriageDetail>
  pending: boolean
  busyId: string | null
  onDismiss: (id: string) => void
  onAttachDone: () => void
  recentWorks: RecentWorkAttachRow[]
  narrow: boolean
  t: (k: DictKey) => string
  router: ReturnType<typeof useRouter>
  startTransition: (fn: () => void) => void
}) {
  const {
    parsed,
    detail,
    pending,
    busyId,
    onDismiss,
    onAttachDone,
    recentWorks,
    narrow,
    t,
    router,
    startTransition,
  } = props
  const imageFiles = shareImageFiles(parsed)

  function goNewWork() {
    router.push(`/atelier/works/new?shareInbox=${encodeURIComponent(detail.id)}`)
  }

  async function runSplitAll() {
    startTransition(async () => {
      const res = await splitShareInboxIntoDrafts(detail.id)
      if ('error' in res) {
        toast.error(`${t('error_prefix')} ${res.error}`)
        return
      }
      toast.success(t('share_triage_attach_ok'))
      if (res.hrefs.length === 1 && res.hrefs[0]) {
        window.location.href = res.hrefs[0]!
      } else {
        onAttachDone()
      }
    })
  }

  async function runCreateOne(fileIndex: number) {
    startTransition(async () => {
      const res = await createDraftWorkFromShareInbox(detail.id, { fileIndex })
      if ('error' in res) {
        toast.error(`${t('error_prefix')} ${res.error}`)
        return
      }
      if (res.href) window.location.href = res.href
    })
  }

  async function attachToWork(workId: number) {
    startTransition(async () => {
      const res = await attachShareInboxToWork(detail.id, workId)
      if ('error' in res) {
        toast.error(`${t('error_prefix')} ${res.error}`)
        return
      }
      toast.success(t('share_triage_attach_ok'))
      if (res.href) window.location.href = res.href
      else onAttachDone()
    })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {parsed.title ? (
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 6 }}>{t('share_triage_field_title')}</div>
          <div style={{ fontSize: 14 }}>{parsed.title}</div>
        </div>
      ) : null}
      {parsed.text ? (
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 6 }}>{t('share_triage_field_text')}</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0, fontFamily: 'inherit', color: 'var(--tx2)' }}>
            {parsed.text}
          </pre>
        </div>
      ) : null}
      {parsed.urls.length > 0 ? (
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 6 }}>{t('share_triage_field_urls')}</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
            {parsed.urls.map((u) => (
              <li key={u} style={{ marginBottom: 4 }}>
                <a href={u} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ac)' }}>{u}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {parsed.files.length > 0 ? (
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>{t('share_triage_files_heading')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {parsed.files.map((f) => {
              const href = imageUrl(f.r2_key)
              const isImg = f.mime.startsWith('image/')
              return (
                <div
                  key={f.r2_key}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    padding: 10,
                    border: '1px solid var(--bd)',
                    background: 'var(--bg1)',
                  }}
                >
                  {isImg && href ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={href} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4 }} />
                  ) : (
                    <div style={{ width: 56, height: 56, display: 'grid', placeItems: 'center', background: 'var(--bg2)', fontSize: 10 }}>
                      PDF
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                    <div className="t-mono-sm" style={{ fontSize: 9, opacity: 0.6 }}>{f.mime} · {f.bytes} B</div>
                  </div>
                  {href ? (
                    <a
                      className="btn ghost sm"
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ minHeight: 44, flexShrink: 0 }}
                    >
                      {t('share_triage_open_r2')}
                    </a>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {imageFiles.length > 0 ? (
        <div
          data-testid="share-triage-new-work"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <div className="t-eyebrow">{t('share_triage_new_work')}</div>
          <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', margin: 0, lineHeight: 1.45 }}>
            {t('share_triage_lightroom_hint')}
          </p>
          <button
            type="button"
            className="btn primary"
            style={{ minHeight: 44 }}
            disabled={pending}
            onClick={() => (imageFiles.length === 1 ? goNewWork() : void runSplitAll())}
          >
            {imageFiles.length === 1 ? t('share_triage_new_work') : t('share_triage_split_all')}
          </button>
          {imageFiles.length > 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {imageFiles.map((f) => {
                const idx = parsed.files.findIndex((x) => x.r2_key === f.r2_key)
                return (
                  <button
                    key={f.r2_key}
                    type="button"
                    className="btn ghost sm"
                    style={{ minHeight: 44, justifyContent: 'flex-start' }}
                    disabled={pending}
                    onClick={() => void runCreateOne(idx)}
                  >
                    {t('share_triage_split_one')}: {f.name}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {recentWorks.length > 0 && imageFiles.length > 0 ? (
        <div data-testid="share-triage-recent-works">
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>{t('share_triage_recent_works')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentWorks.map((w) => (
              <button
                key={w.id}
                type="button"
                className="btn ghost sm"
                style={{ minHeight: 44, justifyContent: 'flex-start' }}
                disabled={pending}
                onClick={() => void attachToWork(w.id)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <ShareAttachPanel inboxId={detail.id} onDone={onAttachDone} />

      <button
        type="button"
        className="btn primary"
        style={{ minHeight: 44, marginTop: 8 }}
        disabled={pending || busyId === detail.id}
        onClick={() => void onDismiss(detail.id)}
      >
        {t('share_triage_dismiss')}
      </button>
    </div>
  )
}
