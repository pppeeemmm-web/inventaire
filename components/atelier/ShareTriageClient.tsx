'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState, useTransition } from 'react'
import type { DictKey } from '@/lib/i18n/dictionary'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl } from '@/lib/data'
import { toast } from '@/lib/ui/toast'
import { deleteShareInboxEntry, type ShareInboxListRow } from '@/app/atelier/share-inbox-actions'
import { ShareAttachPanel } from '@/components/atelier/ShareAttachPanel'
import { FieldHubBackLink } from '@/components/shared/FieldHubBackLink'
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
}) {
  const { t, lang } = useI18n()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

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
          t={t}
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
  t: (k: DictKey) => string
}) {
  const { parsed, detail, pending, busyId, onDismiss, onAttachDone, t } = props
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
