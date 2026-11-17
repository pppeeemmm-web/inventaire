/**
 * Work rule checks (docs/WORK_RULES.md §2) — the same checks as supabase/sql/work_rules_checks.sql,
 * evaluated on rows read through the API so the Audit « Règles » panel can run them without new SQL.
 * Keep the two in step: a rule changed there is changed here in the same commit.
 * Pure: the caller reads the rows (app/atelier/(portal)/audit/rules-actions.ts).
 */

export const PEM_CONTACT = 13
const CATALOGUER = 9
const PHOTOGRAPHIER = 6
/** Batch 1 went live on this day: rule 7 is checked from then on (older days unknown). */
export const RULES_LIVE_SINCE = '2026-11-17T00:00:00+01:00'
/** Rule 14 from the next day: the 17 Nov repair of #2381 put its Historique back on purpose. */
export const HISTORY_CHECK_SINCE = '2026-11-18T00:00:00+01:00'

/** Rules that hold state the checks can read. 1, 11, 15, 16 have none (see the SQL file). */
export const CHECKED_RULES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', '12', '13', '14'] as const
export type CheckedRule = (typeof CHECKED_RULES)[number]

export type RuleBreak = {
  rule: CheckedRule
  oeuvreId: number
  titre: string | null
  /** Message key (work-rules.messages.ts); `arg` fills its `{x}`. */
  code: string
  arg?: string
}

export type CheckWork = {
  OeuvreID: number
  Titre: string | null
  statusId: number | null
  Catalogué: boolean | null
  NeedsPhotograph: boolean | null
  fate: string | null
  ContactID: number | null
  LocalisationID: number | null
  localisation_address_id: number | null
  production_completed_on: string | null
  is_public: boolean | null
}

export type CheckTask = {
  id: number
  oeuvre_id: number
  action_type_id: number
  done: boolean
  done_at: string | null
  paused_at: string | null
  created_at: string
}

export type CheckOrderLine = { oeuvre_id: number; kind: string; status: string; party_id: number | null; line_status: string }

export type CheckStatusEvent = { oeuvre_id: number; created_at: string; old_value: unknown; new_value: unknown }

export type CheckInput = {
  works: CheckWork[]
  /** Tasks not done, plus done tasks with no date created since RULES_LIVE_SINCE. */
  tasks: CheckTask[]
  worksWithPhoto: Set<number>
  /** address id → contact id */
  addressOwner: Map<number, number>
  /** `${oeuvreId}:${kind}` → the database's `oeuvre_order_exists` answer (kinds entrusted / custody / paid). */
  orderExists: Map<string, boolean>
  orderLines: CheckOrderLine[]
  /** work id → kinds of its open destroyed / lost reports */
  openFateReports: Map<number, Set<string>>
  statusEvents: CheckStatusEvent[]
  historiqueById: Map<number, string | null>
}

const ready = (w: CheckWork) => !!w.Catalogué && !w.NeedsPhotograph

/** Paris calendar day of a timestamp, as YYYY/MM/DD (the Historique date form). */
export function parisDaySlash(iso: string): string {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  return parts.replace(/-/g, '/')
}

function openFateOrder(l: CheckOrderLine): boolean {
  if (l.line_status !== 'active') return false
  if (l.kind === 'sale') return ['draft', 'signed', 'deposit_paid'].includes(l.status)
  if (l.kind === 'gift') return ['draft', 'signed'].includes(l.status)
  if (l.kind === 'consignment' || l.kind === 'loan') return ['draft', 'signed', 'out'].includes(l.status)
  if (l.kind === 'entrusted') return ['draft', 'out'].includes(l.status)
  return false
}

