/**
 * `general.instagram` from the Site module may be a handle (« pem », « @pem ») or a
 * profile URL. Returns the profile URL + the « @handle » to display, or null.
 */
export function instagramProfile(raw: string | null | undefined): { url: string; handle: string } | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  const fromUrl = v.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)/i)
  const handle = (fromUrl ? fromUrl[1] : v.replace(/^@/, '')).trim()
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null
  return { url: `https://www.instagram.com/${handle}/`, handle: `@${handle}` }
}
