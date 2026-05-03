export interface Oeuvre {
  OeuvreID: number;
  Titre: string | null;
  Année: string | null;
  Technique: string | null;
  Dimensions: string | null;
  Statut: string | null;
  Prix: number | null;
  ImageURL: string | null;
  NeedsPhotograph?: boolean;
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
