'use client'

// One picker for `#` (a work or an idea) and `@` (a person), wherever text is typed (principle 13).
//
//   const picker = useLinkPicker(text, setText)
//   <textarea onChange={(e) => { setText(e.target.value); picker.onChange(e) }}
//             onKeyDown={(e) => { if (picker.onKeyDown(e)) return; … }}
//             onClick={picker.onChange} onKeyUp={picker.onCaret} />
//   {picker.popover}{picker.chips}
//   save → send `picker.links`, then `picker.clear()`.
//
// Choosing a row replaces the typed word with `#Titre` / `@Nom` and keeps the target in `links`; the door writes the
// real link row. `+ Personne « … »` creates the contact through the contact door (as the sale buyer picker does).

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react'
import { searchLinkTargets, type LinkTarget } from '@/app/atelier/(portal)/journal/link-targets'
import { saveContact } from '@/app/atelier/(portal)/contacts/save-contact'
import { saveContactRefusalText } from '@/lib/contacts/save-contact-message'
import { confirmIfSimilarContact } from '@/lib/contacts/similar-contact-warning'
import { contactListLabel } from '@/lib/contacts/contact-display'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'

export type { LinkTarget }

type Field = HTMLTextAreaElement | HTMLInputElement
type Token = { trigger: '#' | '@'; word: string; start: number; end: number }

