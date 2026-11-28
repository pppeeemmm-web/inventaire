/**
 * Spoken equipment list → named lines, on the studio PC (Stock › Équipement « Dire »).
 * Asks the local Ollama model to name the objects and counts from the dictated text. Nothing leaves the PC.
 * The result is a SUGGESTION the screen shows for the user to confirm.
 *   node scripts/ai-agent/equipment.mjs --try "deux escabeaux et un perforateur"   print the result, write nothing
 */
import { fileURLToPath } from 'node:url'
import { ollamaBaseUrl } from '../embed-worker/ollama-client.mjs'

const TIMEOUT_MS = 120_000
const MAX_TEXT = 4000
const MAX_LINES = 60

const SYSTEM = `You list studio equipment from a spoken inventory walk. Return JSON {"lines":[{"name":string,"quantity":integer}]} — one line per distinct object, name short and singular in the language spoken (French or English), quantity from the words (« deux », « trois », « a pair » = 2…) else 1. No commentary, no objects that were not said.`

/** Name the equipment lines of a spoken text. Returns { lines, model } or throws. */
export async function nameEquipmentLines(payload) {
  const text = typeof payload?.text === 'string' ? payload.text.trim() : ''
  if (!text) throw new Error('empty')
  const model = process.env.AI_EQUIPMENT_MODEL || 'gemma3:4b'
  const res = await fetch(`${ollamaBaseUrl()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      options: { temperature: 0 },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text.slice(0, MAX_TEXT) },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const body = await res.json()
  let j
  try {
    j = JSON.parse(body?.message?.content ?? '')
  } catch {
    throw new Error(`model answer is not JSON: ${String(body?.message?.content ?? '').slice(0, 200)}`)
  }
  const lines = (Array.isArray(j?.lines) ? j.lines : [])
    .map((l) => {
      const name = typeof l?.name === 'string' ? l.name.trim().slice(0, 120) : ''
      const q = l?.quantity
      return { name, quantity: Number.isInteger(q) && q >= 1 && q <= 999 ? q : 1 }
    })
    .filter((l) => l.name)
    .slice(0, MAX_LINES)
  return { lines, model }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const at = process.argv.indexOf('--try')
  if (at > -1) {
    console.log(JSON.stringify(await nameEquipmentLines({ text: process.argv[at + 1] }), null, 1))
  }
}
