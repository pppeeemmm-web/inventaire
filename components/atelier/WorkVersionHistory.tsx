'use client'

import { useState, useEffect, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { createClient } from '@/lib/supabase/client'
import {
  fetchOeuvreVersions,
  restoreOeuvreVersion,
  type OeuvreVersion,
} from '@/app/atelier/(portal)/audit/version-actions'
import { OEUVRE_VERSION_FIELDS as SHOW_FIELDS, versionFieldLabel } from '@/lib/oeuvre-version-fields'
import { gateErrorKey } from '@/lib/work-save-error'
import { AuthorBadge, authorTitle } from '@/components/shared/AuthorBadge'

function diffSnapshots(prev: Record<string, unknown> | null, cur: Record<string, unknown>) {
  if (!prev) return SHOW_FIELDS.filter((k) => cur[k] != null).map((k) => [k, null, cur[k]] as const)
  const out: Array<readonly [string, unknown, unknown]> = []
  for (const k of SHOW_FIELDS) {
    const a = prev[k]
    const b = cur[k]
    const aStr = a == null ? '' : String(a)
    const bStr = b == null ? '' : String(b)
    if (aStr !== bStr) out.push([k, a, b] as const)
  }
  return out
}

export function WorkVersionHistory({ oeuvreId, onRestored }: { oeuvreId: number; onRestored?: () => void }) {
  const { t } = useI18n()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<OeuvreVersion[]>([])
  // The work now: the « after » of the newest row's change (each row is the work BEFORE the change at its time).
  const [current, setCurrent] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    void Promise.resolve(createClient().rpc('is_admin'))
      .then(({ data }) => setIsAdmin(!!data))
      .catch(() => setIsAdmin(false))
  }, [])

  useEffect(() => {
    if (!open || !isAdmin) return
    setBusy(true)
    void Promise.all([
      fetchOeuvreVersions(oeuvreId),
      Promise.resolve(createClient().from('Oeuvres').select('*').eq('OeuvreID', oeuvreId).maybeSingle()).then((r) => r.data ?? null),
    ]).then(([data, now]) => {
      setRows(data)
      setCurrent(now as Record<string, unknown> | null)
      setBusy(false)
    })
  }, [open, oeuvreId, isAdmin])

  if (isAdmin !== true) return null

  function handleRestore(v: OeuvreVersion) {
    if (!confirm(t('history_confirm_restore'))) return
    startTransition(async () => {
      const r = await restoreOeuvreVersion(v.id)
      if ('error' in r) {
        // A kept owner / holder (its contact deleted) can be refused by the holder gates: shown in words.
        const gate = gateErrorKey(r.error)
        alert(r.error === 'fate_open' ? t('history_restore_fate_open') : gate ? t(gate) : r.error)
        return
      }
      if (r.kept?.length) {
        const label = (f: string) =>
          f === 'AcheteurID' ? t('vf_buyer') : f === 'place_id' ? t('vf_location_address') : versionFieldLabel(f, t)
        alert(t('history_restore_contact_kept').replace('{fields}', r.kept.map(label).join(', ')))
      }
      onRestored?.()
      // Reload list — restore creates a new snapshot
      const [fresh, now] = await Promise.all([
        fetchOeuvreVersions(oeuvreId),
        Promise.resolve(createClient().from('Oeuvres').select('*').eq('OeuvreID', oeuvreId).maybeSingle()).then((r) => r.data ?? null),
      ])
      setRows(fresh)
      setCurrent(now as Record<string, unknown> | null)
    })
  }

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--bd)', paddingTop: 12 }}>
      <button
        type="button"
        className="btn ghost sm"
        onClick={() => setOpen((x) => !x)}
        style={{ fontSize: 10, letterSpacing: 1 }}
      >
        {open ? '▾' : '▸'} {t('history_section_title')}
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          {busy && <div style={{ opacity: 0.5, fontSize: 11 }}>{t('history_loading')}</div>}
          {!busy && rows.length === 0 && (
            <div style={{ opacity: 0.5, fontSize: 11 }}>{t('history_empty')}</div>
          )}
          {!busy && rows.map((v, i) => {
            // This row's own change (the one its time and author name): its snapshot → the next newer state.
            const next = (i > 0 ? rows[i - 1].snapshot : current) ?? null
            const isOpen = openId === v.id
            const changes = next ? diffSnapshots(v.snapshot, next as Record<string, unknown>) : []
            return (
              <div key={v.id} style={{ borderBottom: '1px solid var(--bd2)', padding: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    type="button"
                    className="btn ghost sm"
                    style={{ minWidth: 24 }}
                    onClick={() => setOpenId(isOpen ? null : v.id)}
                  >{isOpen ? '▾' : '▸'}</button>
                  {v.by ? <AuthorBadge author={v.by} /> : null}
                  <div style={{ flex: 1, fontSize: 11 }}>
                    <div style={{ color: 'var(--tx)' }}>
                      {new Date(v.changed_at).toLocaleString('fr-FR')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--tx3)' }}>
                      {v.by ? authorTitle(v.by, t) : t('ca_not_recorded')} · {changes.length} {t('history_changes_count')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn ghost sm"
                    disabled={pending}
                    onClick={() => handleRestore(v)}
                  >{t('history_restore')}</button>
                </div>
                {isOpen && (
                  <table className="tbl" style={{ width: '100%', marginTop: 6, fontSize: 10 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 140 }}>{t('history_field')}</th>
                        <th>{t('ca_before')}</th>
                        <th>{t('ca_after')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.length === 0 && (
                        <tr><td colSpan={3} style={{ opacity: 0.5 }}>{t('history_no_changes')}</td></tr>
                      )}
                      {changes.map(([k, before, after]) => (
                        <tr key={k}>
                          <td style={{ color: 'var(--tx2)' }}>{versionFieldLabel(k, t)}</td>
                          <td style={{ color: 'var(--tx3)' }}>{before == null ? '—' : String(before)}</td>
                          <td style={{ color: 'var(--ac)' }}>{after == null ? '—' : String(after)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
