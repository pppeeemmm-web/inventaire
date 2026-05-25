import { createClient } from '@/lib/supabase/server'

export type ContactNameRow = {
  NomInstitution: string | null
  Nom: string | null
  Prénom: string | null
  Email: string | null
}

export function contactDisplayName(c: ContactNameRow): string | null {
  const fromInst = c.NomInstitution?.trim()
  if (fromInst) return fromInst
  const fromPerson = `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim()
  if (fromPerson) return fromPerson
  const email = c.Email?.trim()
  return email || null
}

/** Short initials for the session pill (team members). */
export function contactAcronym(c: ContactNameRow): string {
  const prenom = c.Prénom?.trim()
  const nom = c.Nom?.trim()
  if (prenom && nom) {
    return `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase()
  }
  if (prenom) return prenom.slice(0, 2).toUpperCase()
  if (nom) return nom.slice(0, 2).toUpperCase()

  const inst = c.NomInstitution?.trim()
  if (inst) {
    const words = inst.split(/\s+/).filter((w) => w.length > 0)
    if (words.length >= 2) {
      return words
        .slice(0, 3)
        .map((w) => w[0] ?? '')
        .join('')
        .toUpperCase()
    }
    return inst.slice(0, 3).toUpperCase()
  }

  const email = c.Email?.trim()
  if (email) {
    const local = email.split('@')[0] ?? ''
    return (local.slice(0, 2) || '?').toUpperCase()
  }

  return '?'
}

function acronymFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  return (local.slice(0, 2) || '?').toUpperCase()
}

/** Display label for the current auth session (Contact row, else auth email). */
export async function getSessionUserDisplay(): Promise<{
  /** Visible pill text (acronym for team). */
  displayName: string
  /** Full name for tooltip / screen readers. */
  fullName: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { displayName: '', fullName: '' }

  const { data: isTeam } = await supabase.rpc('is_team')

  const { data: contact } = await supabase
    .from('Contact')
    .select('NomInstitution, Nom, "Prénom", Email, is_team_member')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const useAcronym = Boolean(isTeam) || Boolean(contact?.is_team_member)

  if (contact) {
    const row = contact as ContactNameRow
    const full = contactDisplayName(row)
    if (full) {
      return {
        displayName: useAcronym ? contactAcronym(row) : full,
        fullName: full,
      }
    }
  }

  const email = user.email?.trim()
  if (email) {
    const local = email.split('@')[0]
    const full = local || email
    return {
      displayName: useAcronym ? acronymFromEmail(email) : full,
      fullName: full,
    }
  }

  return { displayName: '—', fullName: '—' }
}
