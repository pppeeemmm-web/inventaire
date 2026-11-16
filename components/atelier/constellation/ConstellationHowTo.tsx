'use client'

import type { DictKey } from '@/lib/i18n/dictionary'
import { LINK_DEF, LINK_LABEL_KEYS, LINK_VIS, type LinkType } from './constellation-shared'

// TODO 20: a real how-to in the right panel — folded by default.

const LINK_MEANING: Record<LinkType, DictKey> = {
  influence: 'ct_howto_link_influence',
  proximity: 'ct_howto_link_proximity',
  series: 'ct_howto_link_series',
  diptych: 'ct_howto_link_diptych',
}

/** A short sample of the link as the canvas draws it (colour + dash). */
function LinkSwatch({ color, dash, w, arrow }: { color: string; dash: number[]; w: number; arrow?: boolean }) {
  return (
    <svg width="26" height="10" viewBox="0 0 26 10" aria-hidden style={{ flexShrink: 0, marginTop: 3 }}>
      <line x1="1" y1="5" x2={arrow ? 19 : 25} y2="5" stroke={color} strokeWidth={w} strokeDasharray={dash.join(' ') || undefined} />
      {arrow && <polygon points="25,5 18,1.5 18,8.5" fill={color} />}
    </svg>
  )
}

export function ConstellationHowTo({ t }: { t: (key: DictKey) => string }) {
  const section = (titleKey: DictKey, keys: DictKey[]) => (
    <>
      <div className="t-label" style={{ fontSize: 8, color: 'var(--tx3)', margin: '10px 0 4px' }}>{t(titleKey)}</div>
      <ul style={{ margin: 0, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {keys.map(k => <li key={k}>{t(k)}</li>)}
      </ul>
    </>
  )
  return (
    <details className="pem-fold" data-testid="constellation-howto" style={{ marginTop: 20 }}>
      <summary className="t-eyebrow" style={{ cursor: 'pointer' }}>{t('ct_howto_title')}</summary>
      <div className="t-mono-sm" style={{ color: 'var(--tx2)', lineHeight: 1.5, fontSize: 9 }}>
        {section('ct_howto_works', ['ct_howto_open', 'ct_howto_click', 'ct_howto_drag', 'ct_howto_marquee', 'ct_howto_right'])}
        {section('ct_howto_view', ['ct_howto_pan'])}
        <div className="t-label" style={{ fontSize: 8, color: 'var(--tx3)', margin: '10px 0 4px' }}>{t('ct_howto_links')}</div>
        <div style={{ marginBottom: 6 }}>{t('ct_howto_link_make')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(Object.keys(LINK_MEANING) as LinkType[]).map(lt => (
            <div key={lt} style={{ display: 'flex', gap: 6 }}>
              <LinkSwatch {...LINK_VIS[lt]} />
              <span><strong style={{ color: LINK_VIS[lt].color }}>{t(LINK_LABEL_KEYS[lt])}</strong> — {t(LINK_MEANING[lt])}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <LinkSwatch {...LINK_DEF} arrow />
            <span><strong>{t('ct_howto_link_directed_label')}</strong> — {t('ct_howto_link_directed')}</span>
          </div>
        </div>
        {section('ct_howto_draw', ['ct_howto_tools', 'ct_howto_erase', 'ct_howto_undo'])}
      </div>
    </details>
  )
}
