'use client'

// ProductionTab — kanban pipeline for the /atelier team portal.
// Stages are derived from real Oeuvre fields (Catalogué, txtImageNameLink, etc.)
// Clicking a card opens the WorkDrawer via onOpen.

import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { thumbUrl, stageOf, STAGES, type StageKey } from '@/lib/data'
import type { Oeuvre } from '@/lib/types/database'

// ── Types ────────────────────────────────────────────────────

interface Props {
  oeuvres:        Oeuvre[]
  tM:             Record<number, string>
  statusLabelMap: Record<number, string>
  onOpen:         (o: Oeuvre) => void
}

// ── Component ────────────────────────────────────────────────

export function ProductionTab({ oeuvres, tM, statusLabelMap, onOpen }: Props) {
  const { t } = useI18n()

  const byStage = useMemo(() => {
    const m: Record<StageKey, Oeuvre[]> = {
      stage_idea:       [],
      stage_sketch:     [],
      stage_wip:        [],
      stage_drying:     [],
      stage_framing:    [],
      stage_shot:       [],
      stage_catalogued: [],
    }
    for (const o of oeuvres) {
      m[stageOf(o, statusLabelMap)].push(o)
    }
    return m
  }, [oeuvres, statusLabelMap])

  const wip        = oeuvres.filter((o) => !o.Catalogué).length
  const catalogued = oeuvres.filter((o) => o.Catalogué).length

  return (
    <div style={{ padding: '20px 28px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div>
          <div className="t-label">{t('production')}</div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4 }}>
            {wip} {t('wip')} · {catalogued} {t('catalogued')}
          </div>
        </div>
      </div>

      {/* Kanban grid — horizontal scroll if narrow */}
      <div style={{
        flex: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        minHeight: 0,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${STAGES.length}, minmax(180px, 1fr))`,
          gap: 1,
          background: 'var(--bd)',
          height: '100%',
          minWidth: STAGES.length * 180,
        }}>
          {STAGES.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              label={t(stage)}
              works={byStage[stage]}
              tM={tM}
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Stage column ─────────────────────────────────────────────

const STAGE_LIMIT = 40 // show up to 40 cards per column, overflow counted

function StageColumn({
  stage, label, works, tM, onOpen,
}: {
  stage:  StageKey
  label:  string
  works:  Oeuvre[]
  tM:     Record<number, string>
  onOpen: (o: Oeuvre) => void
}) {
  const visible = works.slice(0, STAGE_LIMIT)
  const overflow = works.length - visible.length

  return (
    <div style={{
      background: 'var(--bg1)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Column header */}
      <div style={{
        padding: '14px 12px 10px',
        borderBottom: '1px solid var(--bd)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 16, height: 1, background: 'var(--ac)', display: 'inline-block' }} />
          <span className="t-eyebrow" style={{ color: 'var(--ac)' }}>{label}</span>
        </div>
        <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{works.length}</span>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visible.map((o) => (
          <WorkCard key={o.OeuvreID} o={o} tM={tM} onOpen={onOpen} />
        ))}
        {overflow > 0 && (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', textAlign: 'center', padding: '6px 0' }}>
            +{overflow} more
          </div>
        )}
        {works.length === 0 && (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', padding: '12px 4px', textAlign: 'center' }}>—</div>
        )}
      </div>
    </div>
  )
}

// ── Work card ────────────────────────────────────────────────

function WorkCard({ o, tM, onOpen }: { o: Oeuvre; tM: Record<number, string>; onOpen: (o: Oeuvre) => void }) {
  const techLabel = o.Technique ? tM[o.Technique] : null
  const isCommission = (o as any).IsCommission
  const deadline = (o as any).DateLivraison ? String((o as any).DateLivraison).slice(0, 10) : null
  const deadlinePast = deadline ? new Date(deadline) < new Date() : false

  return (
    <div
      onClick={() => onOpen(o)}
      style={{
        cursor: 'pointer',
        border: `1px solid ${isCommission ? 'var(--ac)' : 'var(--bd)'}`,
        padding: 6,
        background: 'var(--bg2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg2)')}
    >
      {/* Thumbnail + text row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{
          width: 36, height: 36, flexShrink: 0,
          background: 'var(--bg0)', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {o.txtImageNameLink
            ? <img src={thumbUrl(o.txtImageNameLink, 128) ?? ''} loading="lazy" alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: 'var(--tx3)', fontSize: 14 }}>—</span>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: 'var(--tx3)', marginBottom: 1 }}>#{o.OeuvreID}</div>
          <div style={{ fontSize: 10, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
            {o.Titre ?? '—'}
          </div>
          {techLabel && <div style={{ fontSize: 9, color: 'var(--tx3)', marginTop: 1 }}>{techLabel}</div>}
        </div>
      </div>
      {/* Commission deadline badge */}
      {isCommission && (
        <div style={{
          fontSize: 9, letterSpacing: 0.5,
          color: deadlinePast ? 'var(--rust)' : deadline ? 'var(--ac)' : 'var(--tx3)',
          paddingLeft: 44, // align with text
        }}>
          {deadline
            ? `⏱ ${new Date(deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : '⚠ commission — pas de deadline'}
        </div>
      )}
    </div>
  )
}
