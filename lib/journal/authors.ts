/**
 * Who made a change to a work (`oeuvre_versions.changed_by / approved_by / changed_via`, rule in
 * `supabase/sql/oeuvre_version_author.sql`). Pure: the server builds these, the badge only draws them.
 * Design: docs/design/2026-11-23/WorkChangeBadges.md §4.
 */
import { contactAcronym } from '@/lib/session-user'

export type ChangeVia = 'approval' | 'session' | 'stamp' | 'machine' | 'unknown'

/** `tone`: 'accent' (admin), 'grey' (a login with no name, e.g. the test profile), or a hue index 0–5. */
export type ChangeAuthor =
  | { kind: 'person'; key: string; initials: string; name: string; tone: 'accent' | 'grey' | number; approvedBy: string | null }
  | { kind: 'machine'; key: 'machine' }
  | { kind: 'unknown'; key: 'unknown' }

export type AuthorContactRow = {
  ContactID: number
  auth_user_id: string | null
  Prénom: string | null
  Nom: string | null
  NomInstitution?: string | null
  Email: string | null
  is_admin?: boolean | null
}

export type AuthorRow = { changed_by: string | null; approved_by?: string | null; changed_via?: string | null }

function personOf(c: AuthorContactRow | undefined, uid: string): Omit<Extract<ChangeAuthor, { kind: 'person' }>, 'approvedBy'> {
  if (!c) return { kind: 'person', key: uid, initials: '?', name: '—', tone: 'grey' }
  const named = !!(c.Prénom?.trim() || c.Nom?.trim())
  const local = c.Email?.split('@')[0]?.trim() ?? ''
  const initials = named ? contactAcronym({ Prénom: c.Prénom, Nom: c.Nom, NomInstitution: null, Email: null }) : (local.slice(0, 3).toUpperCase() || '?')
  const name = named ? [c.Prénom, c.Nom].filter(Boolean).join(' ').trim() : c.Email?.trim() || '—'
  const tone = c.is_admin ? 'accent' : named ? c.ContactID % 6 : 'grey'
  return { kind: 'person', key: uid, initials, name, tone }
}

/** Contacts by login id → the author of one version row, or null for an old row nobody recorded. */
export function authorOfRow(row: AuthorRow, contacts: Map<string, AuthorContactRow>): ChangeAuthor | null {
  if (row.changed_by) {
    const ok = row.changed_via === 'approval' && row.approved_by ? personOf(contacts.get(row.approved_by), row.approved_by).name : null
    return { ...personOf(contacts.get(row.changed_by), row.changed_by), approvedBy: ok }
  }
  if (row.changed_via === 'machine') return { kind: 'machine', key: 'machine' }
  if (row.changed_via === 'unknown') return { kind: 'unknown', key: 'unknown' }
  return null
}

/** Adds an author to a line's list once, first change first; a later approval of the same person keeps its ✓. */
export function addAuthor(list: ChangeAuthor[], a: ChangeAuthor | null): void {
  if (!a) return
  const prev = list.find((x) => x.key === a.key)
  if (!prev) list.push(a)
  else if (prev.kind === 'person' && a.kind === 'person' && !prev.approvedBy && a.approvedBy) prev.approvedBy = a.approvedBy
}

/** Login ids a set of version rows names (author and approver). */
export function authorIdsOf(rows: AuthorRow[]): string[] {
  return [...new Set(rows.flatMap((r) => [r.changed_by, r.approved_by ?? null]).filter((x): x is string => !!x))]
}
