'use client'

import type { DictKey } from '@/lib/i18n/dictionary'
import { SectionTitle } from './drawer-widgets'

type GroupRow = { id: string; name: string }

interface Props {
  t: (k: DictKey) => string
  initialGroups: GroupRow[]
  selGroups: Set<string>
  setSelGroups: React.Dispatch<React.SetStateAction<Set<string>>>
}

export function DrawerContentGroupsSection({ t, initialGroups, selGroups, setSelGroups }: Props) {
  return (
    <section>
      <SectionTitle title={t('wf_groups')} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        {initialGroups.map((g) => {
          const active = selGroups.has(g.id)
          return (
            <button
              key={g.id}
              type="button"
              onClick={() =>
                setSelGroups((p) => {
                  const s = new Set(p)
                  if (s.has(g.id)) s.delete(g.id)
                  else s.add(g.id)
                  return s
                })
              }
              style={{
                padding: '4px 10px',
                fontSize: 10,
                borderRadius: 12,
                border: `1px solid ${active ? 'var(--ac)' : 'var(--bd)'}`,
                background: active ? 'var(--ac)22' : 'var(--bg2)',
                color: active ? 'var(--ac)' : 'var(--tx3)',
                cursor: 'pointer',
              }}
            >
              {g.name}
            </button>
          )
        })}
      </div>
    </section>
  )
}
