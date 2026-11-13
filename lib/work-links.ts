/**
 * Work ↔ work relation types written by hand (tblrelations, both ends are works). Drawer links
 * (owner, "Work or version": painted on / derived from / answers) + the Constellation's types.
 * Browser-safe.
 */
export const WORK_LINK_TYPES = ['painted_on', 'derived_from', 'answers', 'series', 'diptych', 'influence', 'proximity'] as const
export type WorkLinkType = (typeof WORK_LINK_TYPES)[number]
