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
  // Dead per CLAUDE.md cemetery, removed from this interface:
  // Statut, DateStatut, NomOriginal, Poids, Tirage
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
