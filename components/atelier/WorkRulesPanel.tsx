'use client'

// Audit « Règles » (WORK_RULES batch 2): runs the rule checks on demand, read only, admin only.
// One block per rule, collapsed when it holds; breaks listed as WorkChips (thumbnail + title).

import { useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { interpolateMessage } from '@/lib/i18n/message-core'
import { WorkChip } from '@/components/atelier/WorkChip'
import { runWorkRuleChecks, type RuleChecksResult } from '@/app/atelier/(portal)/audit/rules-actions'
import { CHECKED_RULES, type CheckedRule, type RuleBreak } from '@/lib/work-rules-checks'

type Key = Parameters<ReturnType<typeof useI18n>['t']>[0]

export function WorkRulesPanel() {
  const { t, lang } = useI18n()
  const [res, setRes] = useState<RuleChecksResult | null>(null)
  const [running, start] = useTransition()
  const fmt = (key: Key, vars: Record<string, string | number>) => interpolateMessage(t(key), vars)

  const run = () => start(async () => setRes(await runWorkRuleChecks()))

  const byRule = new Map<CheckedRule, RuleBreak[]>()
  if (res && 'ok' in res) for (const b of res.breaks) byRule.set(b.rule, [...(byRule.get(b.rule) ?? []), b])

  return (
    <div data-testid="audit-rules" style={{ padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900 }}>
      <p style={{ fontSize: 12, color: 'var(--tx2)', margin: 0 }}>{t('wr_intro')}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn sm" onClick={run} disabled={running} data-testid="audit-rules-run" style={{ minHeight: 32 }}>
          {running ? t('wr_running') : t('wr_run')}
        </button>
        {res && 'ok' in res ? (
          <span style={{ fontSize: 12, color: res.breaks.length ? 'var(--rust)' : 'var(--green)' }} data-testid="audit-rules-summary">
            {res.breaks.length
              ? fmt('wr_summary_breaks', { n: res.works, b: res.breaks.length })
              : fmt('wr_summary_ok', { n: res.works })}{' '}
            <span style={{ color: 'var(--tx3)' }}>
              {fmt('wr_ran_at', { t: new Date(res.ranAt).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-GB') })}
            </span>
          </span>
        ) : null}
        {res && 'error' in res ? <span style={{ fontSize: 12, color: 'var(--rust)' }}>{res.error}</span> : null}
      </div>

      {res && 'ok' in res ? (
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--bd)', borderRadius: 4 }}>
          {CHECKED_RULES.map((rule, i) => {
            const list = byRule.get(rule) ?? []
            return (
              <details
                key={rule}
                open={list.length > 0 && list.length <= 20}
                data-testid={`audit-rule-${rule}`}
                style={{ borderTop: i ? '1px solid var(--bd)' : undefined, padding: '8px 12px' }}
              >
                <summary style={{ cursor: list.length ? 'pointer' : 'default', display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 12, minHeight: 28 }}>
                  <span style={{ color: 'var(--tx3)', width: 64, flex: 'none' }}>{fmt('wr_rule_n', { n: rule })}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{t(`wr_r${rule}` as Key)}</span>
                  <span style={{ flex: 'none', fontWeight: 600, color: list.length ? 'var(--rust)' : 'var(--green)' }}>
                    {list.length ? list.length : t('wr_ok')}
                  </span>
                </summary>
                {list.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0 4px 74px' }}>
                    {list.map((b, j) => (
                      <WorkChip
                        key={`${b.oeuvreId}-${b.code}-${j}`}
                        id={b.oeuvreId}
                        sub={b.arg ? fmt(b.code as Key, { x: b.arg }) : t(b.code as Key)}
                      />
                    ))}
                  </div>
                ) : null}
              </details>
            )
          })}
        </div>
      ) : null}
      <p style={{ fontSize: 11, color: 'var(--tx3)', margin: 0 }}>{t('wr_unchecked')}</p>
    </div>
  )
}
