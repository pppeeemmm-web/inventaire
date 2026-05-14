export interface Oeuvre {
  OeuvreID: number;
  Titre: string | null;
  Année: string | null;
  Technique: number | null;
  Support: number | null;
  Format: number | null;
  Hauteur: string | null;
  Largeur: string | null;
  Profondeur: string | null;
  Dimensions: string | null;
  statusId: number | null;
  is_public: boolean | null;
  Catalogué: boolean;
  NeedsPhotograph?: boolean;
  txtImageNameLink?: string | null;
  ContactID?: number | null;
  LocalisationID?: number | null;
  LocalisationDetail?: string | null;
  AcheteurID?: number | null;
  Prix: number | null;
  Discount?: number | null;
  PrixFinal?: number | null;
  IsCommission?: boolean | null;
  Exposable?: boolean | null;
  /** Operator gate for marketing export feed (with is_public + image). */
  broadcast_ready?: boolean | null;
  /** Optional seed text for broadcast / AI caption workflows. */
  broadcast_caption_seed?: string | null;
  Encadree?: boolean | null;
  Montee?: boolean | null;
  DateLivraison?: string | null;
  ReturnDate?: string | null;
  Commentaires?: string | null;
  Historique?: string | null;
  PresentationID?: number | null;
  StageProduction?: string | null;
  anonymity_level?: number | null;
  is_paid?: boolean | null;
  /** VAT rate (percent or fraction per saveWork). */
  tva_rate?: number | null;
  is_gift?: boolean | null;
  commercial_status?: string | null;
  ImageURL: string | null;
  /** Soft-delete marker — null = active (apply migration `oeuvres_deleted_at.sql`). */
  deleted_at?: string | null;
  // Kept in DB for historical reference, not used by app logic:
  // commercial_status, StageProduction
  // Dead columns dropped in DB (`supabase/sql/dead_columns_drop.sql`); not in this interface.
}

export interface Contact {
  ContactID: number;
  Nom: string | null;
  Prénom: string | null;
  NomInstitution: string | null;
  Email: string | null;
  Type: string | null;
  /** Supabase auth user id when this contact can sign in */
  auth_user_id?: string | null;
}

export interface Exhibition {
  id: string;
  titre: string;
  lieu: string | null;
  date_debut: string | null;
  date_fin: string | null;
  contact_id: number | null;
}

export interface WorkImage {
  ImageID: number;
  OeuvreID: number;
  txtImageNameLink: string | null;
  SeqNo: number | null;
  DateAdded: string | null;
}

/** `suivi_reminder` rows as listed in Atelier overview / pipeline (RLS team read). */
export interface SuiviReminderListRow {
  id: string
  process_id: string | null
  etape_id: string | null
  message: string
  remind_at: string
  lu: boolean
}

/** `suivi_process` columns used for overview / pipeline pulse (server + client). */
export interface SuiviProcessPulseRow {
  id: string
  nom: string
  type: string
  date_fin: string | null
  deadline_time: string | null
  statut: string
}

/** `suivi_etape` columns used when building `PulseProcess` for overview / calendar. */
export interface SuiviEtapePulseRow {
  id: string
  process_id: string
  nom: string
  statut: string
  date_echeance: string | null
  overdue_override: boolean | null
  position: number
}

/** `concept` rows for overview “burning” strip. */
export interface ConceptBurningRow {
  id: string
  titre: string
  energie: number
}

/** `work_session` field capture row (Verb 1). */
export interface WorkSessionRow {
  id: string
  created_at: string
  updated_at: string
  expires_at: string
  user_id: string
  oeuvre_id: number | null
  status: 'draft' | 'pending_review' | 'applied' | 'rejected' | 'abandoned'
  payload: unknown
}

/** `share_inbox` row (Web Share Target triage). */
export interface ShareInboxRow {
  id: string
  created_at: string
  expires_at: string
  user_id: string
  payload: unknown
}

/** `sketchbook` row (Verb 2 — future drawing parent). */
export interface SketchbookRow {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  name: string
}

/** `voice_note` row (Verb 2 — field audio + transcript). */
export interface VoiceNoteRow {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  kind: 'memo' | 'dictation' | 'meeting' | 'field'
  bucket: 'terrain' | 'studio' | 'commercial' | 'general'
  subject: string | null
  transcript: string
  audio_r2_key: string | null
  audio_mime: string | null
  duration_ms: number | null
  oeuvre_id: number | null
  process_id: string | null
  sketchbook_id: string | null
}
