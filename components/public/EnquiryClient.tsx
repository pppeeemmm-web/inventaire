'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { createClient } from '@/lib/supabase/client'

import { loadPortfolioConfig } from '@/app/atelier/portfolio/actions'

export default function EnquiryClient() {
  const { lang, setLang, t } = useI18n()
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [config, setConfig] = useState<any>(null)
  const sb = createClient()

  useEffect(() => {
    async function fetchData() {
      const result = await loadPortfolioConfig()
      if ('ok' in result) setConfig(result.config)
    }
    fetchData()
  }, [])

  const contactEmail = config?.general?.contact_email
  const contactPhone = config?.general?.phone

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
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          display: flex; flex-direction: column;
          padding: 0;
          padding-top: env(safe-area-inset-top, 0px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          padding-left: env(safe-area-inset-left, 0px);
          padding-right: env(safe-area-inset-right, 0px);
        }
        .stage-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: clamp(72px, 14vw, 104px) clamp(16px, 5vw, 40px) clamp(32px, 8vh, 64px);
        }
        .wordmark {
          position: absolute; top: clamp(16px, 3.5vw, 28px); left: clamp(16px, 4vw, 32px);
          font-size: clamp(8px, 1.2vw, 9px); letter-spacing: 3px; text-transform: uppercase;
          color: #b0aca6; text-decoration: none;
        }
        .lang-btn {
          position: absolute; top: clamp(14px, 3vw, 24px); right: clamp(16px, 4vw, 32px);
          font-size: clamp(8px, 1.2vw, 9px); letter-spacing: 2px; text-transform: uppercase;
          color: #b0aca6; background: none; border: 1px solid #dedad4;
          padding: 4px 10px; cursor: pointer; transition: all .15s;
          font-family: inherit;
          min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center;
        }
        .lang-btn:hover { color: #6b6760; border-color: #b0aca6; }
        .form-container { width: 100%; max-width: 440px; animation: fadeIn 0.8s ease-out; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .label {
          font-size: 9px; letter-spacing: 3px; text-transform: uppercase;
          color: #b0aca6; margin-bottom: 32px; display: block;
        }
        .contact-info { margin-bottom: 40px; font-size: 11px; color: #9a9690; line-height: 2; }
        .contact-info a { color: inherit; text-decoration: none; border-bottom: 1px solid #dedad4; }
        input, textarea {
          width: 100%; background: none; border: none;
          border-bottom: 1px solid #dedad4;
          padding: 12px 0; margin-bottom: 24px;
          font-family: inherit; font-size: 13px; color: #6b6760;
          outline: none; transition: border-color 0.3s;
        }
        input:focus, textarea:focus { border-bottom-color: #9a9690; }
        textarea { resize: none; min-height: 120px; }
        .btn-submit {
          background: none; border: 1px solid #b0aca6; color: #b0aca6;
          padding: 14px 32px; font-size: 9px; letter-spacing: 2px;
          text-transform: uppercase; cursor: pointer; transition: all 0.25s;
          margin-top: 12px; font-family: inherit; min-height: 44px;
        }
        .btn-submit:hover { background: #5a5650; border-color: #5a5650; color: #edeae4; }
        .btn-submit:disabled { opacity: 0.5; cursor: default; }
        .success-msg { font-style: italic; font-size: 14px; color: #9a9690; line-height: 1.8; }
        .back-link {
          margin-top: 28px;
          align-self: flex-start;
          font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          color: #b0aca6; text-decoration: none;
          min-height: 44px; display: inline-flex; align-items: center;
        }
        .back-link:hover { color: #6b6760; }
      `}</style>

      <div className="stage">
        <Link href="/" className="wordmark">Atelier PEM</Link>
        <button
          className="lang-btn"
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          aria-label="Switch language"
        >
          {lang === 'fr' ? 'EN' : 'FR'}
        </button>

        <div className="stage-scroll" data-testid="enquiry-scroll">
          <div className="form-container">
            <span className="label">{t('pub_enquiry')}</span>

            {(contactEmail || contactPhone) && (
              <div className="contact-info">
                {contactEmail && <div>EMAIL &nbsp; <a href={`mailto:${contactEmail}`}>{contactEmail}</a></div>}
                {contactPhone && <div>PHONE &nbsp; {contactPhone}</div>}
              </div>
            )}

            {sent ? (
              <div className="success-msg">{t('pub_thank_you')}</div>
            ) : (
              <form onSubmit={handleSubmit}>
                <input
                  placeholder={t('pub_name').toUpperCase()}
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
                <input
                  type="email" placeholder={t('pub_email').toUpperCase()}
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
                <textarea
                  placeholder={t('pub_message').toUpperCase()}
                  value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                  required
                />
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? t('pub_sending').toUpperCase() : t('pub_send').toUpperCase()}
                </button>
              </form>
            )}
          </div>

          <Link href="/" className="back-link">{t('pub_back')}</Link>
        </div>
      </div>
    </>
  )
}
