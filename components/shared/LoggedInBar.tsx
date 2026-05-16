'use client'

import { useI18n } from '@/lib/i18n/context'

type Props = {
  displayName: string
}

/** Fixed session hint — no layout shift, does not capture clicks. */
export function LoggedInBar({ displayName }: Props) {
  const { t } = useI18n()
  if (!displayName) return null

  const fullLabel = `${t('portal_connected_as')} ${displayName}`

  return (
    <>
      <div
        data-testid="logged-in-bar"
        role="status"
        aria-label={fullLabel}
        title={fullLabel}
        className="logged-in-bar"
      >
        {displayName}
      </div>
      <style jsx>{`
        .logged-in-bar {
          position: fixed;
          top: calc(max(8px, env(safe-area-inset-top, 0px)) + 118px);
          right: max(18px, env(safe-area-inset-right, 0px));
          z-index: 120;
          pointer-events: none;
          max-width: min(34vw, 150px);
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid var(--bd);
          background: color-mix(in srgb, var(--bg0) 88%, transparent);
          backdrop-filter: blur(6px);
          color: var(--tx2);
          font-size: 9px;
          letter-spacing: 0.3px;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          box-sizing: border-box;
          opacity: 0.88;
        }

        @media (max-width: 767px) {
          .logged-in-bar {
            top: calc(max(6px, env(safe-area-inset-top, 0px)) + 120px);
            right: max(12px, env(safe-area-inset-right, 0px));
            max-width: min(30vw, 112px);
            opacity: 0.78;
          }
        }
      `}</style>
    </>
  )
}
