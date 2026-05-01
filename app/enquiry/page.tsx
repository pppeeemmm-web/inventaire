'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function EnquiryPage() {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const sb = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) return
    setLoading(true)
    const { error } = await sb.from('inquiry').insert([form])
    setLoading(false)
    if (!error) setSent(true)
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; height: 100%; overflow: hidden; }
        body { background: #edeae4; font-family: 'JetBrains Mono', monospace; color: #6b6760; }
        
        .stage {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 40px;
        }

        .wordmark {
          position: absolute; top: 28px; left: 32px;
          font-size: 9px; letter-spacing: 3px; text-transform: uppercase;
          color: #b0aca6; text-decoration: none;
        }

        .form-container {
          width: 100%;
          max-width: 440px;
          animation: fadeIn 0.8s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .label {
          font-size: 9px; letter-spacing: 3px; text-transform: uppercase;
          color: #b0aca6; margin-bottom: 32px; display: block;
        }

        input, textarea {
          width: 100%;
          background: none;
          border: none;
          border-bottom: 1px solid #dedad4;
          padding: 12px 0;
          margin-bottom: 24px;
          font-family: inherit;
          font-size: 13px;
          color: #6b6760;
          outline: none;
          transition: border-color 0.3s;
        }

        input:focus, textarea:focus {
          border-bottom-color: #9a9690;
        }

        textarea {
          resize: none;
          min-height: 120px;
        }

        .btn-submit {
          background: none;
          border: 1px solid #b0aca6;
          color: #b0aca6;
          padding: 14px 32px;
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.25s;
          margin-top: 12px;
        }

        .btn-submit:hover {
          background: #5a5650;
          border-color: #5a5650;
          color: #edeae4;
        }

        .btn-submit:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .success-msg {
          font-style: italic;
          font-size: 14px;
          color: #9a9690;
          line-height: 1.8;
        }

        .back-link {
          position: absolute; bottom: 40px;
          font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          color: #b0aca6; text-decoration: none;
        }
        .back-link:hover { color: #6b6760; }
      `}</style>

      <div className="stage">
        <Link href="/" className="wordmark">Atelier PEM</Link>

        <div className="form-container">
          <span className="label">Enquiry</span>
          
          {sent ? (
            <div className="success-msg">
              Merci. Votre message a été transmis au studio.<br />
              Nous reviendrons vers vous prochainement.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <input 
                placeholder="NOM"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />
              <input 
                type="email" placeholder="EMAIL"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
              <textarea 
                placeholder="MESSAGE"
                value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                required
              />
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'ENVOI...' : 'ENVOYER'}
              </button>
            </form>
          )}
        </div>

        <Link href="/" className="back-link">Retour</Link>
      </div>
    </>
  )
}
