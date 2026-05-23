'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PivotPanel } from '@/components/atelier/PivotPanel'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import {
  buildContactThemePivotRows,
  contactThemePivotDims,
  edgeFactPivotDims,
  type EdgeFactRow,
} from '@/lib/graph/edge-fact'
import { fetchEdgeFactRows } from '@/app/atelier/reports/edge-fact-actions'

type AtlasPreset = 'graph' | 'contact_theme'

export function PivotAtlasPanel() {
  const { t } = useI18n()
  const tk = (key: string) => t(key as DictKey)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [facts, setFacts] = useState<EdgeFactRow[]>([])
  const [preset, setPreset] = useState<AtlasPreset>('contact_theme')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchEdgeFactRows()
    if ('error' in res) {
      setError(res.error)
      setFacts([])
    } else {
      setFacts(res.rows)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pivotLabels = useMemo(
    () => ({
      relationType: tk('atlas_dim_relation_type'),
      sourceType: tk('atlas_dim_source_type'),
      targetType: tk('atlas_dim_target_type'),
      sourceLabel: tk('atlas_dim_source_label'),
      targetLabel: tk('atlas_dim_target_label'),
      strength: tk('atlas_dim_strength'),
      count: tk('pivotCount'),
      contact: tk('atlas_dim_contact'),
      theme: tk('atlas_dim_theme'),
    }),
    [tk],
  )

  const contactThemeRows = useMemo(() => buildContactThemePivotRows(facts), [facts])

  const graphDims = useMemo(() => edgeFactPivotDims(pivotLabels), [pivotLabels])
  const contactDims = useMemo(() => contactThemePivotDims(pivotLabels), [pivotLabels])

  if (loading) {
    return (
      <div className="t-mono-sm" style={{ color: 'var(--tx3)', padding: 16 }} data-testid="pivot-atlas-loading">
        {tk('atlas_loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 16 }} data-testid="pivot-atlas-error">
        <p className="t-mono-sm" style={{ color: 'var(--rust)' }}>{tk('atlas_load_error')}</p>
        <p className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 8 }}>{error}</p>
      </div>
    )
  }

  return (
    <div data-testid="pivot-atlas-root" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="panel" style={{ padding: '12px 16px', flexShrink: 0 }}>
        <div className="serif" style={{ fontSize: 18, marginBottom: 4 }}>{tk('atlas_title')}</div>
        <div style={{ fontSize: 13, color: 'var(--tx3)', marginBottom: 10 }}>{tk('atlas_subtitle')}</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
            {tk('atlas_edge_count').replace('{n}', String(facts.length))}
          </span>
          <select
            className="input sm"
            value={preset}
            onChange={(e) => setPreset(e.target.value as AtlasPreset)}
            aria-label={tk('atlas_title')}
            style={{ minHeight: 40 }}
          >
            <option value="contact_theme">{tk('atlas_preset_contact_theme')}</option>
            <option value="graph">{tk('atlas_preset_graph')}</option>
          </select>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {preset === 'contact_theme' ? (
          <PivotPanel
            rows={contactThemeRows}
            availableDims={contactDims.dims}
            availableValues={contactDims.values}
            defaultRowDimId="contact"
            defaultColDimId="theme"
            defaultValueIds={['count']}
            title={tk('atlas_preset_contact_theme')}
            exportFileName="pivot-atlas-contacts-themes"
            initialToolbarCollapsed
          />
        ) : (
          <PivotPanel
            rows={facts}
            availableDims={graphDims.dims}
            availableValues={graphDims.values}
            defaultRowDimId="relation_type"
            defaultColDimId="source_type"
            defaultValueIds={['count']}
            title={tk('atlas_preset_graph')}
            exportFileName="pivot-atlas-graph"
            initialToolbarCollapsed
          />
        )}
      </div>
    </div>
  )
}