export function evaluateWorkRules(input: CheckInput): RuleBreak[] {
  const out: RuleBreak[] = []
  const open = new Map<number, CheckTask[]>()
  for (const tk of input.tasks) {
    if (tk.done) continue
    const list = open.get(tk.oeuvre_id) ?? []
    list.push(tk)
    open.set(tk.oeuvre_id, list)
  }
  const linesByWork = new Map<number, CheckOrderLine[]>()
  for (const l of input.orderLines) {
    const list = linesByWork.get(l.oeuvre_id) ?? []
    list.push(l)
    linesByWork.set(l.oeuvre_id, list)
  }
  const add = (rule: CheckedRule, w: CheckWork, code: string, arg?: string) =>
    out.push({ rule, oeuvreId: w.OeuvreID, titre: w.Titre, code, arg })

  for (const w of input.works) {
    const cat = !!w.Catalogué
    const photo = !!w.NeedsPhotograph
    const s = w.statusId
    const tasks = open.get(w.OeuvreID) ?? []
    const openOf = (type: number) => tasks.some((tk) => tk.action_type_id === type)
    const owner = w.ContactID ?? PEM_CONTACT
    const holder = w.LocalisationID ?? PEM_CONTACT

    // 2 — catalogued needs a photo
    if (cat && !input.worksWithPhoto.has(w.OeuvreID)) add('2', w, 'wr_b_no_photo')
    // 3 — Disponible needs the photo validated
    if (s === 2 && !ready(w)) add('3', w, 'wr_b_not_ready')
    // 4 — Archive: catalogued, tasks paused
    if (s === 3 && !cat) add('4', w, 'wr_b_archive_not_catalogued')
    else if (s === 3 && tasks.some((tk) => !tk.paused_at)) add('4', w, 'wr_b_archive_open_task')
    // 5 — studio status follows the stage
    if (w.fate == null && (s === 1 || s === 2)) {
      const want = ready(w) ? 2 : 1
      if (s !== want) add('5', w, 'wr_b_status_stage', `${s} → ${want}`)
    }
    // 6 — tasks follow the stage
    if (!cat && !openOf(CATALOGUER)) add('6', w, 'wr_b_no_catalogue_task')
    else if (cat && openOf(CATALOGUER)) add('6', w, 'wr_b_catalogue_task_open')
    else if (cat && photo && !openOf(PHOTOGRAPHIER)) add('6', w, 'wr_b_no_photo_task')
    else if (!(cat && photo) && openOf(PHOTOGRAPHIER)) add('6', w, 'wr_b_photo_task_open')
    // 8 — an end of production only on a Prêt work
    if (w.production_completed_on && !ready(w)) add('8', w, 'wr_b_end_not_ready', w.production_completed_on.slice(0, 10))
    // 9 — owner / custodian / address follow the stage
    if (s != null && [1, 2, 3, 4].includes(s) && owner !== PEM_CONTACT) add('9', w, 'wr_b_owner_not_pem')
    else if (s != null && [1, 2, 3].includes(s) && holder !== PEM_CONTACT && !input.orderExists.get(`${w.OeuvreID}:entrusted`)) add('9', w, 'wr_b_held_elsewhere')
    else if ((s === 7 || s === 8) && owner !== PEM_CONTACT) add('9', w, 'wr_b_custody_owner')
    else if ((s === 7 || s === 8) && holder === PEM_CONTACT) add('9', w, 'wr_b_no_custodian')
    else if ((s === 6 || s === 11) && owner === PEM_CONTACT) add('9', w, 'wr_b_owner_is_pem')
    else if (w.localisation_address_id != null && input.addressOwner.get(w.localisation_address_id) !== w.LocalisationID) add('9', w, 'wr_b_address')
    // 10 — leaves Pem only through an order
    if ((s === 7 || s === 8) && !input.orderExists.get(`${w.OeuvreID}:custody`)) add('10', w, 'wr_b_no_custody_order')
    else if (s === 6 && !input.orderExists.get(`${w.OeuvreID}:paid`)) add('10', w, 'wr_b_no_paid_sale')
    else if (s === 11 && !(linesByWork.get(w.OeuvreID) ?? []).some((l) => l.kind === 'gift' && l.party_id === w.ContactID && l.status !== 'cancelled')) add('10', w, 'wr_b_no_gift_order')
    // 12 — destroyed / lost through a constat; tasks closed / paused; orders closed
    if ((s === 9 || s === 10) && w.fate == null) add('12', w, 'wr_b_fate_no_report')
    else if (w.fate != null && !input.openFateReports.get(w.OeuvreID)?.has(w.fate)) add('12', w, 'wr_b_fate_report_missing')
    else if (w.fate != null && tasks.some((tk) => !tk.paused_at)) add('12', w, 'wr_b_fate_task_active')
    else if (w.fate != null && (linesByWork.get(w.OeuvreID) ?? []).some(openFateOrder)) add('12', w, 'wr_b_fate_order_open')
    // 13 — public = 2, 4, 6, 7, 8, 11 with no fate
    const shouldBePublic = s != null && [2, 4, 6, 7, 8, 11].includes(s) && w.fate == null
    if (!!w.is_public !== shouldBePublic) add('13', w, w.is_public ? 'wr_b_public_wrongly' : 'wr_b_not_public')
  }

  // 7 — a ticked task keeps its day (tasks created since the rule went live)
  const byId = new Map(input.works.map((w) => [w.OeuvreID, w]))
  const since = Date.parse(RULES_LIVE_SINCE)
  for (const tk of input.tasks) {
    if (!tk.done || tk.done_at || Date.parse(tk.created_at) < since) continue
    const w = byId.get(tk.oeuvre_id)
    if (w) add('7', w, 'wr_b_tick_undated', `#${tk.id}`)
  }

  // 14 — every status change has its dated Historique line (destroyed / lost / found dated at the event)
  const historySince = Date.parse(HISTORY_CHECK_SINCE)
  for (const e of input.statusEvents) {
    if (Date.parse(e.created_at) < historySince) continue
    const w = byId.get(e.oeuvre_id)
    if (!w) continue
    const a = String(e.old_value ?? '')
    const b = String(e.new_value ?? '')
    if (['9', '10'].includes(a) || ['9', '10'].includes(b)) continue
    const day = parisDaySlash(e.created_at)
    if (!(input.historiqueById.get(e.oeuvre_id) ?? '').includes(day)) add('14', w, 'wr_b_status_no_line', day)
  }

  return out
}
