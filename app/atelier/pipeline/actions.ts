'use server'

import { createClient } from '@/lib/supabase/server'

// ── Types ─────────────────────────────────────────────────────────────────────

type ProcessType =
  | 'prix' | 'residence' | 'expedition' | 'consignment' | 'exposition'
  | 'pr' | 'visite_atelier' | 'salon' | 'livre' | 'collaboration'
  | 'evenement' | 'correspondance' | 'autre'

const DEFAULT_ETAPES: Record<string, string[]> = {
  collaboration:   ['Premier contact', 'Proposition', 'Accord', 'Production', 'Livraison'],
  consignment:     ['Proposition', 'Contrat', 'Livraison', 'En vente', 'Retour / Vente'],
  correspondance:  ['Brouillon', 'Envoyé', 'Réponse reçue'],
  evenement:       ['Concept', 'Planning', 'Communication', 'Jour J', 'Suivi'],
  expedition:      ['Préparation', 'Emballage', 'En transit', 'Livré', 'Confirmé'],
  exposition:      ['Concept', 'Sélection', 'Production', 'Installation', 'Vernissage', 'Décrochage'],
  livre:           ['Concept', 'Éditorial', 'Textes & Images', 'Mise en page', 'Impression', 'Distribution'],
  pr:              ['Stratégie', 'Contact', 'En cours', 'Publié'],
  prix:            ['Dossier', 'Soumission', 'Présélection', 'Résultat'],
  residence:       ['Dossier', 'Soumission', 'Entretien', 'Résultat'],
  salon:           ['Candidature', 'Sélection', 'Logistique', 'Installation', 'Foire', 'Retour'],
  visite_atelier:  ['Invitation', 'Confirmation', 'Visite', 'Suivi'],
  autre:           ['Étape 1', 'Étape 2', 'Étape 3'],
}

// ── Auth guard ────────────────────────────────────────────────────────────────

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null }
  return { error: null, supabase }
}

// ── Convert Concept to Process ──────────────────────────────────────────────

export async function convertConceptToProcess(conceptId: string, type: ProcessType) {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  // 1. Fetch concept
  const { data: concept, error: fetchErr } = await supabase
    .from('concept')
    .select('*')
    .eq('id', conceptId)
    .single()

  if (fetchErr || !concept) return { error: 'Concept non trouvé' }

  // 2. Create process
  const { data: process, error: procErr } = await supabase
    .from('suivi_process')
    .insert({
      nom:    concept.titre,
      type:   type,
      notes:  concept.description,
      statut: 'en_cours',
    })
    .select()
    .single()

  if (procErr || !process) return { error: procErr?.message ?? 'Erreur création process' }

  // 3. Create default steps
  const steps = DEFAULT_ETAPES[type] || DEFAULT_ETAPES.autre
  const etapeInserts = steps.map((nom, i) => ({
    process_id: process.id,
    nom,
    position: i + 1,
    statut: i === 0 ? 'en_cours' : 'a_faire'
  }))

  await supabase.from('suivi_etape').insert(etapeInserts)

  // 4. Update concept status
  await supabase
    .from('concept')
    .update({ statut: 'en_cours' }) // Or a new status like 'in_pipeline'
    .eq('id', conceptId)

  return { ok: true, processId: process.id }
}
