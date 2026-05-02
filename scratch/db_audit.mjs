
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mcrzsxrcoexnlwmaunte.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTM3NDEsImV4cCI6MjA5MTc2OTc0MX0.ba6g7WsOA3dVq2ltDbelTMpzJhQkZiLB8HjrRhAhGuo'

const supabase = createClient(SUPABASE_URL, ANON_KEY)

async function audit() {
  console.log('--- DATABASE AUDIT ---')
  
  try {
    // 1. Check legacy 'theme' column in Oeuvres
    const { data: themesLegacy } = await supabase.from('Oeuvres').select('OeuvreID, theme').not('theme', 'is', null).limit(10)
    console.log('Legacy "theme" column samples (should be empty/null if migrated):', themesLegacy)

    // 2. Check current themes in OeuvreTheme
    const { data: themesNew } = await supabase.from('OeuvreTheme').select('OeuvreID, ThemeID').limit(5)
    console.log('New "OeuvreTheme" junction samples:', themesNew)

    // 3. Check anonymity level vs is_public
    const { data: anonymity } = await supabase.from('Oeuvres').select('OeuvreID, is_public, anonymity_level').limit(5)
    console.log('Anonymity samples (is_public should match anonymity_level < 2):', anonymity)

    // 4. Check for orphaned works (no contact)
    const { count: noContact } = await supabase.from('Oeuvres').select('*', { count: 'exact', head: true }).is('ContactID', null)
    console.log('Works with NO ContactID:', noContact)

    // 5. Check if 'Prénom' is used in Oeuvres
    const { data: prenom } = await supabase.from('Oeuvres').select('OeuvreID, Prénom').not('Prénom', 'is', null).limit(5)
    console.log('Legacy "Prénom" column samples:', prenom)

    // 6. Check LocalisationID vs LocalisationDetail
    const { data: loc } = await supabase.from('Oeuvres').select('OeuvreID, LocalisationID, LocalisationDetail').limit(5)
    console.log('Location samples (LocalisationDetail should be synced with LocalisationID contact):', loc)

  } catch (err) {
    console.error('Audit failed:', err)
  }
}

audit()
