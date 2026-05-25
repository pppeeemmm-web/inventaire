'use client'

import { downloadLatestStudioBible } from '@/app/atelier/(portal)/vault/actions'
import { stringifyError } from '@/lib/error'

export async function triggerStudioBibleDownload(opts: {
  notFoundMessage: string
  errorMessage: (detail: string) => string
}) {
  const res = await downloadLatestStudioBible()
  if ('error' in res) {
    const detail = res.error === 'NOT_FOUND' ? opts.notFoundMessage : stringifyError(res.error)
    alert(opts.errorMessage(detail))
    return
  }
  const a = document.createElement('a')
  a.href = res.url
  a.download = res.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
