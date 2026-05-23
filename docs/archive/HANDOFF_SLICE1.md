# Slice 1 — PWA / Service Worker handoff

> **ARCHIVED — Slice 1 still open in [`../TODO.md`](../TODO.md).** Reference only; verify against live code before executing.

**Status:** Phase 1 on `main` (local draft until commit). Serwist disabled in `development`; active after `npm run build` + `npm start` or production deploy.

---

## Phase 1 (shipped in code)

| Piece | Role |
|-------|------|
| `@serwist/next` + `app/sw.ts` | Precache manifest, `/hub` + `/~offline`, CacheFirst R2/AVIF, SWR shell pages |
| `lib/sw-install/AtelierSWRegistrar.tsx` | Registers `/sw.js` in production (`hub` + `atelier` layouts) |
| `app/~offline/page.tsx` | Navigation fallback when offline |
| `lib/mobile/offline-work-queue.ts` v2 | IndexedDB queue with **image blobs** + strings |
| `AtelierOfflineFlush` | Replays full `FormData` (including images) via `saveWork` |

---

## Verify (production build)

```powershell
npm run build
npm start
```

1. Chrome DevTools → Application → Service Workers → `/sw.js` activated.
2. Visit `/hub`, then `/atelier/inventory` online.
3. WorkForm: save while offline (DevTools → Network → Offline) → toast `offline_save_queued`.
4. Back online → `offline_sync_done` and row appears.

**Dev:** SW is off (`disable: NODE_ENV === 'development'`). Offline queue still works in dev.

---

## Phase 2 (not in this slice)

- Background Sync on share-receive + queue
- `Cache-Control` on R2 PUT
- `revalidateTag('atelier-shell')` instead of `force-dynamic` on portal pages
- Lighthouse PWA ≥ 90 checklist

---

## Env

No new env vars. Existing PWA manifest: `app/manifest.ts` → `/manifest.webmanifest`.
