export type PemTheme = 'dark' | 'light' | 'standard'

/** Staff apps only — theme from localStorage applies here, not on public pages. */
export function isInternalThemeRoute(pathname: string): boolean {
  return /^\/(atelier|hub|galerie)(\/|$)/.test(pathname)
}

export function normalizePemTheme(raw: string | null | undefined): PemTheme {
  if (raw === 'dark' || raw === 'light' || raw === 'standard') return raw
  return 'light'
}

/** Theme applied to `<html data-theme>` for this path + stored preference. */
export function resolveDocumentTheme(pathname: string, stored: string | null | undefined): PemTheme {
  if (!isInternalThemeRoute(pathname)) return 'light'
  return normalizePemTheme(stored)
}
