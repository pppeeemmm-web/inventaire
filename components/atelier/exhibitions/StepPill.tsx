'use client'

import { useState } from 'react'
import type { Step } from './exhibitions-types'
import { STEP_COLORS, inputSt, fmtDate } from './exhibitions-types'

export function StepPill({ step, onToggle, onRename, onDelete }: {
  step:       Step
  onToggle?:  (id: string, next: string) => void
  onRename?:  (id: string, name: string) => void
  onDelete?:  (id: string) => void
}) {
  const color    = STEP_COLORS[step.statut] ?? 'var(--bd)'
  const isDone   = step.statut === 'fait'
  const isActive = step.statut === 'en_cours'
  const [editing, setEditing] = useState(false)
  const [temp,    setTemp]    = useState(step.nom)

  function handleToggle() {
    if (!onToggle) return
    const sequence = ['a_faire', 'en_cours', 'fait']
    const idx  = sequence.indexOf(step.statut)
    const next = sequence[(idx + 1) % sequence.length]
    onToggle(step.id, next)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
      borderBottom: '1px solid var(--bg2)',
    }}>
      <div
        onClick={handleToggle}
        style={{
          width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
          background: isDone ? color : 'transparent',
          border: `2px solid ${color}`,
          cursor: onToggle ? 'pointer' : 'default',
          transition: 'all 0.2s',
        }}
      />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        {editing ? (
          <input
            autoFocus
            value={temp}
            onChange={e => setTemp(e.target.value)}
            onBlur={() => {
              setEditing(false)
              if (temp.trim() && temp !== step.nom) onRename?.(step.id, temp.trim())
            }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            style={{ ...inputSt, padding: '4px 8px', fontSize: 12, height: 24 }}
          />
        ) : (
          <span
            onDoubleClick={() => setEditing(true)}
            style={{
              fontSize: 13,
              color: isDone ? 'var(--tx3)' : 'var(--tx)',
              textDecoration: isDone ? 'line-through' : 'none',
              cursor: 'text',
            }}
          >{step.nom}</span>
        )}
        {step.date_echeance && !editing && (
          <span style={{ fontSize: 11, color: isActive ? 'var(--ac)' : 'var(--tx3)', marginLeft: 10 }}>
            {fmtDate(step.date_echeance)}
          </span>
        )}
      </div>
      {isActive && !editing && (
        <span style={{ fontSize: 11, color: 'var(--ac)', letterSpacing: 0.5 }}>EN COURS</span>
      )}
      {onDelete && (
        <button
          onClick={() => onDelete(step.id)}
          style={{ border: 'none', background: 'transparent', color: 'var(--tx3)', fontSize: 14, cursor: 'pointer', padding: '0 4px', opacity: 0.5 }}
        >×</button>
      )}
    </div>
  )
}
