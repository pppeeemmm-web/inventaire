// Invoice / ticket file → Vault « Factures » (kind `facture`), from the browser. Same two paths as the
// concept documents: a Server Action upload up to 4 MB, else the direct browser → R2 PUT (Vercel caps a
// Server Action body at 4.5 MB). Returns the new document id; the caller links it to an order or expense.

import {
  createVaultUploadUrl,
  finalizeVaultUpload,
  uploadDocument,
} from '@/app/atelier/(portal)/vault/actions'

const SERVER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024

export async function uploadInvoiceFile(file: File, name: string, docDate: string | null): Promise<{ id: string } | { error: string }> {
  if (file.size <= SERVER_UPLOAD_MAX_BYTES) {
    const fd = new FormData()
    fd.set('file', file)
    fd.set('name', name)
    fd.set('kind', 'facture')
    if (docDate) fd.set('doc_date', docDate)
    const res = await uploadDocument(fd)
    if ('error' in res) return { error: res.error }
    return { id: String((res.doc as { id: string }).id) }
  }
  const signed = await createVaultUploadUrl({
    fileName: file.name, contentType: file.type || 'application/octet-stream', size: file.size, name, kind: 'facture', docDate,
  })
  if ('error' in signed) return { error: signed.error }
  const put = await fetch(signed.url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  })
  if (!put.ok) return { error: 'so_err_upload' }
  const res = await finalizeVaultUpload({ key: signed.key, name, kind: 'facture', docDate })
  if ('error' in res) return { error: res.error }
  return { id: String((res.doc as { id: string }).id) }
}
