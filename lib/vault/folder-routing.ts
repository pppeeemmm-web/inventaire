/** Default vault folders for routed document kinds / sources. */
export const VAULT_FOLDER_COA = 'COA'
export const VAULT_FOLDER_INVOICES = 'Invoices'
export const VAULT_FOLDER_CONSIGNMENT = 'Consignment'

export const VAULT_ROUTED_FOLDERS = [
  VAULT_FOLDER_COA,
  VAULT_FOLDER_INVOICES,
  VAULT_FOLDER_CONSIGNMENT,
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
