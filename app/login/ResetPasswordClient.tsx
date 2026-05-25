'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { LoginChrome } from './LoginChrome'

const fieldStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--bd2)',
  background: 'var(--bg2)',
  color: 'var(--tx)',
  fontSize: 12,
  marginBottom: 10,
  minHeight: 44,
  boxSizing: 'border-box',
}

export function ResetPasswordClient() {
  const { t } = useI18n()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return
      setHasSession(Boolean(user))
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError(t('login_password_mismatch'))
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    setDone(true)
    setLoading(false)
    router.push('/hub')
    router.refresh()
  }

  if (!ready) {
    return (
      <LoginChrome>
        <p className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('loading')}</p>
      </LoginChrome>
    )
  }

  if (!hasSession) {
    return (
      <LoginChrome>
        <p className="serif s-md" style={{ marginBottom: 12 }}>{t('login_reset_title')}</p>
        <p className="t-mono-sm" style={{ color: 'var(--rust)', marginBottom: 16, lineHeight: 1.5 }}>
          {t('login_reset_no_session')}
        </p>
        <Link href="/login?recover=1" className="t-mono-sm" style={{ color: 'var(--ac)' }} data-testid="login-reset-request-link">
          {t('login_forgot_password')}
        </Link>
      </LoginChrome>
    )
  }

  return (
    <LoginChrome>
      <p className="serif s-md" style={{ marginBottom: 8 }}>{t('login_reset_title')}</p>
      <p className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 16, lineHeight: 1.5 }}>
        {done ? t('login_reset_done') : t('login_reset_hint')}
      </p>

      {error && (
        <div style={{ color: 'var(--rust)', fontSize: 10, marginBottom: 14 }}>{error}</div>
      )}

      <form onSubmit={handleSubmit} data-testid="login-reset-form">
        <label htmlFor="login-new-password" className="t-mono-sm" style={{ display: 'block', color: 'var(--tx3)', marginBottom: 4 }}>
          {t('login_new_password_label')}
        </label>
        <input
          id="login-new-password"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading || done}
          data-testid="login-new-password"
          style={fieldStyle}
        />
        <label htmlFor="login-confirm-password" className="t-mono-sm" style={{ display: 'block', color: 'var(--tx3)', marginBottom: 4 }}>
          {t('login_confirm_password_label')}
        </label>
        <input
          id="login-confirm-password"
          type="password"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={loading || done}
          data-testid="login-confirm-password"
          style={fieldStyle}
        />
        <button
          type="submit"
          disabled={loading || done}
          data-testid="login-reset-submit"
          style={{
            width: '100%',
            padding: '10px 16px',
            border: '1px solid var(--ac)',
            background: 'var(--ac)',
            color: 'var(--bg0)',
            fontSize: 12,
            fontWeight: 600,
            cursor: loading || done ? 'wait' : 'pointer',
            marginBottom: 12,
            minHeight: 44,
          }}
        >
          {loading ? t('login_reset_saving') : t('login_reset_submit')}
        </button>
      </form>

      <Link href="/login" className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
        {t('login_back_to_sign_in')}
      </Link>
    </LoginChrome>
  )
}
