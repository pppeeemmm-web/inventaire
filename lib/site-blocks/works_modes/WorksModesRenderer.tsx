'use client'

import { useWorksRenderCtx } from './WorksRenderCtx'
import WorksModeGallery from '@/components/public/WorksModeGallery'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type WorksModesFields = {
  /** References config.works_modes[].id */
  mode_id: string
  /** Display hints — may be stale if the mode is later renamed via the legacy editor. */
  label_fr?: string
  label_en?: string
  layout?: string
}

export const WORKS_MODES_DEFAULTS: WorksModesFields = {
  mode_id: '',
  label_fr: '',
  label_en: '',
  layout: 'carousel',
}

/**
 * Public works_modes renderer.
 *
 * Reads works + modeMap + siteTheme from WorksRenderCtx (provided by
 * WorksClient). Looks up the mode by fields.mode_id and delegates to
 * WorksModeGallery which contains the full carousel/layout rendering.
 */
export default function WorksModesRenderer({ fields }: BlockRendererProps<WorksModesFields>) {
  const { works, modeMap, siteTheme } = useWorksRenderCtx()
  const mode_id = (fields.mode_id as string | undefined) ?? ''
  const mode = (mode_id ? modeMap.get(mode_id) : undefined) ?? [...modeMap.values()][0]
  if (!mode) return null
  return <WorksModeGallery works={works} mode={mode} siteTheme={siteTheme} />
}
