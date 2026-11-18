// Old Studio Bible download URL (bookmarks, old links). The Studio Bible and the two HTML guides were retired for
// the in-app Aide (batch 6, Pem GO 2026-11-18): send the visitor there; middleware asks for a login if needed.
// Relative Location: `req.url` can carry the server's bind host (0.0.0.0 in dev), not the visitor's.
// 307, not 308: browsers cache a permanent redirect for good.
export function GET() {
  return new Response(null, { status: 307, headers: { Location: '/atelier/aide' } })
}
