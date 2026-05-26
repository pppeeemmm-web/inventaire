/** Public /works heading + text visibility (portfolio collection JSON). */

export type CollectionHeadingSource = 'title' | 'theme'

export function migrateCollectionHeadingSource(v: unknown): CollectionHeadingSource {
  return v === 'theme' ? 'theme' : 'title'
}

export function migrateCollectionShowText(v: unknown): boolean {
  return v !== false
}

export interface CollectionDisplayFields {
  heading_source?: CollectionHeadingSource
  show_text?: boolean
  title_fr: string
  title_en: string
  theme?: string | null
  intro_fr?: string
  intro_en?: string
  description_fr: string
  description_en: string
}

export function collectionThemeHeading(col: Pick<CollectionDisplayFields, 'theme'>): string {
  return col.theme?.trim() ?? ''
}

export function collectionDisplayHeading(
  col: CollectionDisplayFields,
  lang: 'fr' | 'en',
): string {
  if (col.heading_source === 'theme') {
    return collectionThemeHeading(col)
  }
  if (lang === 'en') {
    return col.title_en?.trim() || col.title_fr?.trim() || ''
  }
  return col.title_fr?.trim() || col.title_en?.trim() || ''
}

export function collectionTextEnabled(col: Pick<CollectionDisplayFields, 'show_text'>): boolean {
  return col.show_text !== false
}

export function collectionDescriptionHtml(
  col: Pick<CollectionDisplayFields, 'description_fr' | 'description_en'>,
  lang: 'fr' | 'en',
): string {
  if (lang === 'en') {
    return col.description_en?.trim() || col.description_fr?.trim() || ''
  }
  return col.description_fr?.trim() || col.description_en?.trim() || ''
}

export function collectionIntroHtml(
  col: Pick<CollectionDisplayFields, 'intro_fr' | 'intro_en'>,
  lang: 'fr' | 'en',
): string {
  if (lang === 'en') {
    return col.intro_en?.trim() || col.intro_fr?.trim() || ''
  }
  return col.intro_fr?.trim() || col.intro_en?.trim() || ''
}

/** Strip RichEditor HTML for plain-text labels. */
export function richTextToPlain(html: string): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/gi, ' ').replace(/\s+/g, ' ').trim()
}

export function collectionIntroPlain(
  col: CollectionDisplayFields,
  lang: 'fr' | 'en',
): string {
  if (!collectionTextEnabled(col)) return ''
  return richTextToPlain(collectionIntroHtml(col, lang))
}

export function collectionHasVisibleText(
  col: CollectionDisplayFields,
  lang: 'fr' | 'en',
): boolean {
  if (!collectionTextEnabled(col)) return false
  return Boolean(richTextToPlain(collectionDescriptionHtml(col, lang)))
}
