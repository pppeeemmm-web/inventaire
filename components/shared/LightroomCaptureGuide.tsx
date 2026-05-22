'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import {
  LIGHTROOM_IOS_APP_STORE_URL,
  tryOpenLightroomIosApp,
} from '@/lib/mobile/lightroom-return'

type LightroomCaptureGuideProps = {
  /** Remember session context before the user leaves for Lightroom. */
  onPrepareReturn?: () => void
  /** Main toggle button test id (e.g. session-photo-lightroom). */
  testId: string
  defaultExpanded?: boolean
}

/**
 * iOS PWAs cannot reliably open Lightroom via custom URL schemes (lightroom-cc:// often fails).
 * Canonical flow: user opens Lightroom from Home Screen → Export → Share → Atelier.
 */
export function LightroomCaptureGuide({
  onPrepareReturn,
  testId,
  defaultExpanded = false,
}: LightroomCaptureGuideProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(defaultExpanded)

  const prepare = () => {
    onPrepareReturn?.()
  }

  return (
    <div data-testid={`${testId}-guide`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button
        type="button"
        className="btn primary"
        data-testid={testId}
        style={{ minHeight: 44, width: '100%' }}
        onClick={() => {
          prepare()
          setOpen((v) => !v)
        }}
      >
        {open ? t('lightroom_steps_hide') : t('session_photo_lightroom')}
      </button>

      {!open ? (
        <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', margin: 0, lineHeight: 1.45 }}>
          {t('session_photo_lightroom_hint')}
        </p>
      ) : (
        <div
          data-testid={`${testId}-steps`}
          style={{
            border: '1px solid var(--bd)',
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'var(--bg1)',
          }}
        >
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              fontSize: 12,
              lineHeight: 1.5,
              margin: 0,
              color: 'var(--tx2)',
            }}
          >
            {t('hub_lightroom_modal_body')}
          </pre>
          <button
            type="button"
            className="btn ghost"
            data-testid={`${testId}-try-open`}
            style={{ minHeight: 44 }}
            onClick={() => {
              prepare()
              tryOpenLightroomIosApp()
            }}
          >
            {t('lightroom_try_open_app')}
          </button>
          <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', margin: 0, lineHeight: 1.45 }}>
            {t('lightroom_open_failed_hint')}
          </p>
          <a
            href={LIGHTROOM_IOS_APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn ghost sm"
            style={{ minHeight: 40, textAlign: 'center', textDecoration: 'none' }}
            data-testid={`${testId}-app-store`}
          >
            {t('lightroom_app_store')}
          </a>
        </div>
      )}
    </div>
  )
}
