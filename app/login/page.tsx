// Login page — Google OAuth (primary) + magic link fallback.
// Only team members can access /atelier. No public sign-up.
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'

export default function LoginPage() {
  const { t, lang, setLang } = useI18n()
  const [showMagic, setShowMagic] = useState(false)
  const [email, setEmail]         = useState('')
  const [sent, setSent]           = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

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
    const err  = params.get('error')
    if (desc || err) {
      const msg = desc
        ? decodeURIComponent(desc.replace(/\+/g, ' '))
        : err ?? code ?? t('auth_err_generic')
      setError(msg)
    }
    window.history.replaceState(null, '', pathname + search)
  }, [t])

  async function handleGoogle() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/atelier` },
    })
    if (err) { setError(err.message); setLoading(false) }
    // on success browser redirects — no further action needed
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/atelier` },
    })
    if (err) setError(err.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg0)' }}>
      <div style={{ width: 320 }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ width: 32, height: 32, border: '1px solid var(--ac)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ac)', fontSize: 14, fontFamily: "'Instrument Serif', serif", marginBottom: 20 }}>P</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <div style={{ display: 'flex', border: '1px solid var(--bd)', fontSize: 10, letterSpacing: 1 }}>
              {(['fr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  style={{
                    padding: '4px 10px',
                    background: lang === l ? 'var(--ac)' : 'transparent',
                    color: lang === l ? 'var(--bg0)' : 'var(--tx3)',
                    fontWeight: lang === l ? 600 : 400,
                    border: 'none',
                    borderRight: l === 'fr' ? '1px solid var(--bd)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="serif s-md" style={{ marginBottom: 8 }}>{t('atelier')}</div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('login_restricted')}</div>
        </div>

        {error && (
          <div style={{ color: 'var(--rust)', fontSize: 10, marginBottom: 14 }}>{error}</div>
        )}

        {/* Google button — primary */}
        <button
          onClick={handleGoogle}
          disabled={loading}
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
            cursor: 'pointer',
            marginBottom: 20,
          }}
        >
          {/* Google icon */}
          <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          {loading ? t('login_redirecting') : t('login_continue_google')}
        </button>

        {/* Magic link fallback */}
        {!showMagic && !sent && (
          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setShowMagic(true)}
              style={{ background: 'none', border: 'none', color: 'var(--tx3)', fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {t('login_magic_link')}
            </button>
          </div>
        )}

        {showMagic && !sent && (
          <form onSubmit={handleMagicLink}>
            <div style={{ marginBottom: 10 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login_email_placeholder')}
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--bd2)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 12 }}
              />
            </div>
            <button type="submit" className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? t('login_sending') : t('login_send_link')}
            </button>
          </form>
        )}

        {sent && (
          <div style={{ border: '1px solid var(--bd)', padding: '16px 20px' }}>
            <div className="t-mono-sm" style={{ color: 'var(--sage)' }}>{t('login_link_sent')}</div>
            <div className="t-mono-sm" style={{ marginTop: 6 }}>{t('login_check_inbox')}</div>
          </div>
        )}

      </div>
    </div>
  )
}
