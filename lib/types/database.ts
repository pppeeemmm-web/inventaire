export interface Oeuvre {
  OeuvreID: number;
  Titre: string | null;
  Année: string | null;
  Technique: string | null;
  Dimensions: string | null;
  Statut: string | null;
  statusId: number | null;
  is_public: boolean | null;
  Catalogué: boolean;
  NeedsPhotograph?: boolean;
  txtImageNameLink?: string | null;
  ContactID?: number | null;
  LocalisationID?: number | null;
  Prix: number | null;
  ImageURL: string | null;
  // Kept in DB for historical reference, not used by app logic:
  // commercial_status, StageProduction
}

export interface Contact {
  ContactID: number;
  Nom: string | null;
  Prénom: string | null;
  NomInstitution: string | null;
  Email: string | null;
  Type: string | null;
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
  txtImageName: string | null;
  SeqNo: number | null;
  DateAdded: string | null;
}
