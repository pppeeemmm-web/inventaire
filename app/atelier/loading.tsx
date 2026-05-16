import { InlineSpinner } from '@/components/ui/InlineSpinner'
import { dict } from '@/lib/i18n/dictionary'

export default function AtelierLoading() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--tx3)',
      }}
      className="t-mono-sm"
    >
      <span className="row gap-sm" style={{ alignItems: 'center' }}>
        <InlineSpinner size={14} />
        <span>{dict.fr.loadingAtelier}</span>
      </span>
    </div>
  )
}
