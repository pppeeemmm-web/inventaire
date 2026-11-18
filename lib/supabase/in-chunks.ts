// A `.in(column, ids)` read over a long id list, in chunks. PostgREST puts the list in the URL: a few
// hundred uuids pass the server's limit and the read fails with « URI too long » (stress test
// 2026-11-18, B5 — the Sales tab stopped loading at about 200 orders).

/** Rows of `run(chunk)` for every chunk of `ids` (100 by default), concatenated in chunk order. */
export async function inChunks<T, I extends string | number>(
  ids: readonly I[],
  run: (chunk: I[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 100,
): Promise<{ data: T[]; error: { message: string } | null }> {
  if (ids.length === 0) return { data: [], error: null }
  const chunks: I[][] = []
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size))
  const res = await Promise.all(chunks.map((c) => run(c)))
  return { data: res.flatMap((r) => r.data ?? []), error: res.find((r) => r.error)?.error ?? null }
}
