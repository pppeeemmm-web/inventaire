'use client'

// Work drawer → "Links to other works": painted on / derived from / answers / series / diptych /
// influence / proximity. Human links in `tblrelations` (same rows the Constellation draws).

import { useCallback, useEffect, useState } from 'react'
import { addWorkLink, listWorkLinks, removeWorkLink, type WorkLink } from '@/app/atelier/works/work-link-actions'
import { WORK_LINK_TYPES, type WorkLinkType } from '@/lib/work-links'
import { WorkRef } from '@/components/atelier/WorkRef'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'

const field = { minHeight: 44, padding: '6px 8px', fontSize: 13, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)' } as const

export function WorkLinksSection({ oeuvreId }: { oeuvreId: number }) {
  const { t } = useI18n()
  const [links, setLinks] = useState<WorkLink[] | null>(null)
  const [type, setType] = useState<WorkLinkType>('painted_on')
  const [other, setOther] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await listWorkLinks(oeuvreId)
    setLinks('error' in res ? [] : res)
  }, [oeuvreId])
  useEffect(() => {
    void load()
  }, [load])

  type Key = Parameters<typeof t>[0]
  // Unknown relation types never reach here: listWorkLinks filters to WORK_LINK_TYPES.
  const label = (l: WorkLink) => t(`wl_${l.type}_${l.dir}` as Key)

  async function add() {
    const id = parseInt(other.replace(/^#/, '').trim(), 10)
    if (!Number.isInteger(id) || id <= 0) {
      toast.error(t('wl_err_work'))
      return
    }
    setBusy(true)
    const res = await addWorkLink(oeuvreId, id, type)
    setBusy(false)
    if ('error' in res) {
      toast.error(res.error === 'work_not_found' || res.error === 'work' ? t('wl_err_work') : res.error)
      return
    }
    setOther('')
    await load()
  }

  async function remove(l: WorkLink) {
    if (!window.confirm(t('wl_remove_confirm').replace('{n}', String(l.other.id)))) return
    setBusy(true)
    const res = await removeWorkLink(l.id)
    setBusy(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    await load()
  }

  return (
    <section data-testid="work-links" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="t-eyebrow">{t('wl_heading')}</div>
      {links && links.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {links.map((l) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, flexWrap: 'wrap' }}>
              <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 11 }}>{label(l)}</span>
              <WorkRef id={l.other.id} style={{ color: 'var(--ac)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                #{l.other.id}
                {l.other.title ? ` ${l.other.title}` : ''}
              </WorkRef>
              <button
                type="button"
                className="btn ghost sm"
                aria-label={t('wl_remove_aria')}
                disabled={busy}
                onClick={() => void remove(l)}
                style={{ minHeight: 44, minWidth: 44, marginLeft: 'auto' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : links ? (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 11 }}>{t('wl_none')}</div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={type} onChange={(e) => setType(e.target.value as WorkLinkType)} style={{ ...field, flex: '1 1 160px' }} aria-label={t('wl_type_aria')}>
          {WORK_LINK_TYPES.map((k) => (
            <option key={k} value={k}>
              {t(`wl_${k}_out`)}
            </option>
          ))}
        </select>
        <input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void add()
            }
          }}
          inputMode="numeric"
          placeholder={t('wl_work_ph')}
          aria-label={t('wl_work_ph')}
          style={{ ...field, width: 96 }}
        />
        <button type="button" className="btn ghost sm" disabled={busy || !other.trim()} onClick={() => void add()} style={{ minHeight: 44 }}>
          {t('wl_add')}
        </button>
      </div>
    </section>
  )
}
