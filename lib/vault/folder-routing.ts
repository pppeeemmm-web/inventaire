/** Default vault folders for routed document kinds / sources. */
export const VAULT_FOLDER_COA = 'COA'
export const VAULT_FOLDER_INVOICES = 'Invoices'
export const VAULT_FOLDER_CONSIGNMENT = 'Consignment'

/** R7 orders: one Vault folder per kind (Pem 2026-11-17), papers named `<REF>_<paper>.pdf`. */
export const VAULT_ORDER_FOLDERS = {
  sale: 'Commandes/Ventes',
  consignment: 'Commandes/Dépôts',
  loan: 'Commandes/Prêts',
  gift: 'Commandes/Dons',
  entrusted: 'Commandes/Confiés',
} as const
/** R2 key prefix per order kind (ASCII) → its Vault folder. */
export const ORDER_KEY_PREFIX = {
  sale: 'commandes/ventes/',
  consignment: 'commandes/depots/',
  loan: 'commandes/prets/',
  gift: 'commandes/dons/',
  entrusted: 'commandes/confies/',
} as const

export const VAULT_ROUTED_FOLDERS = [
  VAULT_FOLDER_COA,
  VAULT_FOLDER_INVOICES,
  VAULT_FOLDER_CONSIGNMENT,
  ...Object.values(VAULT_ORDER_FOLDERS),
] as const

const KIND_FOLDER: Record<string, string> = {
  coa: VAULT_FOLDER_COA,
  facture: VAULT_FOLDER_INVOICES,
}

export type VaultFolderDoc = {
  kind?: string | null
  notes?: string | null
  storage_path?: string | null
  name?: string | null
}

/** Target folder for auto-routing, or null when no rule applies. */
export function resolveVaultFolder(doc: VaultFolderDoc): string | null {
  if (doc.name === '.keep') return null

  const kind = doc.kind?.toLowerCase() ?? ''
  if (kind && KIND_FOLDER[kind]) return KIND_FOLDER[kind]

  const path = doc.storage_path ?? ''
  for (const [k, prefix] of Object.entries(ORDER_KEY_PREFIX)) {
    if (path.startsWith(prefix)) return VAULT_ORDER_FOLDERS[k as keyof typeof VAULT_ORDER_FOLDERS]
  }
  // Gift slips from the former work-card dialog belong with the gift orders.
  if (path.startsWith('gifts/')) return VAULT_ORDER_FOLDERS.gift
  if (path.startsWith('consignments/') || path.startsWith('loans/')) {
    return VAULT_FOLDER_CONSIGNMENT
  }

  const notes = (doc.notes ?? '').toLowerCase()
  if (
    notes.includes('generated for consignment')
    || notes.includes('generated for loan ')
    || notes.includes('bordereau de dépôt')
    || notes.includes('bordereau de pret')
    || notes.includes('bordereau de prêt')
  ) {
    return VAULT_FOLDER_CONSIGNMENT
  }

  if (path.startsWith('orders/') && kind === 'facture') return VAULT_FOLDER_INVOICES

  return null
}
