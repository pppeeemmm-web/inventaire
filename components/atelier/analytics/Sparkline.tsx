'use client'

import { useI18n } from '@/lib/i18n/context'

function trendDayMonth(iso: string) {
  const parts = iso.split('-')
  if (parts.length < 3) return iso
  const [, m, d] = parts
  return `${d}/${m}`
}

export function Sparkline({ trend }: { trend: { date: string; views: number }[] }) {
  const { t, lang } = useI18n()
  const numLocale = lang === 'en' ? 'en-GB' : 'fr-FR'
  if (trend.length === 0) return null
  const max = Math.max(...trend.map(d => d.views), 1)
  const padL = 44
  const padR = 44
  const padT = 22
  const dateBand = 20
  const chartH = 52
  const vbW = 400
  const vbH = padT + chartH + dateBand
  const innerW = vbW - padL - padR
  const denom = Math.max(trend.length - 1, 1)

  const xAt = (i: number) => padL + (i / denom) * innerW
  const yAt = (views: number) =>
    padT + chartH - (views / max) * (chartH - 12) - 4

  const pts = trend.map((d, i) => `${xAt(i)},${yAt(d.views)}`).join(' ')

  const labelCount = Math.min(9, trend.length)
  const labelIdx = new Set<number>()
  if (labelCount === 1) {
    labelIdx.add(0)
  } else {
    for (let k = 0; k < labelCount; k++) {
      const j = Math.round((k * (trend.length - 1)) / (labelCount - 1))
      labelIdx.add(j)
    }
  }

  const dateY = padT + chartH + 13

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', minHeight: 112, display: 'block', overflow: 'visible' }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke="var(--ac)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {trend.map((d, i) => {
        const x = xAt(i)
        const y = yAt(d.views)
        return (
          <g key={d.date + i}>
            <title>{t('analytics_sparkline_point_title_fmt')
              .replace('{date}', d.date)
              .replace('{views}', d.views.toLocaleString(numLocale))}</title>
            <circle
              cx={x}
              cy={y}
              r={labelIdx.has(i) ? 3.2 : 2}
              fill="var(--ac)"
              stroke="var(--bg0)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}
      {trend.map((d, i) => {
        if (!labelIdx.has(i)) return null
        const x = xAt(i)
        const y = yAt(d.views)
        const n = d.views.toLocaleString(numLocale)
        const dm = trendDayMonth(d.date)
        const valY = Math.max(y - 10, 12)
        return (
          <g key={`t-${d.date}-${i}`}>
            <text
              x={x}
              y={valY}
              textAnchor="middle"
              fill="var(--tx)"
              fontSize="11"
              fontFamily="var(--font-ui)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {n}
            </text>
            <text
              x={x}
              y={dateY}
              textAnchor="middle"
              fill="var(--tx3)"
              fontSize="9"
              fontFamily="var(--font-ui)"
            >
              {dm}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