/** The `#…` / `@…` word that ends at the caret (no spaces inside), else null. */
function tokenAt(value: string, caret: number): Token | null {
  let start = caret
  while (start > 0 && !/\s/.test(value[start - 1])) start -= 1
  const word = value.slice(start, caret)
  const m = /^([#@])([^\s#@]*)$/.exec(word)
  if (!m) return null
  return { trigger: m[1] as '#' | '@', word: m[2], start, end: caret }
}

function sameTarget(a: LinkTarget, b: LinkTarget): boolean {
  return a.kind === b.kind && String(a.id) === String(b.id)
}

export function useLinkPicker(value: string, setValue: (v: string) => void) {
  const { t } = useI18n()
  const [links, setLinks] = useState<LinkTarget[]>([])
  const [token, setToken] = useState<Token | null>(null)
  const [results, setResults] = useState<LinkTarget[]>([])
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const field = useRef<Field | null>(null)
  const seq = useRef(0)

  // Debounced search for the word under the caret.
  useEffect(() => {
    if (!token) {
      setResults([])
      return
    }
    const mine = ++seq.current
    const kind = token.trigger === '#' ? 'hash' : 'at'
    const id = window.setTimeout(() => {
      void searchLinkTargets(kind, token.word).then((r) => {
        if (mine !== seq.current) return
        setResults(r)
        setActive(0)
      })
    }, 200)
    return () => window.clearTimeout(id)
  }, [token])

  const detect = useCallback((el: Field) => {
    field.current = el
    const caret = el.selectionStart ?? el.value.length
    const tk = tokenAt(el.value, caret)
    setToken((cur) => (cur && tk && cur.word === tk.word && cur.start === tk.start && cur.trigger === tk.trigger ? cur : tk))
  }, [])

  const close = useCallback(() => {
    seq.current += 1
    setToken(null)
    setResults([])
  }, [])

  const choose = useCallback(
    (target: LinkTarget) => {
      const tk = token
      const el = field.current
      if (!tk) return
      const text =
        target.kind === 'contact'
          ? `@${target.label}`
          : target.label && target.label !== `#${target.id}` ? `#${target.label}` : `#${target.id}`
      const next = `${value.slice(0, tk.start)}${text} ${value.slice(tk.end)}`
      setValue(next)
      setLinks((cur) => (cur.some((l) => sameTarget(l, target)) ? cur : [...cur, target]))
      close()
      const pos = tk.start + text.length + 1
      window.requestAnimationFrame(() => {
        if (!el) return
        el.focus({ preventScroll: true })
        el.setSelectionRange(pos, pos)
      })
    },
    [token, value, setValue, close],
  )

  async function createPerson(typed: string) {
    const words = typed.trim().split(/\s+/).filter(Boolean)
    if (!words.length || busy) return
    const prenom = words.length > 1 ? words[0] : null
    const nom = words.length > 1 ? words.slice(1).join(' ') : words[0]
    setBusy(true)
    try {
      const go = await confirmIfSimilarContact({ nom, prenom, institution: null, email: null }, t)
      if (!go) return
      const res = await saveContact({ id: null, fields: { Prénom: prenom, Nom: nom, NomInstitution: null }, lists: { emails: [], phones: [] } })
      const refusal = saveContactRefusalText(res, t)
      if (refusal || !('card' in res) || !res.card) {
        toast.error(refusal ?? t('lp_person_failed'))
        return
      }
      const c = res.card.contact
      choose({ kind: 'contact', id: c.ContactID, label: contactListLabel({ Prénom: c.Prénom, Nom: c.Nom, NomInstitution: c.NomInstitution }) })
    } finally {
      setBusy(false)
    }
  }

  // « + Personne » is offered for `@` unless a result already carries exactly what was typed.
  const typed = token?.word.trim() ?? ''
  const canCreate =
    token?.trigger === '@' && typed.length > 0 && !results.some((r) => r.label.trim().toLowerCase() === typed.toLowerCase())
  const rowCount = results.length + (canCreate ? 1 : 0)

  function pickRow(i: number) {
    if (i < results.length) choose(results[i])
    else if (canCreate) void createPerson(typed)
  }

  /** Returns true when the key was used by the picker (the caller then skips its own handling, e.g. Enter = send). */
  function onKeyDown(e: KeyboardEvent<Field>): boolean {
    if (!token || rowCount === 0) return false
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % rowCount)
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + rowCount) % rowCount)
      return true
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      pickRow(Math.min(active, rowCount - 1))
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
      return true
    }
    return false
  }

  const kindLabel = (k: LinkTarget['kind']) => t(k === 'oeuvre' ? 'lp_kind_oeuvre' : k === 'concept' ? 'lp_kind_concept' : 'lp_kind_contact')

  const popover: ReactNode =
    token && rowCount > 0 ? (
      <div
        role="listbox"
        aria-label={t('lp_list')}
        data-testid="link-picker"
        style={{ width: '100%', boxSizing: 'border-box', maxHeight: 8 * 44, overflowY: 'auto', border: '1px solid var(--bd2, var(--bd))', background: 'var(--bg0)' }}
      >
        {results.map((r, i) => (
          <button
            key={`${r.kind}-${r.id}`}
            type="button"
            role="option"
            aria-selected={i === active}
            data-testid="link-picker-row"
            // Keep the caret in the field: a tap must not blur it before the choice lands.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pickRow(i)}
            style={rowStyle(i === active)}
          >
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
            <span style={{ flex: 'none', fontSize: 12, color: 'var(--tx3)' }}>{r.kind === 'oeuvre' ? `#${r.id} · ` : ''}{kindLabel(r.kind)}</span>
          </button>
        ))}
        {canCreate ? (
          <button
            type="button"
            role="option"
            aria-selected={active === results.length}
            data-testid="link-picker-new-person"
            disabled={busy}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pickRow(results.length)}
            style={{ ...rowStyle(active === results.length), color: 'var(--ac)', fontWeight: 600 }}
          >
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('lp_new_person').replace('{name}', typed)}</span>
          </button>
        ) : null}
      </div>
    ) : null

  const chips: ReactNode = links.length ? (
    <div role="list" aria-label={t('lp_chips')} data-testid="link-picker-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
      {links.map((l) => {
        const label = `${l.kind === 'contact' ? '@' : '#'}${l.label}`
        return (
          <span
            role="listitem"
            key={`${l.kind}-${l.id}`}
            style={{ display: 'inline-flex', alignItems: 'center', maxWidth: '100%', minHeight: 36, border: '1px solid var(--bd2, var(--bd))', borderRadius: 18, paddingLeft: 12, fontSize: 13, color: 'var(--tx2)' }}
          >
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            <button
              type="button"
              aria-label={t('lp_remove').replace('{label}', label)}
              onClick={() => setLinks((cur) => cur.filter((x) => !sameTarget(x, l)))}
              style={{ flex: 'none', minWidth: 44, minHeight: 44, margin: '-4px 0', background: 'none', border: 'none', color: 'var(--tx3)', fontSize: 16, cursor: 'pointer' }}
            >
              ×
            </button>
          </span>
        )
      })}
    </div>
  ) : null

  return {
    links,
    setLinks,
    clear: () => {
      setLinks([])
      close()
    },
    popover,
    chips,
    onKeyDown,
    /** Call from the field's onChange (and onClick): looks at the word under the caret. */
    onChange: (e: ChangeEvent<Field> | SyntheticEvent<Field>) => detect(e.currentTarget),
    /** Call from onKeyUp (arrows move the caret). */
    onCaret: (e: KeyboardEvent<Field>) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') return
      detect(e.currentTarget)
    },
  }
}

function rowStyle(on: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    minHeight: 44,
    padding: '6px 10px',
    background: on ? 'color-mix(in srgb, var(--ac) 10%, var(--bg0))' : 'none',
    border: 'none',
    borderBottom: '1px solid var(--bd)',
    color: 'var(--tx)',
    textAlign: 'left',
    font: 'inherit',
    fontSize: 15,
    cursor: 'pointer',
    boxSizing: 'border-box',
  }
}
