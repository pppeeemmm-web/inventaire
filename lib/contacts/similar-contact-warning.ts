import { findSimilarContacts } from '@/app/atelier/(portal)/contacts/actions'
import type { DictKey } from '@/lib/i18n/dictionary'

/**
 * Before creating a contact (quick add, « + Nouveau contact », the editor's create): asks the server for cards with
 * the same email or the same name and, when there are some, lets the person choose. A warning, never a refusal:
 * true = go on and create. A failed check does not stop the creation (it only warns).
 */
export async function confirmIfSimilarContact(
  input: { nom?: string | null; prenom?: string | null; institution?: string | null; email?: string | null },
  t: (key: DictKey) => string,
): Promise<boolean> {
  const res = await findSimilarContacts(input)
  if ('error' in res || res.matches.length === 0) return true
  const list = res.matches
    .map((m) => `• ${m.label} (${t(m.by === 'email' ? 'contact_similar_by_email' : 'contact_similar_by_name')})`)
    .join('\n')
  return window.confirm(t('contact_similar_warn_fmt').replace('{list}', list))
}
