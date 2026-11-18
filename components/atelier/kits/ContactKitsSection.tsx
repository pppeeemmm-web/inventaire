'use client'

// « Kits envoyés » on a contact card (TODO 11b): what was offered to this person, what is tracked (opens, PDF,
// enquiries — nothing more), Prolonger / Retirer, « + Nouveau kit ». Starts folded (owner rule: collapse by default).

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { interpolateMessage } from '@/lib/i18n/message-core'
import { toast } from '@/lib/ui/toast'
import {
  KIT_EXPIRY_WARN_DAYS,
  kitDaysLeft,
  kitPublicUrl,
  kitState,
  type KitSummary,
} from '@/lib/collector-kit'
import { listContactKits, prolongKit, revokeKit } from '@/app/atelier/kits/actions'
import { ShareKitSheet } from './ShareKitSheet'

const CHIP: React.CSSProperties = {
  display: 'inline-block', fontSize: 11, padding: '1px 8px', borderRadius: 10, border: '1px solid var(--ac)', color: 'var(--ac)', marginLeft: 6, whiteSpace: 'nowrap',
}

export function ContactKitsSection({ contactId }: { contactId: number }) {
  const { t, lang } = useI18n()
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const [open, setOpen] = useState(false)
  const [kits, setKits] = useState<KitSummary[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)

  const day = useCallback(
    (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }) : ''),
    [locale],
  )

  const refresh = useCallback(() => {
    void listContactKits(contactId).then((res) => {
      if ('error' in res) { toast.error(interpolateMessage(t('ck_list_error_fmt'), { error: res.error })); setKits([]); return }
      setKits(res)
    })
  }, [contactId, t])

  useEffect(() => { setKits(null); setOpen(false) }, [contactId])
  useEffect(() => { if (open && kits == null) refresh() }, [open, kits, refresh])

  async function prolong(k: KitSummary) {
    setBusy(k.token)
    const res = await prolongKit(k.token)
    setBusy(null)
    if ('error' in res) { toast.error(interpolateMessage(t('ck_list_error_fmt'), { error: res.error })); return }
    toast.success(interpolateMessage(t('ck_list_prolonged_fmt'), { date: day(res.expiresAt) }))
    refresh()
  }

  async function revoke(k: KitSummary) {
    if (!window.confirm(t('ck_list_revoke_confirm'))) return
    setBusy(k.token)
    const res = await revokeKit(k.token)
    setBusy(null)
    if ('error' in res) { toast.error(interpolateMessage(t('ck_list_error_fmt'), { error: res.error })); return }
    toast.success(t('ck_list_revoked_toast'))
    refresh()
  }

  async function copy(k: KitSummary) {
    const url = kitPublicUrl(k.token, process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || window.location.origin)
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('ck_copied'))
      // eslint-disable-next-line pem-i18n/no-silent-catch -- shown to the person as a toast
    } catch {
      toast.error(t('ck_copy_failed'))
    }
  }

  const activeCount = (kits ?? []).filter((k) => kitState(k) === 'active').length

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--bd)', paddingTop: 8 }} data-testid="contact-kits">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{ flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--tx)', cursor: 'pointer', padding: 0, textAlign: 'left' }}
        >
          <span style={{ fontSize: 10, color: 'var(--tx3)' }}>{open ? '▾' : '▸'}</span>
          <span style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tx3)' }}>{t('ck_list_title')}</span>
          {kits && kits.length > 0 ? <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>{`${activeCount}/${kits.length}`}</span> : null}
        </button>
        <button type="button" className="btn sm primary" style={{ minHeight: 44, flexShrink: 0 }} onClick={() => setSheet(true)} data-testid="contact-kits-new">
          {t('ck_list_new')}
        </button>
      </div>

      {open ? (
        kits == null ? (
          <div style={{ fontSize: 12, color: 'var(--tx3)', padding: '8px 0' }}>{t('ck_loading')}</div>
        ) : kits.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--tx3)', padding: '8px 0' }}>{t('ck_list_empty')}</div>
        ) : (
          kits.map((k) => {
            const state = kitState(k)
            const left = kitDaysLeft(k.expiresAt)
            const name = `${k.groupName ?? t('ck_list_selection')} · ${interpolateMessage(t('ck_list_works_fmt'), { count: k.workCount })}`
            const stats: string[] = []
            if (state === 'revoked') {
              stats.push(k.viewCount > 0 ? interpolateMessage(t('ck_list_opened_fmt'), { count: k.viewCount, date: day(k.lastOpenedAt) }) : t('ck_list_not_opened'))
              stats.push(interpolateMessage(t('ck_list_revoked_fmt'), { date: day(k.revokedAt) }))
            } else {
              stats.push(k.viewCount > 0
                ? interpolateMessage(t('ck_list_opened_fmt'), { count: k.viewCount, date: day(k.lastOpenedAt) })
                : `${t('ck_list_not_opened')} · ${interpolateMessage(t('ck_list_created_fmt'), { date: day(k.createdAt) })}`)
              stats.push(k.pdfMadeAt
                ? (k.pdfDownloads > 0 ? interpolateMessage(t('ck_list_pdf_downloaded_fmt'), { count: k.pdfDownloads }) : '')
                : t('ck_list_pdf_missing'))
              stats.push(interpolateMessage(t('ck_list_until_fmt'), { date: day(k.expiresAt) }))
            }
            return (
              <div key={k.token} style={{ padding: '10px 0', borderBottom: '1px solid var(--bd)' }}>
                <div style={{ fontSize: 13, color: state === 'active' ? 'var(--tx)' : 'var(--tx3)', overflowWrap: 'anywhere' }}>
                  {name}
                  {k.enquiryCount > 0 ? (
                    <span style={CHIP}>{k.enquiryCount === 1 ? t('ck_list_enq_one') : interpolateMessage(t('ck_list_enq_many_fmt'), { count: k.enquiryCount })}</span>
                  ) : null}
                  {state === 'revoked' ? <span style={{ ...CHIP, borderColor: 'var(--bd)', color: 'var(--tx3)' }}>{t('ck_list_revoked')}</span>
                    : state === 'expired' ? <span style={{ ...CHIP, borderColor: 'var(--bd)', color: 'var(--tx3)' }}>{t('ck_list_expired')}</span>
                      : left != null && left <= KIT_EXPIRY_WARN_DAYS ? <span style={{ ...CHIP, borderColor: 'var(--rust)', color: 'var(--rust)' }}>{interpolateMessage(t('ck_list_expires_in_fmt'), { count: left })}</span>
                        : null}
                </div>
                <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>{stats.filter(Boolean).join(' · ')}</div>
                {state !== 'revoked' ? (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {state === 'active' ? (
                      <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => void copy(k)}>{t('ck_list_copy')}</button>
                    ) : null}
                    <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy === k.token} onClick={() => void prolong(k)}>{t('ck_list_prolong')}</button>
                    <button type="button" className="btn ghost sm" style={{ minHeight: 44, color: 'var(--rust)' }} disabled={busy === k.token} onClick={() => void revoke(k)}>{t('ck_list_revoke')}</button>
                  </div>
                ) : null}
              </div>
            )
          })
        )
      ) : null}

      {sheet ? (
        <ShareKitSheet
          source={{ kind: 'contact', contactId }}
          onClose={() => { setSheet(false); setOpen(true); setKits(null) }}
        />
      ) : null}
    </div>
  )
}
