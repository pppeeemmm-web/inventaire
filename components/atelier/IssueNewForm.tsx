'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

import { createFieldIssueReport } from '@/app/atelier/field/actions'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { workActionTypeDisplayLabel } from '@/lib/work-action-type-label'
import { FieldHubBackLink } from '@/components/shared/FieldHubBackLink'

export type IssueWorkOption = {
  id: number
  label: string
}

export type IssueActionTypeOption = {
  id: number
  label: string
  color: string
  sort_order: number
}

type IssueNewFormProps = {
  workOptions: IssueWorkOption[]
  actionTypeOptions: IssueActionTypeOption[]
}

export function IssueNewForm({ workOptions, actionTypeOptions }: IssueNewFormProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [linkedWorkId, setLinkedWorkId] = useState('')

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (pending) return
      setPending(true)
      const fd = new FormData(e.currentTarget)
      const res = await createFieldIssueReport(fd)
      setPending(false)
      if (!res.ok) {
        if (res.error === 'missing_title') toast.error(t('issue_error_missing_title'))
        else toast.error(t('issue_error_generic'))
        return
      }
      toast.success(t('issue_saved_toast'))
      router.push('/hub')
    },
    [pending, router, t],
  )

  return (
    <main
      data-testid="issue-new-root"
      aria-labelledby="issue-new-heading"
      style={{
        minHeight: '100dvh',
        padding: 'max(24px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        maxWidth: 440,
        margin: '0 auto',
        gap: 16,
        background: 'var(--bg0)',
        color: 'var(--tx)',
      }}
    >
      <h1 id="issue-new-heading" className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>
        {t('issue_form_title')}
      </h1>
      <p className="t-mono-sm" style={{ color: 'var(--tx2)', lineHeight: 1.5, fontSize: 12 }}>
        {t('issue_form_intro')}
      </p>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          <span>{t('issue_field_action_label')}</span>
          <input
            name="action_title"
            required
            maxLength={300}
            autoComplete="off"
            placeholder={t('issue_field_action_placeholder')}
            className="input"
            style={{ minHeight: 44, fontSize: 16 }}
            aria-label={t('issue_field_action_label')}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          <span>{t('issue_field_details_label')}</span>
          <textarea
            name="details"
            rows={5}
            maxLength={12000}
            className="input"
            style={{ resize: 'vertical', minHeight: 100, fontSize: 16 }}
            aria-label={t('issue_field_details_label')}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          <span>{t('issue_field_type_label')}</span>
          <select name="type" className="input" style={{ minHeight: 44, fontSize: 16 }} aria-label={t('issue_field_type_label')}>
            <option value="maintenance">{t('issue_type_maintenance')}</option>
            <option value="bug">{t('issue_type_bug')}</option>
            <option value="improvement">{t('issue_type_improvement')}</option>
            <option value="backlog">{t('issue_type_backlog')}</option>
            <option value="suggestion">{t('issue_type_suggestion')}</option>
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          <span>{t('issue_field_work_label')}</span>
          <select
            name="oeuvre_id"
            className="input"
            value={linkedWorkId}
            onChange={(e) => setLinkedWorkId(e.target.value)}
            style={{ minHeight: 44, fontSize: 16 }}
            aria-label={t('issue_field_work_label')}
            data-testid="issue-work-select"
          >
            <option value="">{t('issue_field_work_none')}</option>
            {workOptions.map((work) => (
              <option key={work.id} value={work.id}>
                {work.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          <span>{t('issue_field_action_type_label')}</span>
          <select
            name="action_type_id"
            className="input"
            disabled={!linkedWorkId || actionTypeOptions.length === 0}
            style={{ minHeight: 44, fontSize: 16, opacity: !linkedWorkId ? 0.65 : 1 }}
            aria-label={t('issue_field_action_type_label')}
            data-testid="issue-action-type-select"
          >
            <option value="">{t('issue_field_action_type_none')}</option>
            {actionTypeOptions.map((actionType) => (
              <option key={actionType.id} value={actionType.id}>
                {workActionTypeDisplayLabel(actionType.id, actionType.label, t)}
              </option>
            ))}
          </select>
          <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 11, lineHeight: 1.35 }}>
            {t('issue_field_link_hint')}
          </span>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          <span>{t('issue_field_photo_label')}</span>
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif"
            capture="environment"
            style={{ minHeight: 44 }}
            aria-label={t('issue_field_photo_label')}
          />
        </label>

        <button type="submit" className="btn primary" disabled={pending} style={{ minHeight: 44 }}>
          {pending ? t('loading') : t('issue_submit')}
        </button>
      </form>

      <FieldHubBackLink style={{ marginTop: 8 }} />
    </main>
  )
}
