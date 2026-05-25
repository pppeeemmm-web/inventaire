'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { LoginChrome } from './LoginChrome'

function isLanDevHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
  return false
}

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

type LoginView = 'signin' | 'recover' | 'recover_sent'

// Login — email/password + recovery + Google OAuth (team accounts; no public sign-up).
export function LoginClient() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || '/hub'
  const [view, setView] = useState<LoginView>(() =>
    searchParams.get('recover') === '1' ? 'recover' : 'signin',
  )
  const [lanDev, setLanDev] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLanDev(
      process.env.NODE_ENV === 'development' && isLanDevHostname(window.location.hostname),
    )
  }, [])

  useEffect(() => {
    if (searchParams.get('recover') === '1') setView('recover')
  }, [searchParams])

  // Supabase/Google may return errors in the URL hash after a failed OAuth exchange
  useEffect(() => {
    if (typeof window === 'undefined') return
    const { hash, search, pathname } = window.location

    const q = new URLSearchParams(search)
    if (q.get('error') === 'auth') {
      setError(t('auth_err_session'))
    }

    if (!hash || hash.length < 2) return
    const params = new URLSearchParams(hash.slice(1))
    const code = params.get('error_code')
    const desc = params.get('error_description')
    const err = params.get('error')
    if (desc || err) {
      const msg = desc
        ? decodeURIComponent(desc.replace(/\+/g, ' '))
        : err ?? code ?? t('auth_err_generic')
      setError(msg)
    }
    window.history.replaceState(null, '', pathname + search)
  }, [t])

  function safeNext(): string {
    return nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/hub'
  }

  function passwordResetRedirectUrl(): string {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent('/login/reset-password')}`
  }

  /** Same host as this page — PKCE verifier lives in host-only cookies. */
  function authCallbackUrl(next: string): string {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
  }

  async function handleEmailPassword(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.push(safeNext())
    router.refresh()
  }

  async function handleRecover(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: passwordResetRedirectUrl(),
    })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setView('recover_sent')
  }

  async function handleGoogle() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const next = safeNext()
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authCallbackUrl(next) },
    })
    if (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <LoginChrome>
      {error && (
        <div style={{ color: 'var(--rust)', fontSize: 10, marginBottom: 14 }}>{error}</div>
      )}

      {lanDev ? (
        <div
          data-testid="login-dev-lan-notice"
          style={{
            marginBottom: 16,
            padding: 12,
            border: '1px solid var(--bd)',
            borderRadius: 8,
            background: 'var(--bg1)',
            fontSize: 10,
            lineHeight: 1.5,
            color: 'var(--tx2)',
          }}
        >
          <div className="t-eyebrow" style={{ marginBottom: 6 }}>{t('login_dev_lan_title')}</div>
          <p style={{ margin: '0 0 8px' }}>{t('login_dev_lan_oauth_warn')}</p>
          <p style={{ margin: 0 }}>{t('login_dev_lan_auto_hint')}</p>
          <Link
            href={safeNext()}
            className="btn ghost sm"
            style={{ marginTop: 10, minHeight: 40, display: 'inline-flex', textDecoration: 'none' }}
            data-testid="login-dev-lan-continue"
          >
            {t('login_dev_lan_continue')}
          </Link>
        </div>
      ) : null}

      {view === 'recover' || view === 'recover_sent' ? (
        <>
          <p className="serif s-md" style={{ marginBottom: 8 }}>{t('login_recover_title')}</p>
          {view === 'recover_sent' ? (
            <p
              className="t-mono-sm"
              style={{ color: 'var(--tx2)', marginBottom: 16, lineHeight: 1.5 }}
              data-testid="login-recover-sent"
            >
              {t('login_recover_sent')}
            </p>
          ) : (
            <>
              <p className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 16, lineHeight: 1.5 }}>
                {t('login_recover_hint')}
              </p>
              <form onSubmit={handleRecover} data-testid="login-recover-form">
                <label htmlFor="login-recover-email" className="t-mono-sm" style={{ display: 'block', color: 'var(--tx3)', marginBottom: 4 }}>
                  {t('login_email_label')}
                </label>
                <input
                  id="login-recover-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  data-testid="login-recover-email"
                  style={fieldStyle}
                />
                <button
                  type="submit"
                  disabled={loading}
                  data-testid="login-recover-submit"
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: '1px solid var(--ac)',
                    background: 'var(--ac)',
                    color: 'var(--bg0)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: loading ? 'wait' : 'pointer',
                    marginBottom: 12,
                    minHeight: 44,
                  }}
                >
                  {loading ? t('login_recover_sending') : t('login_recover_send')}
                </button>
              </form>
            </>
          )}
          <button
            type="button"
            className="t-mono-sm"
            style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', padding: 0 }}
            onClick={() => {
              setView('signin')
              setError(null)
            }}
            data-testid="login-back-to-sign-in"
          >
            {t('login_back_to_sign_in')}
          </button>
        </>
      ) : (
        <>
          <form onSubmit={handleEmailPassword} data-testid="login-email-form">
            <label htmlFor="login-email" className="t-mono-sm" style={{ display: 'block', color: 'var(--tx3)', marginBottom: 4 }}>
              {t('login_email_label')}
            </label>
            <input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              data-testid="login-email"
              style={fieldStyle}
            />
            <label htmlFor="login-password" className="t-mono-sm" style={{ display: 'block', color: 'var(--tx3)', marginBottom: 4 }}>
              {t('login_password_label')}
            </label>
            <input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              data-testid="login-password"
              style={fieldStyle}
            />
            <div style={{ marginBottom: 10, textAlign: 'right' }}>
              <button
                type="button"
                className="t-mono-sm"
                style={{ background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', padding: 0, minHeight: 44 }}
                onClick={() => {
                  setView('recover')
                  setError(null)
                }}
                data-testid="login-forgot-password"
              >
                {t('login_forgot_password')}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              data-testid="login-email-submit"
              style={{
                width: '100%',
                padding: '10px 16px',
                border: '1px solid var(--ac)',
                background: 'var(--ac)',
                color: 'var(--bg0)',
                fontSize: 12,
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                marginBottom: 8,
                minHeight: 44,
              }}
            >
              {loading ? t('login_signing_in') : t('login_sign_in_email')}
            </button>
            <p className="t-mono-sm" style={{ color: 'var(--tx3)', margin: '0 0 16px', lineHeight: 1.4 }}>
              {t('login_email_team_hint')}
            </p>
          </form>

          <div
            role="separator"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
              color: 'var(--tx3)',
              fontSize: 10,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
            {t('login_or_divider')}
            <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            data-testid="login-google"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '10px 16px',
              border: '1px solid var(--bd2)',
              background: 'var(--bg2)',
              color: 'var(--tx)',
              fontSize: 12,
              cursor: loading ? 'wait' : 'pointer',
              minHeight: 44,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            {loading ? t('login_redirecting') : t('login_continue_google')}
          </button>
        </>
      )}
    </LoginChrome>
  )
}
