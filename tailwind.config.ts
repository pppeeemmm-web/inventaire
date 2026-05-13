import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // Reference the CSS variables from globals.css so Tailwind
      // utility classes like text-tx, bg-bg2, border-bd work alongside
      // the hand-rolled component classes (btn, chip, stat, etc.)
      colors: {
        bg0:   'var(--bg0)',
        bg1:   'var(--bg1)',
        bg2:   'var(--bg2)',
        bg3:   'var(--bg3)',
        bd:    'var(--bd)',
        bd2:   'var(--bd2)',
        bd3:   'var(--bd3)',
        tx:    'var(--tx)',
        tx2:   'var(--tx2)',
        tx3:   'var(--tx3)',
        mt:    'var(--mt)',
        ac:    'var(--ac)',
        ac2:   'var(--ac2)',
        cyan:  'var(--cyan)',
        rust:  'var(--rust)',
        sage:  'var(--sage)',
        dust:  'var(--dust)',
      },
      fontFamily: {
        sans:  ['var(--font-ui)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-ui)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'Didot', 'Georgia', 'serif'],
      },
      fontSize: {
        eyebrow: ['9px',  { letterSpacing: '2.5px' }],
        label:   ['10px', { letterSpacing: '1.2px' }],
        sm:      ['10.5px', { lineHeight: '1.55' }],
        base:    ['11.5px', { lineHeight: '1.55' }],
        display: ['56px', { lineHeight: '1',    letterSpacing: '-0.02em' }],
        xl:      ['40px', { lineHeight: '1.05' }],
        lg:      ['28px', { lineHeight: '1.15' }],
        md:      ['20px', { lineHeight: '1.3'  }],
        heading: ['14px', { lineHeight: '1.4'  }],
      },
    },
  },
  plugins: [],
}

export default config
