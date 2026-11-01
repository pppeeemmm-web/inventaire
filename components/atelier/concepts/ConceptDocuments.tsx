'use client'

// Documents attached to a concept: files (R2 vault bucket), links (Drive, Proton, web) and
// local mentions (where a file lives on one of the owner's machines — text only, never a link).

import { useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { stringifyError } from '@/lib/error'
import { surfaceError } from '@/lib/error-reporter/client'
import {
  uploadDocument,
  createVaultUploadUrl,
  finalizeVaultUpload,
  getSignedUrl,
} from '@/app/atelier/(portal)/vault/actions'
import {
  addConceptDocumentReference,
  fetchAttachableDocuments,
  setDocumentConcept,
  type ConceptDocument,
} from '@/app/atelier/(portal)/concepts/document-actions'
import { inputSt, labelSt } from './concept-form-styles'

/** Under Vercel's 4.5 MB Server Action body cap (multipart overhead included). */
const SERVER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024

type AddMode = null | 'link' | 'local' | 'attach'

function fmtSize(bytes: number | null, lang: string): string {
  if (!bytes) return ''
  const [kb, mb] = lang === 'en' ? ['KB', 'MB'] : ['Ko', 'Mo']
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ${kb}`
  return `${(bytes / 1024 / 1024).toFixed(1)} ${mb}`
}

function linkHost(url: string | null): string {
  try {
    return url ? new URL(url).host.replace(/^www\./, '') : ''
  // eslint-disable-next-line pem-i18n/no-silent-catch -- display only: an unparsable URL just shows no host
  } catch {
    return ''
  }
}

export function ConceptDocuments({
  conceptId,
  initialDocs,
}: {
  conceptId: string
  initialDocs: ConceptDocument[]
}) {
  const { t, lang } = useI18n()
  const [docs, setDocs] = useState<ConceptDocument[]>(initialDocs)
  const [mode, setMode] = useState<AddMode>(null)
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [attachable, setAttachable] = useState<ConceptDocument[] | null>(null)
  const [attachId, setAttachId] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const kindLabel = (d: ConceptDocument) =>
    t(d.source === 'link' ? 'concept_docs_kind_link' : d.source === 'local' ? 'concept_docs_kind_local' : 'concept_docs_kind_file')

  function resetForm() {
    setMode(null)
    setName('')
    setValue('')
    setAttachId('')
  }

  function added(doc: ConceptDocument) {
    setDocs((prev) => [doc, ...prev])
    toast.success(t('concept_docs_added'))
    resetForm()
  }

  async function onPickFile(file: File | null) {
    if (!file) return
    setBusy(true)
    try {
      if (file.size <= SERVER_UPLOAD_MAX_BYTES) {
        const fd = new FormData()
        fd.set('file', file)
        fd.set('name', file.name)
        fd.set('concept_id', conceptId)
        const res = await uploadDocument(fd)
        if ('error' in res) throw new Error(res.error)
        added({ ...(res.doc as unknown as ConceptDocument), source: 'file' })
        return
      }
      // Too large for a Server Action body: the browser sends the bytes straight to R2.
      const signed = await createVaultUploadUrl({
        fileName: file.name, contentType: file.type || 'application/octet-stream', size: file.size, name: file.name,
      })
      if ('error' in signed) throw new Error(signed.error)
      // A network-level TypeError here means the bucket refused the cross-origin PUT (no CORS rule).
      const put = await fetch(signed.url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
      if (!put.ok) throw new Error(t('concept_docs_direct_failed'))
      const res = await finalizeVaultUpload({ key: signed.key, name: file.name, conceptId })
      if ('error' in res) throw new Error(res.error)
      added({ ...(res.doc as unknown as ConceptDocument), source: 'file' })
    } catch (e) {
      const message = e instanceof TypeError ? t('concept_docs_direct_failed') : stringifyError(e)
      surfaceError(message, e, { source: 'concepts.documents.upload', metadata: { size: file.size } })
    } finally {
      setBusy(false)
    }
  }

  async function submitReference() {
    if (mode !== 'link' && mode !== 'local') return
    setBusy(true)
    const res = await addConceptDocumentReference({ conceptId, source: mode, name, value })
    setBusy(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    added(res.doc)
  }

  async function openAttach() {
    setMode('attach')
    if (attachable === null) setAttachable(await fetchAttachableDocuments())
  }

  async function submitAttach() {
    const doc = attachable?.find((d) => d.id === attachId)
    if (!doc) return
    setBusy(true)
    const res = await setDocumentConcept(doc.id, conceptId)
    setBusy(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    setAttachable((prev) => prev?.filter((d) => d.id !== doc.id) ?? null)
    added({ ...doc, concept_id: conceptId })
  }

  async function detach(doc: ConceptDocument) {
    const res = await setDocumentConcept(doc.id, null)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    setDocs((prev) => prev.filter((d) => d.id !== doc.id))
    setAttachable((prev) => (prev ? [{ ...doc, concept_id: null }, ...prev] : prev))
  }

  async function openFile(doc: ConceptDocument) {
    if (!doc.storage_path) return
    const res = await getSignedUrl(doc.storage_path)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    window.open(res.url, '_blank', 'noopener')
  }

  async function copyLocation(doc: ConceptDocument) {
    try {
      await navigator.clipboard.writeText(doc.local_location ?? '')
      toast.success(t('concept_docs_copied'))
    } catch (e) {
      surfaceError(stringifyError(e), e, { source: 'concepts.documents.copy' })
    }
  }

  const rowBtn = { minHeight: 36, minWidth: 44, flexShrink: 0 } as const

  return (
    <div data-testid="concept-documents" style={{ marginBottom: 12 }}>
      <div style={labelSt}>
        {t('concept_docs_heading')}{docs.length ? ` (${docs.length})` : ''}
      </div>

      {docs.length === 0 ? (
        <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 8 }}>{t('concept_docs_empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 8, borderTop: '1px solid var(--bd)' }}>
          {docs.map((d) => (
            <div
              key={d.id}
              data-testid={`concept-doc-${d.source}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--bd)', flexWrap: 'wrap' }}
            >
              <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', width: 44, flexShrink: 0 }}>
                {kindLabel(d)}
              </span>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--tx)', overflowWrap: 'anywhere' }}>{d.name}</div>
                {d.source === 'local' ? (
                  <div style={{ fontSize: 10, color: 'var(--tx2)', fontFamily: 'var(--mono)', overflowWrap: 'anywhere' }}>{d.local_location}</div>
                ) : d.source === 'link' ? (
                  <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{linkHost(d.external_url)}</div>
                ) : d.file_size ? (
                  <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{fmtSize(d.file_size, lang)}</div>
                ) : null}
              </div>
              {d.source === 'link' && d.external_url ? (
                <a className="btn ghost sm" href={d.external_url} target="_blank" rel="noopener noreferrer"
                  style={{ ...rowBtn, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t('concept_docs_open')} ↗
                </a>
              ) : d.source === 'local' ? (
                <button type="button" className="btn ghost sm" style={rowBtn} onClick={() => void copyLocation(d)}>
                  {t('concept_docs_copy')}
                </button>
              ) : d.storage_path ? (
                <button type="button" className="btn ghost sm" style={rowBtn} onClick={() => void openFile(d)}>
                  {t('concept_docs_open')}
                </button>
              ) : null}
              <button type="button" className="btn ghost sm" style={{ ...rowBtn, color: 'var(--tx3)' }}
                title={t('concept_docs_detach_title')} onClick={() => void detach(d)}>
                {t('concept_docs_detach')}
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
        onChange={(e) => { void onPickFile(e.target.files?.[0] ?? null); e.target.value = '' }}
      />
      <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy && mode === null ? t('concept_docs_uploading') : t('concept_docs_add_file')}
        </button>
        <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy} onClick={() => { resetForm(); setMode('link') }}>
          {t('concept_docs_add_link')}
        </button>
        <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy} onClick={() => { resetForm(); setMode('local') }}>
          {t('concept_docs_add_local')}
        </button>
        <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy} onClick={() => { resetForm(); void openAttach() }}>
          {t('concept_docs_attach')}
        </button>
      </div>

      {(mode === 'link' || mode === 'local') && (
        <div style={{ marginTop: 8, padding: 10, background: 'var(--bg2)', border: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input style={inputSt} value={value} onChange={(e) => setValue(e.target.value)} autoFocus
            placeholder={t(mode === 'link' ? 'concept_docs_link_ph' : 'concept_docs_local_ph')}
            inputMode={mode === 'link' ? 'url' : 'text'} />
          <input style={inputSt} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('concept_docs_name_ph')} />
          {mode === 'local' && <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('concept_docs_local_hint')}</div>}
          <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn sm" style={{ minHeight: 44 }} disabled={busy || !value.trim()} onClick={() => void submitReference()}>
              {t('concept_docs_add')}
            </button>
            <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={resetForm}>{t('concept_docs_cancel')}</button>
          </div>
        </div>
      )}

      {mode === 'attach' && (
        <div style={{ marginTop: 8, padding: 10, background: 'var(--bg2)', border: '1px solid var(--bd)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select style={{ ...inputSt, flex: '1 1 200px', minWidth: 0 }} value={attachId} onChange={(e) => setAttachId(e.target.value)}>
            <option value="">{t('concept_docs_attach_pick')}</option>
            {(attachable ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button type="button" className="btn sm" style={{ minHeight: 44 }} disabled={busy || !attachId} onClick={() => void submitAttach()}>
            {t('concept_docs_add')}
          </button>
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={resetForm}>{t('concept_docs_cancel')}</button>
        </div>
      )}
    </div>
  )
}
