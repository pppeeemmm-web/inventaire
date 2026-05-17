import type React from 'react'

export function moveBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 22, height: 22, padding: 0,
    background: disabled ? 'transparent' : 'var(--bg0)',
    border: '1px solid var(--bd)', borderRadius: 3,
    color: disabled ? 'var(--bd)' : 'var(--tx2)',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 11, lineHeight: 1, fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }
}
