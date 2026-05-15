/**
 * Make/n8n ↔ `/api/inventory/broadcast/*` contract (v1).
 * Gate: do not add triage DB columns until external automation matches this shape.
 *
 * **POST /api/inventory/broadcast/queue** (Bearer `INVENTORY_BROADCAST_SECRET`)
 * Body: `{ oeuvreId: number, platform: string }` — platform = alphanumeric slug (instagram, linkedin, …).
 * Response: `{ id, oeuvre_id, platform, status: 'queued', queued_at, attempt_count }`.
 *
 * **POST /api/inventory/broadcast/confirm**
 * Body: `{ oeuvreId, platform, externalPostId?, externalUrl?, captionFinal?, metadata? }`.
 * Marks `oeuvre_broadcasts.status = 'posted'`.
 *
 * **GET /api/inventory/broadcast/feed** — eligible public works + caption seed for SM drafting.
 *
 * **POST /api/inventory/broadcast/event** — append `broadcast_events` (vip | normal).
 */

export type BroadcastQueueRequest = {
  oeuvreId: number
  platform: string
}

export type BroadcastConfirmRequest = {
  oeuvreId: number
  platform: string
  externalPostId?: string | null
  externalUrl?: string | null
  captionFinal?: string | null
  metadata?: Record<string, unknown> | null
}
