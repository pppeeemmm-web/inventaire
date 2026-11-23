import { listStep, type ChannelKnobs } from './params'

// Reverse pricing: from the net the studio wants to keep back to the list price per channel.
//   K = costs (direct + running share + channel cost)
//   floor price paid P = (N + K) / ((1 − c)(1 − r))     list needed L = P / (1 − d)
//   wholesale W = (N + K) / (1 − r)                      (no commission, no discount)
// Pure and read-only: nothing here writes (docs/design/2026-11-23/ReversePricing.md §3).

export type ReverseRow = {
  id: ChannelKnobs['id']
  /** All costs for this channel, €. */
  cost: number
  /** Lowest price the buyer may pay and still leave the net wanted, €. */
  floor: number
  /** List price needed so the discount can be given, €. */
  listNeeded: number
  /** listNeeded rounded up (10 € / 50 €). */
  listRounded: number
  /** The list price used for « net kept »: the shared one, or this channel's own. */
  list: number
  /** Net kept at `list`, €. */
  netKept: number
  /** Largest discount (%) at `list` that still leaves the net wanted. */
  maxDiscount: number
}

export type ReverseResult = {
  rows: ReverseRow[]
  /** The dearest channel's rounded list (the one price), or 0 when no channel can be computed. */
  listOne: number
  /** Price to sell outright to a gallery (no commission, no discount), using the gallery's channel cost; null when none. */
  wholesale: number | null
}

export function roundUpList(n: number): number {
  const st = listStep(n)
  return Math.ceil(n / st - 1e-9) * st
}

export function reversePrice(opts: {
  /** Net wanted, €. */
  net: number
  /** Social contributions rate, 0–1. */
  contributions: number
  /** Direct costs of the work (spent and planned), €. */
  direct: number
  /** Share of running costs, €. */
  running: number
  channels: readonly ChannelKnobs[]
  /** True: one list price for every channel (the dearest channel sets it). */
  onePrice: boolean
}): ReverseResult {
  const { net, contributions: r, direct, running, channels, onePrice } = opts
  const base = direct + running
  const usable = (c: ChannelKnobs) => (1 - c.c / 100) * (1 - r) > 0 && c.d < 100
  const partial = channels.map((ch) => {
    const cost = base + ch.x
    if (!usable(ch)) return { ch, cost, floor: NaN, listNeeded: NaN, listRounded: NaN }
    const floor = (net + cost) / ((1 - ch.c / 100) * (1 - r))
    const listNeeded = floor / (1 - ch.d / 100)
    return { ch, cost, floor, listNeeded, listRounded: roundUpList(listNeeded) }
  })
  const finite = partial.map((p) => p.listRounded).filter(Number.isFinite)
  const listOne = finite.length ? Math.max(...finite) : 0
  const rows: ReverseRow[] = partial.map((p) => {
    const list = onePrice ? listOne : p.listRounded
    const ok = Number.isFinite(p.floor) && list > 0
    return {
      id: p.ch.id,
      cost: p.cost,
      floor: p.floor,
      listNeeded: p.listNeeded,
      listRounded: p.listRounded,
      list: ok ? list : NaN,
      netKept: ok ? list * (1 - p.ch.d / 100) * (1 - p.ch.c / 100) * (1 - r) - p.cost : NaN,
      maxDiscount: ok ? (1 - p.floor / list) * 100 : NaN,
    }
  })
  const g = channels.find((c) => c.id === 'gallery')
  const wholesale = g && 1 - r > 0 ? (net + base + g.x) / (1 - r) : null
  return { rows, listOne, wholesale }
}
