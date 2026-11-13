'use client'

// Sign out + Change password (owner 2026-11-13). Every signed-in user can sign out; "Change password"
// only shows for accounts that have an email/password identity (Google-only accounts have none).
// Sign out = `signOut()` then a full document load of /login: middleware redirects document
// requests only, so a client-side push would keep the old RSC tree.

import { useEffect, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'

export function AccountActions({ compact = false, style }: { compact?: boolean; style?: CSSProperties }) {
  const { t } = useI18n()
  const [hasPassword, setHasPassword] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (cancelled || !user) return
        const meta = user.app_metadata ?? {}
        const providers: string[] = Array.isArray(meta.providers) ? meta.providers : meta.provider ? [meta.provider] : []
        setHasPassword(providers.includes('email'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function signOut() {
    setBusy(true)
    const { error } = await createClient().auth.signOut()
    if (error) {
      toast.error(error.message)
      setBusy(false)
      return
    }
    window.location.assign('/login')
  }

  const btn: CSSProperties = compact
    ? { minHeight: 44, minWidth: 44, boxSizing: 'border-box', fontSize: 11, letterSpacing: 1 }
    : { fontSize: 11, letterSpacing: 1 }

  return (
    <div className="row gap-xs" style={{ flexWrap: 'wrap', alignItems: 'center', ...style }} data-testid="account-actions">
      {hasPassword ? (
        <a
          href="/login/reset-password"
          className="btn ghost sm"
          style={{ ...btn, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
          data-testid="account-change-password"
        >
          {t('account_change_password')}
        </a>
      ) : null}
      <button
        type="button"
        className="btn ghost sm"
        disabled={busy}
        onClick={() => void signOut()}
        style={btn}
        data-testid="account-sign-out"
      >
        {busy ? t('account_signing_out') : t('account_sign_out')}
      </button>
    </div>
  )
}
