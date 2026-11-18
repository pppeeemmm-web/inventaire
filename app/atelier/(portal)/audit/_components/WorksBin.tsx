'use client'

// Audit « Corbeille » (admin): the works in the bin (`Oeuvres.deleted_at` set), newest first.
// « Restaurer » = the toast's undo (`restoreSoftDeletedWorks`): the database resumes the work's paused
// tasks (trg_oeuvre_bin_tasks) and the shell reads it back into its lists (works-restored bus).
// « Supprimer définitivement » = the work card's Zone admin purge (`purgeWorkPermanently`), after a confirm.
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { useConfirmStep } from '@/hooks/useConfirmStep'
import { MissingThumb, WorkThumb } from '@/components/atelier/WorkThumb'
import { listTrashedWorks, type TrashedWork } from '@/app/atelier/(portal)/audit/bin-actions'
import { purgeWorkPermanently, restoreSoftDeletedWorks } from '@/app/atelier/works/actions'
import { emitWorksRestored } from '@/lib/atelier/works-restored-bus'
import { workSaveErrorToastMessage } from '@/lib/work-save-error'

export function WorksBin() {
  const { t, lang } = useI18n()
  const router = useRouter()
  const { confirmStep, confirmDialog } = useConfirmStep()
  const [works, setWorks] = useState<TrashedWork[] | null>(null)
  const [failed, setFailed] = useState<'admin' | 'load' | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  const reload = useCallback(() => {
    void listTrashedWorks()
      .then((res) => {
        if ('error' in res) setFailed(res.error === 'admin' || res.error === 'auth' ? 'admin' : 'load')
        else {
          setFailed(null)
          setWorks(res.works)
        }
      })
      .catch(() => setFailed('load'))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function restore(w: TrashedWork) {
    setBusyId(w.id)
    const res = await restoreSoftDeletedWorks([w.id])
    setBusyId(null)
    if ('error' in res) {
      toast.error(t('restoreWorkFailed'))
      return
    }
    setWorks((prev) => prev?.filter((x) => x.id !== w.id) ?? prev)
    emitWorksRestored([w.id])
    router.refresh()
    toast.success(t('bin_restored').replace('{id}', String(w.id)))
  }

  async function purge(w: TrashedWork) {
    const ok = await confirmStep({
      title: t('bin_purge_title'),
      body: t('wc_purge_confirm_fmt').replace('{id}', String(w.id)),
      confirmLabel: t('bin_purge'),
      cancelLabel: t('cancel'),
    })
    if (!ok) return
    setBusyId(w.id)
    const res = await purgeWorkPermanently(w.id)
    setBusyId(null)
    if ('error' in res) {
      toast.error(workSaveErrorToastMessage(res.error, t))
      return
    }
    setWorks((prev) => prev?.filter((x) => x.id !== w.id) ?? prev)
    toast.success(t('wc_purge_done'))
  }

  return (
    <div data-testid="audit-works-bin" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)' }}>
        <div className="t-eyebrow" style={{ fontSize: 10 }}>
          {t('bin_title')}
          {works ? ` · ${works.length}` : ''}
        </div>
        <p style={{ fontSize: 12, color: 'var(--tx3)', margin: '4px 0 0' }}>{t('bin_intro')}</p>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {failed === 'admin' ? (
          <div data-testid="audit-works-bin-admin-only" style={{ padding: 40, opacity: 0.6 }} className="t-mono-sm">{t('bin_admin_only')}</div>
        ) : failed ? (
          <div style={{ padding: 40, color: 'var(--rust)' }} className="t-mono-sm">{t('bin_load_error')}</div>
        ) : !works ? (
          <div style={{ padding: 40, opacity: 0.5 }} className="t-mono-sm">{t('bin_loading')}</div>
        ) : works.length === 0 ? (
          <div data-testid="audit-works-bin-empty" style={{ padding: 40, opacity: 0.5 }} className="t-mono-sm">{t('bin_empty')}</div>
        ) : (
          works.map((w) => (
            <div
              key={w.id}
              data-testid={`audit-works-bin-row-${w.id}`}
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', padding: '8px 16px', borderBottom: '1px solid var(--bg2)' }}
            >
              <div style={{ width: 48, height: 48, flex: '0 0 48px', borderRadius: 4, overflow: 'hidden', background: 'var(--bg2)' }}>
                {w.image ? <WorkThumb file={w.image} alt={w.title ?? `#${w.id}`} size={128} displaySize="48px" /> : <MissingThumb id={w.id} />}
              </div>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <b>#{w.id}</b> · {w.title?.trim() || t('bin_untitled')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
                  {t('bin_deleted_on').replace('{date}', new Date(w.deletedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }))}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginLeft: 'auto' }}>
                <button
                  type="button"
                  className="btn sm"
                  data-testid={`audit-works-bin-restore-${w.id}`}
                  disabled={busyId === w.id}
                  onClick={() => void restore(w)}
                  style={{ minHeight: 44 }}
                >
                  {t('bin_restore')}
                </button>
                <button
                  type="button"
                  className="btn ghost sm"
                  data-testid={`audit-works-bin-purge-${w.id}`}
                  disabled={busyId === w.id}
                  onClick={() => void purge(w)}
                  style={{ minHeight: 44, color: 'var(--rust)', borderColor: 'color-mix(in srgb, var(--rust) 40%, transparent)' }}
                >
                  {t('bin_purge')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {confirmDialog}
    </div>
  )
}
