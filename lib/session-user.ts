import { createClient } from '@/lib/supabase/server'

type ContactNameRow = {
  NomInstitution: string | null
  Nom: string | null
  Prénom: string | null
  Email: string | null
}

function contactDisplayName(c: ContactNameRow): string | null {
  const fromInst = c.NomInstitution?.trim()
  if (fromInst) return fromInst
  const fromPerson = `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim()
  if (fromPerson) return fromPerson
  const email = c.Email?.trim()
  return email || null
}

/** Display label for the current auth session (Contact row, else auth email). */
export async function getSessionUserDisplay(): Promise<{ displayName: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { displayName: '' }

  const { data: contact } = await supabase
    .from('Contact')
    .select('NomInstitution, Nom, "Prénom", Email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (contact) {
    const name = contactDisplayName(contact as ContactNameRow)
    if (name) return { displayName: name }
  }

  const email = user.email?.trim()
  if (email) {
    const local = email.split('@')[0]
    return { displayName: local || email }
  }

  return { displayName: '—' }
}
