'use client'

import React from 'react'
import Link from 'next/link'
import { thumbUrl, yearOf } from '@/lib/data'

interface Work {
  OeuvreID:         number
  Titre:            string | null
  Année:            string | null
  Hauteur:          string | null
  Largeur:          string | null
  Profondeur:       string | null
  txtImageNameLink: string | null
}

interface Props {
  title:     string
  subtitle:  string
  works:     Work[]
  userName?: string
}

export default function PortalLayout({ title, subtitle, works, userName }: Props) {
  return (
    <div style={{ minHeight: '100vh', background: '#edeae4', color: '#6b6760', fontFamily: 'JetBrains Mono, monospace' }}>
      
      {/* Header */}
      <nav style={{ 
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 40px', background: 'rgba(237,234,228,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #dedad4'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#b0aca6' }}>{title}</div>
          <div className="serif" style={{ fontFamily: 'Instrument Serif, serif', fontSize: 20, color: '#3a3834' }}>{subtitle}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: 1, color: '#b0aca6' }}>Connecté en tant que: {userName}</div>
          <Link href="/hub" style={{ fontSize: 9, letterSpacing: 2, color: '#b0aca6', textDecoration: 'none', border: '1px solid #dedad4', padding: '6px 12px' }}>HUB</Link>
        </div>
      </nav>

      {/* Hero / Welcome */}
      <main style={{ padding: '80px 40px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '64px 48px' }}>
            {works.map((w) => (
              <div key={w.OeuvreID} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ 
                  aspectRatio: '4/5', background: '#f5f3f0', overflow: 'hidden', 
                  border: '1px solid rgba(0,0,0,0.03)', position: 'relative' 
                }}>
                  {w.txtImageNameLink ? (
                    <img 
                      src={thumbUrl(w.txtImageNameLink, 800)} 
                      alt={w.Titre || ''} 
                      style={{ width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }} 
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#c8c4be', fontSize: 10 }}>SANS IMAGE</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                   <div className="serif" style={{ fontFamily: 'Instrument Serif, serif', fontSize: 18, color: '#3a3834', lineHeight: 1.2 }}>{w.Titre || 'Sans titre'}</div>
                   <div style={{ fontSize: 9, letterSpacing: 1.5, color: '#b0aca6', display: 'flex', gap: 12 }}>
                     <span>{yearOf(w.Année)}</span>
                     <span>{w.Hauteur}x{w.Largeur}{w.Profondeur ? `x${w.Profondeur}` : ''} cm</span>
                   </div>
                </div>
              </div>
            ))}
          </div>

          {works.length === 0 && (
            <div style={{ padding: '120px 0', textAlign: 'center' }}>
               <div style={{ fontSize: 10, letterSpacing: 3, color: '#b0aca6' }}>AUCUNE ŒUVRE RÉPERTORIÉE</div>
            </div>
          )}

        </div>
      </main>

      <footer style={{ padding: '80px 40px', borderTop: '1px solid #dedad4', textAlign: 'center' }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: '#b0aca6' }}>© {new Date().getFullYear()} PIERRE EMMANUEL MOULIN · ATELIER</div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400&display=swap');
        .serif { font-family: 'Instrument Serif', serif; }
      `}</style>
    </div>
  )
}
