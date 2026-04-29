// Magic-link login page — the only auth entry point.
// Team members and galleries are invited; no public sign-up.
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
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
        <div style={{ marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, border: '1px solid var(--ac)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ac)', fontSize: 14, fontFamily: "'Instrument Serif', serif", marginBottom: 20 }}>P</div>
          <div className="serif s-md" style={{ marginBottom: 8 }}>Atelier</div>
          <div className="t-mono-sm">Accès restreint. Entrez votre adresse e-mail pour recevoir un lien de connexion.</div>
        </div>

        {sent ? (
          <div style={{ border: '1px solid var(--bd)', padding: '16px 20px' }}>
            <div className="t-mono-sm" style={{ color: 'var(--sage)' }}>Lien envoyé.</div>
            <div className="t-mono-sm" style={{ marginTop: 6 }}>Vérifiez votre boîte mail.</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--bd2)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 12 }}
              />
            </div>
            {error && <div style={{ color: 'var(--rust)', fontSize: 10, marginBottom: 10 }}>{error}</div>}
            <button type="submit" className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Envoi…' : 'Envoyer le lien'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
