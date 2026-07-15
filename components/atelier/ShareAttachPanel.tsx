'use client'

import { useCallback, useEffect, useState, useTransition, type CSSProperties } from 'react'
import type { DictKey } from '@/lib/i18n/dictionary'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { thumbUrl } from '@/lib/data'
import {
  attachShareInboxToContact,
  attachShareInboxToProcess,
  attachShareInboxToVault,
  attachShareInboxToVoiceNote,
  attachShareInboxToWork,
  searchShareAttachTargets,
  type ShareAttachSearchHit,
  type ShareAttachTargetType,
} from '@/app/atelier/share-triage/actions'

const TARGET_KEYS: Record<ShareAttachTargetType, DictKey> = {
  work: 'share_triage_attach_work',
  contact: 'share_triage_attach_contact',
  process: 'share_triage_attach_process',
  vault: 'share_triage_attach_vault',
  note: 'share_triage_attach_note',
}

const SEARCH_PH: Record<'work' | 'contact' | 'process', DictKey> = {
  work: 'share_triage_search_ph_work',
  contact: 'share_triage_search_ph_contact',
  process: 'share_triage_search_ph_process',
}

export function ShareAttachPanel(props: {
  inboxId: string
  onDone: () => void
}) {
  const { t } = useI18n()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<ShareAttachTargetType | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ShareAttachSearchHit[]>([])
  const [selected, setSelected] = useState<ShareAttachSearchHit | null>(null)
  const [vaultName, setVaultName] = useState('')

  const needsSearch = mode === 'work' || mode === 'contact' || mode === 'process'

  useEffect(() => {
    if (!needsSearch || query.trim().length < 1) {
      setHits([])
      return
    }
    const id = window.setTimeout(() => {
      void searchShareAttachTargets(mode!, query).then((res) => {
        if ('error' in res) return
        setHits(res.hits)
      })
    }, 280)
    return () => window.clearTimeout(id)
  }, [mode, query, needsSearch])

  const runAttach = useCallback(
    (target: ShareAttachTargetType, hit?: ShareAttachSearchHit) => {
      startTransition(async () => {
        let res: { ok: true; href?: string } | { error: string }
        if (target === 'work' && hit?.type === 'work') {
          res = await attachShareInboxToWork(props.inboxId, hit.id)
        } else if (target === 'contact' && hit?.type === 'contact') {
          res = await attachShareInboxToContact(props.inboxId, hit.id)
        } else if (target === 'process' && hit?.type === 'process') {
          res = await attachShareInboxToProcess(props.inboxId, hit.id)
        } else if (target === 'vault') {
          res = await attachShareInboxToVault(props.inboxId, vaultName || null)
        } else if (target === 'note') {
          res = await attachShareInboxToVoiceNote(props.inboxId)
        } else {
          toast.error(t('share_triage_select_target'))
          return
        }
        if ('error' in res) {
          toast.error(`${t('error_prefix')} ${res.error}`)
          return
        }
        toast.success(t('share_triage_attach_ok'))
        props.onDone()
        if (res.href) window.location.href = res.href
      })
    },
    [props, t, vaultName],
  )

  const inputStyle: CSSProperties = {
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

  if (!mode) {
    return (
      <div
        data-testid="share-attach-panel"
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div className="t-eyebrow">{t('share_triage_attach_heading')}</div>
        {(['work', 'contact', 'process', 'vault', 'note'] as ShareAttachTargetType[]).map((target) => (
          <button
            key={target}
            type="button"
            className="btn ghost sm"
            style={{ minHeight: 44, justifyContent: 'flex-start' }}
            disabled={pending}
            onClick={() => {
              setMode(target)
              setQuery('')
              setHits([])
              setSelected(null)
            }}
          >
            {t(TARGET_KEYS[target])}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div data-testid="share-attach-panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="t-eyebrow">{t(TARGET_KEYS[mode])}</div>
      {needsSearch ? (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(null)
            }}
            placeholder={t(SEARCH_PH[mode])}
            autoComplete="off"
            style={inputStyle}
            aria-label={t(SEARCH_PH[mode])}
          />
          {hits.length === 0 && query.trim() ? (
            <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', margin: 0 }}>
              {t('share_triage_no_targets')}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {hits.map((h) => (
                <li key={`${h.type}-${h.id}`}>
                  {h.type === 'work' ? (
                    <button
                      type="button"
                      className={`btn ghost sm${selected === h ? ' primary' : ''}`}
                      style={{
                        minHeight: 84,
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                      onClick={() => setSelected(h)}
                    >
                      {h.thumb ? (
                        <img
                          src={thumbUrl(h.thumb, 144) ?? ''}
                          alt=""
                          width={72}
                          height={72}
                          style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)', flexShrink: 0 }}
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          style={{
                            width: 72,
                            height: 72,
                            flexShrink: 0,
                            borderRadius: 4,
                            border: '1px solid var(--bd)',
                            background: 'var(--bg0)',
                          }}
                        />
                      )}
                      <span
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          minWidth: 0,
                        }}
                      >
                        <strong>#{h.id}</strong> {h.label}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`btn ghost sm${selected === h ? ' primary' : ''}`}
                      style={{ minHeight: 44, width: '100%', textAlign: 'left' }}
                      onClick={() => setSelected(h)}
                    >
                      {h.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : mode === 'vault' ? (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          <span>{t('share_triage_vault_name_label')}</span>
          <input
            type="text"
            value={vaultName}
            onChange={(e) => setVaultName(e.target.value)}
            maxLength={200}
            style={inputStyle}
          />
        </label>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn ghost sm"
          style={{ minHeight: 44 }}
          disabled={pending}
          onClick={() => setMode(null)}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="btn primary"
          style={{ minHeight: 44, flex: 1 }}
          disabled={pending || (needsSearch ? !selected : false)}
          data-testid="share-attach-confirm"
          onClick={() => runAttach(mode, selected ?? undefined)}
        >
          {t('share_triage_confirm_attach')}
        </button>
      </div>
    </div>
  )
}
