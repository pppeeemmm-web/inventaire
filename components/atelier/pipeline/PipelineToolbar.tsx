'use client'

import {
  TYPE_COLORS,
  type Process,
  type ProcessType,
} from '@/components/atelier/pipeline/pipeline-shared'
import { SORTED_PROCESS_TYPES } from '@/components/atelier/pipeline/pipeline-suivi-labels'

interface PipelineToolbarProps {
  atelierNarrow: boolean
  mainView: 'gantt' | 'calendar'
  setMainView: (view: 'gantt' | 'calendar') => void
  typeFilter: ProcessType | 'all'
  setTypeFilter: (filter: ProcessType | 'all') => void
  showDone: boolean
  setShowDone: (show: boolean) => void
  setEditing: (editing: Process | 'new' | null) => void
  t: (key: string) => string
  typeLabel: (typ: ProcessType) => string
}

export function PipelineToolbar({
  atelierNarrow,
  mainView,
  setMainView,
  typeFilter,
  setTypeFilter,
  showDone,
  setShowDone,
  setEditing,
  t,
  typeLabel,
}: PipelineToolbarProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: atelierNarrow ? 'column' : 'row',
      alignItems: atelierNarrow ? 'stretch' : 'center',
      gap: atelierNarrow ? 12 : 10,
      rowGap: 10,
      padding: atelierNarrow ? '10px 16px' : '10px 28px', borderBottom: '1px solid var(--bd)',
      background: 'var(--bg1)', flexShrink: 0,
    }}>
      <div
        data-testid={atelierNarrow ? 'pipeline-toolbar-compact' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: atelierNarrow ? 8 : 14,
          flexWrap: atelierNarrow ? 'nowrap' : 'wrap',
          width: '100%',
          minWidth: 0,
        }}
      >
        {!atelierNarrow ? (
          <div
            role="group"
            aria-label={t('pipeline_view_mode_aria')}
            style={{
              display: 'flex',
              width: 'auto',
              padding: 3,
              gap: 0,
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              borderRadius: 10,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
              minWidth: 0,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              aria-pressed={mainView === 'gantt'}
              onClick={() => setMainView('gantt')}
              style={{
                minWidth: 100,
                minHeight: 44,
                padding: '10px 14px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                border: 'none',
                cursor: 'pointer',
                background: mainView === 'gantt' ? 'var(--ac)' : 'transparent',
                color: mainView === 'gantt' ? 'var(--bg0)' : 'var(--tx)',
                borderRadius: '7px 0 0 7px',
                boxShadow: mainView === 'gantt' ? '0 1px 3px rgba(0,0,0,0.2)' : undefined,
              }}
            >
              {t('pipeline_view_gantt')}
            </button>
            <button
              type="button"
              aria-pressed={mainView === 'calendar'}
              onClick={() => setMainView('calendar')}
              style={{
                minWidth: 100,
                minHeight: 44,
                padding: '10px 14px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                border: 'none',
                cursor: 'pointer',
                background: mainView === 'calendar' ? 'var(--ac)' : 'transparent',
                color: mainView === 'calendar' ? 'var(--bg0)' : 'var(--tx)',
                borderRadius: '0 7px 7px 0',
                boxShadow: mainView === 'calendar' ? '0 1px 3px rgba(0,0,0,0.2)' : undefined,
              }}
            >
              {t('pipeline_view_calendar')}
            </button>
          </div>
        ) : null}
        {atelierNarrow ? (
          <button
            type="button"
            className="btn ghost sm"
            aria-label={t('pipeline_new_process')}
            onClick={() => setEditing('new')}
            style={{ minWidth: 44, minHeight: 44, flexShrink: 0, fontSize: 18, padding: 4 }}
          >
            +
          </button>
        ) : null}
        {!atelierNarrow && (
          <div aria-hidden style={{ width: 1, height: 32, background: 'var(--bd)', flexShrink: 0 }} />
        )}
        {!atelierNarrow ? (
          <div
            className="t-mono-sm"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 6,
              flex: 1,
              minWidth: 0,
              maxWidth: '100%',
              color: 'var(--tx3)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
              marginTop: 0,
            }}
          >
            <span style={{ marginRight: 6, flexShrink: 0 }}>{t('pipeline_filter_group_label')}</span>
            <div
              style={{
                display: 'flex',
                flexWrap: 'nowrap',
                gap: 6,
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <button type="button" className="btn ghost sm"
                style={{ background: typeFilter==='all' ? 'var(--ac)' : undefined, color: typeFilter==='all' ? 'var(--bg0)' : undefined }}
                onClick={() => setTypeFilter('all')}>{t('pipeline_filter_all')}</button>
              {SORTED_PROCESS_TYPES.map((typ) => (
                <button key={typ} type="button" className="btn ghost sm"
                  style={{
                    background: typeFilter===typ ? TYPE_COLORS[typ] : undefined,
                    color: typeFilter===typ ? '#111' : undefined,
                    borderColor: `${TYPE_COLORS[typ]}88`,
                    opacity: typeFilter!=='all' && typeFilter!==typ ? 0.35 : 1,
                  }}
                  onClick={() => setTypeFilter(typeFilter===typ ? 'all' : typ)}>
                  {typeLabel(typ)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {atelierNarrow ? (
        <div
          data-testid="pipeline-toolbar-scroll"
          className="t-mono-sm"
          style={{
            display: 'flex',
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch' as const,
            paddingBottom: 2,
            color: 'var(--tx3)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}
        >
          <button type="button" className="btn ghost sm"
            style={{ flexShrink: 0, background: typeFilter==='all' ? 'var(--ac)' : undefined, color: typeFilter==='all' ? 'var(--bg0)' : undefined }}
            onClick={() => setTypeFilter('all')}>{t('pipeline_filter_all')}</button>
          {SORTED_PROCESS_TYPES.map((typ) => (
            <button key={typ} type="button" className="btn ghost sm"
              style={{
                flexShrink: 0,
                background: typeFilter===typ ? TYPE_COLORS[typ] : undefined,
                color: typeFilter===typ ? '#111' : undefined,
                borderColor: `${TYPE_COLORS[typ]}88`,
                opacity: typeFilter!=='all' && typeFilter!==typ ? 0.35 : 1,
              }}
              onClick={() => setTypeFilter(typeFilter===typ ? 'all' : typ)}>
              {typeLabel(typ)}
            </button>
          ))}
        </div>
      ) : null}
      {!atelierNarrow ? (
        <div style={{
          marginLeft: 'auto',
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx3)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            {t('pipeline_show_completed')}
          </label>
          <button type="button" className="btn ghost sm" onClick={() => setEditing('new')}>{t('pipeline_new_process')}</button>
        </div>
      ) : (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx3)', cursor: 'pointer', alignSelf: 'flex-start' }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          {t('pipeline_show_completed')}
        </label>
      )}
    </div>
  )
}
