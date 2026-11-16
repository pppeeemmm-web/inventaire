import 'server-only'
import type { OpenReadBundle, OpenReadSlice } from '@/lib/atelier/open-read-keys'

/**
 * Run named reads in parallel and return one result per slice (TODO 18). Next.js runs a page's
 * client-called Server Actions one at a time, so a screen that opens with 8 small reads waited for
 * each in turn; one action that awaits them together costs the slowest one.
 *
 * Each read is an existing Server Action called as a plain function: its own auth guard
 * (`guardTeam`, `is_admin()`, `auth.getUser()`) still runs inside. A read that throws becomes
 * `{ ok: false }`; the client section then calls that action itself, so its error shows as before.
 */
export async function runOpenReads(jobs: [key: string, read: () => Promise<unknown>][]): Promise<OpenReadBundle> {
  const done = await Promise.all(
    jobs.map(async ([key, read]): Promise<[string, OpenReadSlice]> => {
      try {
        return [key, { ok: true, v: await read() }]
      // eslint-disable-next-line pem-i18n/no-silent-catch -- not silent: the client section re-runs this action and reports its error
      } catch (err) {
        // The section retries this read on its own and reports the error there.
        console.warn(`[open-read] ${key} failed; the section will read it again`, err)
        return [key, { ok: false }]
      }
    }),
  )
  return Object.fromEntries(done)
}
