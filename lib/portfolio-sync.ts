/**
 * Keeps « Sections Portfolio » and « page /works » (mode 1 collections) aligned when publishing.
 * Pure JSON clones — safe for client + server.
 */

export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

/** Push sidebar sections into works mode 1 + legacy mirror (portfolio blocks drive /works). */
export function syncSectionsToFirstWorksMode<C extends { sections: unknown[]; works_modes: unknown[]; works_collections: unknown[] }>(
  config: C
): C {
  const sections = deepClone(Array.isArray(config.sections) ? config.sections : [])
  const modes = deepClone(Array.isArray(config.works_modes) && config.works_modes.length > 0
    ? config.works_modes
    : [minimalWorksMode()])
  const m0 = modes[0] as Record<string, unknown>
  modes[0] = { ...m0, collections: sections } as (typeof modes)[0]
  return {
    ...config,
    works_modes: modes,
    works_collections: sections as C['works_collections'],
  }
}

/** Push works mode 1 collections into portfolio sections + legacy mirror (/works layout drives portfolio blocks). */
export function syncFirstWorksModeToSections<C extends { sections: unknown[]; works_modes: unknown[]; works_collections: unknown[] }>(
  config: C
): C {
  const modes = deepClone(Array.isArray(config.works_modes) && config.works_modes.length > 0
    ? config.works_modes
    : [minimalWorksMode()])
  const m0 = modes[0] as { collections?: unknown[] }
  const cols = deepClone(Array.isArray(m0.collections) ? m0.collections : [])
  return {
    ...config,
    sections: cols as C['sections'],
    works_collections: cols as C['works_collections'],
    works_modes: modes,
  }
}

function minimalWorksMode() {
  return {
    id: 'default',
    label_fr: 'Œuvres',
    label_en: 'Works',
    is_active: true,
    sort_order: 0,
    collections: [] as unknown[],
    outro_fr: '',
    outro_en: '',
  }
}
