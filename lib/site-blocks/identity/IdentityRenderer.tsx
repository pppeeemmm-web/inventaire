'use client'

import Link from 'next/link'
import { useLandingHeroCtx } from '@/lib/site-blocks/hero/LandingHeroCtx'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type IdentityFields = {
  /** Mirrors general.artist_name — display hint for the editor. */
  artist_name?: string
}

export const IDENTITY_DEFAULTS: IdentityFields = {
  artist_name: '',
}

/**
 * Public landing identity renderer.
 *
 * Renders inside the <h1 className="wordmark"> in LandingPage, which provides
 * LandingHeroCtx. Block field artist_name overrides the context fallback.
 * Outputs a Link so the wordmark remains a home anchor.
 */
export default function IdentityRenderer({ fields }: BlockRendererProps<IdentityFields>) {
  const ctx = useLandingHeroCtx()
  const name = (fields.artist_name as string | undefined)?.trim() || ctx.artistName
  return <Link href="/">{name}</Link>
}
