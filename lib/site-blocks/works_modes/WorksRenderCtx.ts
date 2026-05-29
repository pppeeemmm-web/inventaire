'use client'

/**
 * React context threaded through WorksClient so WorksModesRenderer can access
 * works data + mode lookup + site theme without prop-drilling through BlockRendererProps.
 *
 * Provider: components/public/WorksClient.tsx
 * Consumer: lib/site-blocks/works_modes/WorksModesRenderer.tsx
 */

import { createContext, useContext } from 'react'
import type { Work, WorksMode } from '@/components/public/works-utils'
import type { PublicSiteTheme } from '@/lib/public-site-theme'

export interface WorksRenderCtxValue {
  works: Work[]
  modeMap: Map<string, WorksMode>
  siteTheme: PublicSiteTheme
}

export const WorksRenderCtx = createContext<WorksRenderCtxValue | null>(null)

export function useWorksRenderCtx(): WorksRenderCtxValue {
  const v = useContext(WorksRenderCtx)
  if (!v) throw new Error('useWorksRenderCtx: must be inside WorksClient')
  return v
}
