import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import IdentityRenderer, { IDENTITY_DEFAULTS, type IdentityFields } from './IdentityRenderer'
import IdentityEditor from './IdentityEditor'

/**
 * `identity` — landing page identity block (artist name tagline, contact links).
 *
 * systemManaged = true: auto-generated from config.general; not manually addable.
 * Renderer returns null — / still dispatches via the legacy LandingPage path.
 */
export const identityDescriptor: BlockDescriptor<IdentityFields> = {
  kind: 'identity',
  allowedPages: ['landing'],
  knobFamilies: ['type', 'bg'],
  defaultFields: IDENTITY_DEFAULTS,
  systemManaged: true,
  editor: IdentityEditor,
  renderer: IdentityRenderer,
  migrateFields(raw): IdentityFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      artist_name: typeof r.artist_name === 'string' ? r.artist_name : undefined,
    }
  },
}
