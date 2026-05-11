export const STATUT_KEYS = ['idee', 'exploration', 'en_cours', 'abandonne', 'devenu_oeuvre'] as const

export const STATUT_COLORS: Record<string, string> = {
  idee: 'var(--tx3)',
  exploration: 'var(--ac)',
  en_cours: 'var(--cyan)',
  abandonne: 'var(--rust)',
  devenu_oeuvre: 'var(--sage)',
}

export const CATEGORY_IDS = ['artistic', 'business', 'logistics', 'other'] as const
export const CATEGORY_KEYS: Record<(typeof CATEGORY_IDS)[number], 'concept_cat_artistic' | 'concept_cat_business' | 'concept_cat_logistics' | 'concept_cat_other'> = {
  artistic: 'concept_cat_artistic',
  business: 'concept_cat_business',
  logistics: 'concept_cat_logistics',
  other: 'concept_cat_other',
}

export const MEDIUM_IDS = ['peinture', 'dessin', 'gravure', 'sculpture', 'installation', 'vidéo', 'photo', 'autre'] as const
export const MEDIUM_KEY: Record<string, 'concept_med_peinture' | 'concept_med_dessin' | 'concept_med_gravure' | 'concept_med_sculpture' | 'concept_med_installation' | 'concept_med_video' | 'concept_med_photo' | 'concept_med_autre'> = {
  peinture: 'concept_med_peinture',
  dessin: 'concept_med_dessin',
  gravure: 'concept_med_gravure',
  sculpture: 'concept_med_sculpture',
  installation: 'concept_med_installation',
  vidéo: 'concept_med_video',
  photo: 'concept_med_photo',
  autre: 'concept_med_autre',
}
