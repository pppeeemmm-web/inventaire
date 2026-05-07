'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ── Google Contacts CSV Import ────────────────────────────────────────────────

export interface ImportedContact {
  prenom:      string | null
  nom:         string | null
  institution: string | null
  role:        string | null
  notes:       string | null
  emails:    { email: string; label: string }[]
  phones:    { country_code: string | null; phone: string; label: string }[]
  addresses: { label: string; adresse: string | null; code_postal: string | null; ville: string | null; pays: string | null }[]
  websites:  { url: string; label: string }[]
}

export type ImportResult = { ok: true; imported: number; skipped: number } | { error: string }

export async function importGoogleContacts(contacts: ImportedContact[]): Promise<ImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Use service client for writes — RLS INSERT policy only allows is_private=false for team,
  // but imported contacts should be private. Service client bypasses RLS.
  const svc = createServiceClient()

  if (!contacts.length) return { ok: true, imported: 0, skipped: 0 }

  // Collect all emails from the batch to check for duplicates (via service client to see all)
  const allEmails = contacts
    .flatMap(c => c.emails.map(e => e.email.toLowerCase()))
    .filter(Boolean)

  const existingEmails = new Set<string>()

  if (allEmails.length > 0) {
    const { data: existingMain } = await svc
      .from('Contact')
      .select('Email')
      .in('Email', allEmails)
    const { data: existingTable } = await svc
      .from('contact_emails')
      .select('email')
      .in('email', allEmails)
    existingMain?.forEach(r => r.Email && existingEmails.add(r.Email.toLowerCase()))
    existingTable?.forEach(r => r.email && existingEmails.add(r.email.toLowerCase()))
  }

  let imported = 0
  let skipped  = 0

  for (const c of contacts) {
    // Skip if any email already exists
    const isDupe = c.emails.some(e => existingEmails.has(e.email.toLowerCase()))
    // Also skip if no name and no institution
    const hasIdentity = c.prenom || c.nom || c.institution
    if (isDupe || !hasIdentity) { skipped++; continue }

    const primaryEmail = c.emails[0]?.email ?? null
    const primaryPhone = c.phones[0] ?? null

    const { data: inserted, error: insertErr } = await svc
      .from('Contact')
      .insert({
        Prénom:          c.prenom,
        Nom:             c.nom,
        NomInstitution:  c.institution,
        Role:            c.role,
        Email:           primaryEmail,
        Téléphone1:      (primaryPhone?.phone ?? null)?.slice(0, 20) ?? null,
        IndicatifPays1:  (primaryPhone?.country_code ?? null)?.slice(0, 10) ?? null,
        Notes:           c.notes,
        is_private:      true,
        Actif:           true,
      })
      .select('ContactID')
      .single()

    if (insertErr || !inserted) {
      console.error('Contact insert failed:', insertErr?.message, JSON.stringify({ prenom: c.prenom, nom: c.nom }))
      skipped++; continue
    }

    const cid = inserted.ContactID

    // Emails
    if (c.emails.length > 0) {
      await svc.from('contact_emails').insert(
        c.emails.map((e, i) => ({
          contact_id: cid,
          email:      e.email,
          label:      e.label || 'Personnel',
          is_primary: i === 0,
        }))
      )
      c.emails.forEach(e => existingEmails.add(e.email.toLowerCase()))
    }

    // Phones
    if (c.phones.length > 0) {
      await svc.from('contact_phones').insert(
        c.phones.map((p, i) => ({
          contact_id:   cid,
          phone:        p.phone,
          country_code: p.country_code,
          label:        p.label || 'Mobile',
          is_primary:   i === 0,
        }))
      )
    }

    // Addresses
    if (c.addresses.length > 0) {
      await svc.from('contact_addresses').insert(
        c.addresses.map((a, i) => ({
          contact_id:  cid,
          label:       a.label || 'Principal',
          adresse:     a.adresse,
          code_postal: a.code_postal,
          ville:       a.ville,
          pays:        a.pays,
          position:    i,
        }))
      )
    }

    // Websites
    if (c.websites.length > 0) {
      await svc.from('contact_websites').insert(
        c.websites.map(w => ({
          contact_id: cid,
          url:        w.url,
          label:      w.label || 'Web',
        }))
      )
    }

    imported++
  }

  revalidatePath('/atelier')
  return { ok: true, imported, skipped }
}

export type ContactDeleteResult = { error: string } | { ok: true }

/**
 * Delete one or more contacts and their associated addresses.
 * Note: Does NOT delete works associated with the contact (sets ContactID to null in Oeuvres).
 */
export async function deleteContacts(ids: number[]): Promise<ContactDeleteResult> {
  const supabase = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }

  if (!ids.length) return { ok: true }

  // 1. Delete addresses first
  const { error: addrErr } = await supabase
    .from('contact_addresses')
    .delete()
    .in('contact_id', ids)
  
  if (addrErr) return { error: addrErr.message }

  // 2. Delete contacts
  const { error: contactErr } = await supabase
    .from('Contact')
    .delete()
    .in('ContactID', ids)

  if (contactErr) return { error: contactErr.message }

  revalidatePath('/atelier')
  return { ok: true }
}

export async function saveContactWithConflictCheck(formData: FormData): Promise<{ ok: true; id: number } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // 1. Parse Fields
  const nom        = (formData.get('nom') as string | null)?.trim()
  const prenom     = (formData.get('prenom') as string | null)?.trim()
  const email      = (formData.get('email') as string | null)?.trim()
  const inst       = (formData.get('institution') as string | null)?.trim()
  const is_private = formData.get('is_private') === 'true'

  // 2. SECRET CHECK (Bypass RLS to find collisions)
  const serviceClient = createServiceClient()
  let conflictWithId: number | null = null

  if (nom || prenom || email) {
    let query = serviceClient.from('Contact').select('ContactID, is_private')
    
    if (email) {
      query = query.eq('Email', email)
    } else {
      query = query.ilike('Nom', nom || '').ilike('Prénom', prenom || '')
    }

    const { data: matches } = await query
    
    // We found a match that the current user might not see
    const privateMatch = matches?.find(m => m.is_private)
    if (privateMatch) {
      conflictWithId = privateMatch.ContactID
    }
  }

  // 3. Create the Contact (Public/Private as requested)
  const { data: contact, error: insertErr } = await supabase.from('Contact').insert({
    Nom: nom,
    Prénom: prenom,
    Email: email,
    NomInstitution: inst,
    is_private: is_private
  }).select('ContactID').single()

  if (insertErr || !contact) return { error: insertErr?.message ?? 'Insert failed' }

  // 4. Record Conflict if detected
  if (conflictWithId && !is_private) {
    await serviceClient.from('contact_conflicts').insert({
      public_contact_id: contact.ContactID,
      private_contact_id: conflictWithId
    })
  }

  revalidatePath('/atelier')
  return { ok: true, id: contact.ContactID }
}

export async function fetchContactConflicts() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Check if user is admin
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return []

  const { data } = await supabase
    .from('contact_conflicts')
    .select('*, public:public_contact_id(ContactID, Nom, Prénom, NomInstitution), private:private_contact_id(ContactID, Nom, Prénom, NomInstitution)')
    .eq('resolved', false)

  return data ?? []
}
