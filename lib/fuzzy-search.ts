import Fuse, { type IFuseOptions } from 'fuse.js'

const DEFAULT_FUZZY_OPTIONS = {
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
  shouldSort: true,
  threshold: 0.36,
} satisfies IFuseOptions<unknown>

export function fuzzySearch<T>(
  items: readonly T[],
  query: string,
  options: IFuseOptions<T>,
): T[] {
  const trimmed = query.trim()
  if (!trimmed) return [...items]

  const fuse = new Fuse([...items], {
    ...DEFAULT_FUZZY_OPTIONS,
    ...options,
  })

  return fuse.search(trimmed).map((result) => result.item)
}
