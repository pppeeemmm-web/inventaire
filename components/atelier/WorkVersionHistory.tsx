'use client'

import { useState, useEffect, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { createClient } from '@/lib/supabase/client'
import {
  fetchOeuvreVersions,
  restoreOeuvreVersion,
  type OeuvreVersion,
} from '@/app/atelier/audit/version-actions'

const SHOW_FIELDS = [
  'Titre', 'Année', 'TechniqueID', 'SupportID', 'FormatID',
  'Hauteur', 'Largeur', 'Profondeur', 'Prix', 'PrixFinal',
  'statusId', 'ContactID', 'Commentaires', 'Historique',
  'LocalisationID', 'LocalisationDetail', 'TVARate',
  'Catalogué', 'NeedsPhotograph', 'is_commission', 'is_paid', 'is_gift',
  'AnonymityLevel',
]

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
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    createClient().rpc('is_admin').then(({ data }) => setIsAdmin(!!data)).catch(() => setIsAdmin(false))
  }, [])

  useEffect(() => {
    if (!open || !isAdmin) return
    setBusy(true)
    fetchOeuvreVersions(oeuvreId).then((data) => {
      setRows(data)
      setBusy(false)
    })
  }, [open, oeuvreId, isAdmin])

  if (isAdmin !== true) return null

  function handleRestore(v: OeuvreVersion) {
    if (!confirm(t('history_confirm_restore'))) return
    startTransition(async () => {
      const r = await restoreOeuvreVersion(v.id)
      if ('error' in r) {
        alert(r.error)
        return
      }
      onRestored?.()
      // Reload list — restore creates a new snapshot
      const fresh = await fetchOeuvreVersions(oeuvreId)
      setRows(fresh)
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
            const prev = rows[i + 1]?.snapshot ?? null
            const isOpen = openId === v.id
            const changes = diffSnapshots(prev as Record<string, unknown> | null, v.snapshot)
            return (
              <div key={v.id} style={{ borderBottom: '1px solid var(--bd2)', padding: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    type="button"
                    className="btn ghost sm"
                    style={{ minWidth: 24 }}
                    onClick={() => setOpenId(isOpen ? null : v.id)}
                  >{isOpen ? '▾' : '▸'}</button>
                  <div style={{ flex: 1, fontSize: 11 }}>
                    <div style={{ color: 'var(--tx)' }}>
                      {new Date(v.changed_at).toLocaleString('fr-FR')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--tx3)' }}>
                      {v.source || '—'} · {changes.length} {t('history_changes_count')}
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
                        <th>{t('history_before')}</th>
                        <th>{t('history_after')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.length === 0 && (
                        <tr><td colSpan={3} style={{ opacity: 0.5 }}>{t('history_no_changes')}</td></tr>
                      )}
                      {changes.map(([k, before, after]) => (
                        <tr key={k}>
                          <td style={{ fontFamily: 'var(--mono)', color: 'var(--tx2)' }}>{k}</td>
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
