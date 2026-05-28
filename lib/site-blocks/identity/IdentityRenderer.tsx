/**
 * identity public renderer.
 *
 * The / (landing) page still renders via the legacy LandingPage path.
 * Returns null — public routing is unchanged until LandingPage iterates
 * pages.landing via the block registry.
 */

export type IdentityFields = {
  /** Mirrors general.artist_name — display hint for the editor. */
  artist_name?: string
}

export const IDENTITY_DEFAULTS: IdentityFields = {
  artist_name: '',
}

export default function IdentityRenderer(): null {
  return null
}
