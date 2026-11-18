'use server'

// Pem's voice card on Aujourd'hui (TODO 24, Pem 2026-11-18: « dots + voice card »). A voice note by an admin
// whose subject holds « #équipe » is shown to the whole team, once, for 21 days. Team members cannot read an
// admin's voice notes under RLS (voice_note_team_select: own or admin), so this one read uses the service client,
// after checking the caller is on the team, and returns only that note's card fields. Read only.

import { createClient, createServiceClient } from '@/lib/supabase/server'

export type TeamVoiceCard = {
  id: string
  at: string
  author: string
  subject: string | null
  transcript: string | null
  audioKey: string
}

const TAG = '#équipe'
const DAYS = 21

export async function getTeamVoiceCard(): Promise<TeamVoiceCard | null> {
  const supabase = await createClient()
  const [{ data: auth }, { data: team }] = await Promise.all([supabase.auth.getUser(), supabase.rpc('is_team')])
  if (!auth.user || team !== true) return null

  const svc = createServiceClient()
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString()
  const { data: notes } = await svc
    .from('voice_note')
    .select('id, created_at, subject, transcript, audio_r2_key, user_id')
    .ilike('subject', `%${TAG}%`)
    .not('audio_r2_key', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5)
  for (const n of notes ?? []) {
    if (!n.user_id || !n.audio_r2_key) continue
    const { data: author } = await svc
      .from('Contact')
      .select('Prénom, Nom, is_admin')
      .eq('auth_user_id', n.user_id)
      .maybeSingle()
    if (!author?.is_admin) continue
    const subject = (n.subject ?? '').replace(/#équipe/gi, '').replace(/\s{2,}/g, ' ').trim()
    return {
      id: n.id,
      at: n.created_at,
      author: [author.Prénom, author.Nom].filter(Boolean).join(' ').trim() || '—',
      subject: subject || null,
      transcript: n.transcript?.trim() || null,
      audioKey: n.audio_r2_key,
    }
  }
  return null
}
