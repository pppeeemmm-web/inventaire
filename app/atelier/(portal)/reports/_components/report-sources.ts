// Report sources (owner 2026-11-02): each section's rows and the fields a report can show,
// filter and sort. Field ids are stored in saved reports — rename only with a config migration.

import type { DictKey } from '@/lib/i18n/dictionary'
import type { Oeuvre } from '@/lib/types/database'
import type { KaizenItem } from '@/lib/kaizen'
import { ACTION_STATUS_KEY, GRADE_KEY, type ConditionReport } from '@/lib/condition'
import type { SaleOrderRow } from '@/app/atelier/(portal)/sales/actions'
import type { ReportContactRow } from '@/app/atelier/(portal)/reports/source-actions'
import { yearOf } from '@/lib/data'
import type { ReportConfig, ReportField } from '@/lib/reports/engine'
import { REPORT_COLUMN_HEADER_KEY, formatReportCell, type ReportMaps } from '@/lib/reports/works-table'
import type { ReportSource } from '@/lib/reports/saved-report'
import { effectivePeriod, placeLabel, workWhen, type PeriodSourceData } from '@/lib/work-periods'
import type { DescriptionRating } from '@/app/atelier/works/description-actions'

export type SaleRow = { o: Oeuvre; order: SaleOrderRow | null }

export type SourceCtx = {
  t: (k: DictKey) => string
  locale: string
  maps: ReportMaps
  pendingActions: Map<number, string[]>
  kaizenNames: Record<string, string>
  conditionNames: Record<string, string>
  worksById: Map<number, Oeuvre>
  worksByBuyer: Map<number, number>
  worksAtLocation: Map<number, number>
  periodSource: PeriodSourceData
  /** Latest AI description's usefulness per work (A2); empty until loaded. */
  aiRatings: Record<number, DescriptionRating>
}

export type SourceDef<R> = {
  id: ReportSource
  fields: ReportField<R>[]
  defaults: ReportConfig
  rowKey: (r: R) => string | number
}

export const SOURCE_LABEL: Record<ReportSource, DictKey> = {
  works: 'report_source_works',
  production: 'report_source_production',
  constats: 'report_source_constats',
  kaizen: 'report_source_kaizen',
  sales: 'report_source_sales',
  contacts: 'report_source_contacts',
}

export const SOURCE_HINT: Record<ReportSource, DictKey> = {
  works: 'report_source_works_hint',
  production: 'report_source_production_hint',
  constats: 'report_source_constats_hint',
  kaizen: 'report_source_kaizen_hint',
  sales: 'report_source_sales_hint',
  contacts: 'report_source_contacts_hint',
}

const ORDER_STATUS_KEY: Record<string, DictKey> = {
  draft: 'report_v_order_draft',
  confirmed: 'report_v_order_confirmed',
  deposit_paid: 'report_v_order_deposit_paid',
  completed: 'report_v_order_completed',
  cancelled: 'report_v_order_cancelled',
}

function config(fields: string[], sortField: string, dir: 'asc' | 'desc' = 'desc'): ReportConfig {
  return { fields, filters: {}, sort: { field: sortField, dir }, q: '', pivot: false }
}

function money(n: number | null | undefined, locale: string): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n))
}

function day(iso: string | null | undefined, locale: string): string {
  return iso ? new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(locale) : '—'
}

const orNull = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null)

/** Works fields — shared by Œuvres, Production (plus its steps) and, in part, Ventes. */
function workFields(c: SourceCtx): ReportField<Oeuvre>[] {
  const { t, maps, locale } = c
  const h = (k: keyof typeof REPORT_COLUMN_HEADER_KEY) => t(REPORT_COLUMN_HEADER_KEY[k])
  const cell = (o: Oeuvre, k: keyof typeof REPORT_COLUMN_HEADER_KEY) => formatReportCell(o, k, maps, locale)
  return [
    { id: 'id', label: h('id'), kind: 'number', value: (o) => o.OeuvreID },
    { id: 'title', label: h('title'), kind: 'text', value: (o) => orNull(o.Titre) },
    { id: 'year', label: h('year'), kind: 'number', value: (o) => yearOf(o.Année) ?? null },
    { id: 'technique', label: h('technique'), kind: 'enum', value: (o) => (o.Technique != null ? orNull(maps.tM[o.Technique]) : null) },
    { id: 'support', label: h('support'), kind: 'enum', value: (o) => (o.Support != null ? orNull(maps.sM[o.Support]) : null) },
    { id: 'format', label: h('format'), kind: 'enum', value: (o) => (o.Format != null ? orNull(maps.fM[o.Format]) : null) },
    { id: 'dimensions', label: h('dimensions'), kind: 'text', value: (o) => cell(o, 'dimensions') },
    {
      id: 'price',
      label: h('price'),
      kind: 'number',
      sum: true,
      value: (o) => (o.PrixFinal ?? o.Prix ?? null) as number | null,
      display: (o) => money(o.PrixFinal ?? o.Prix, locale),
    },
    { id: 'status', label: h('status'), kind: 'enum', value: (o) => (o.statusId != null ? orNull(maps.statusLabelMap[o.statusId]) : null) },
    { id: 'contact', label: h('contact'), kind: 'enum', value: (o) => (o.ContactID != null ? orNull(maps.cM[o.ContactID]) : null) },
    { id: 'buyer', label: h('buyer'), kind: 'enum', value: (o) => (o.AcheteurID != null ? orNull(maps.cM[o.AcheteurID]) : null) },
    { id: 'location', label: h('location'), kind: 'text', value: (o) => cell(o, 'location') },
    {
      id: 'themes',
      label: h('themes'),
      kind: 'multi',
      value: (o) => (maps.oeuvreThemeMap.get(o.OeuvreID) ?? []).map((id) => maps.thM[id]).filter(Boolean),
    },
    {
      id: 'groups',
      label: h('groups'),
      kind: 'multi',
      value: (o) => (maps.oeuvreGroupMap.get(o.OeuvreID) ?? []).map((id) => maps.groupNameMap[id]).filter(Boolean),
    },
    {
      id: 'period',
      label: t('ps_period'),
      kind: 'enum',
      value: (o) => effectivePeriod(o.OeuvreID, workWhen(o), c.periodSource).period?.name ?? null,
    },
    {
      // A3: the place the work was made (empty = not set; a period's suggestion is not counted).
      id: 'place_made',
      label: t('ps_place_made'),
      kind: 'enum',
      value: (o) => {
        const pid = c.periodSource.workPlaces[o.OeuvreID]
        const pl = pid != null ? c.periodSource.places.find((x) => x.id === pid) : undefined
        return pl ? placeLabel(pl) : null
      },
    },
    {
      id: 'sources',
      label: t('ps_source'),
      kind: 'multi',
      value: (o) =>
        (c.periodSource.sourcesByWork[o.OeuvreID] ?? [])
          .map((id) => c.periodSource.sources.find((s) => s.id === id)?.name)
          .filter((x): x is string => !!x),
    },
    {
      id: 'source_notes',
      label: t('ps_report_source_notes'),
      kind: 'text',
      value: (o) => {
        const notes = c.periodSource.sourceNotes[o.OeuvreID] ?? {}
        const parts = Object.entries(notes).map(
          ([sid, note]) => `${c.periodSource.sources.find((s) => s.id === Number(sid))?.name ?? '?'} : ${note}`,
        )
        return parts.length ? parts.join(' · ') : null
      },
    },
    { id: 'catalogued', label: h('catalogued'), kind: 'bool', value: (o) => !!o.Catalogué },
    { id: 'needs_photo', label: t('report_f_needs_photo'), kind: 'bool', value: (o) => !!o.NeedsPhotograph },
    { id: 'exposable', label: h('exposable'), kind: 'bool', value: (o) => !!o.Exposable },
    { id: 'delivery', label: t('report_f_delivery'), kind: 'date', value: (o) => o.DateLivraison ?? null, display: (o) => day(o.DateLivraison, locale) },
    { id: 'notes', label: h('notes'), kind: 'text', value: (o) => orNull((o.Commentaires ?? '').replace(/\s+/g, ' ').slice(0, 500)) },
    // A2: 0 useless … 4 spot on; empty = never described or not yet judged.
    { id: 'ai_usefulness', label: t('wd_report_field'), kind: 'number', value: (o) => c.aiRatings[o.OeuvreID]?.usefulness ?? null },
  ]
}

function worksSource(c: SourceCtx): SourceDef<Oeuvre> {
  return {
    id: 'works',
    fields: workFields(c),
    defaults: config(['id', 'title', 'year', 'technique', 'support', 'dimensions', 'price', 'status', 'themes'], 'id'),
    rowKey: (o) => o.OeuvreID,
  }
}

function productionSource(c: SourceCtx): SourceDef<Oeuvre> {
  const fields = workFields(c)
  const at = fields.findIndex((f) => f.id === 'status') + 1
  fields.splice(at, 0, {
    id: 'steps',
    label: c.t('report_f_steps'),
    kind: 'multi',
    value: (o) => c.pendingActions.get(o.OeuvreID) ?? [],
  })
  return {
    id: 'production',
    fields,
    defaults: config(['id', 'title', 'year', 'technique', 'support', 'dimensions', 'status', 'steps'], 'id'),
    rowKey: (o) => o.OeuvreID,
  }
}

function constatsSource(c: SourceCtx): SourceDef<ConditionReport> {
  const { t, locale, maps } = c
  const work = (r: ConditionReport) => c.worksById.get(r.oeuvre_id)
  const who = (r: ConditionReport) => orNull(r.examiner) ?? (r.author_id ? c.conditionNames[r.author_id] ?? null : null)
  return {
    id: 'constats',
    fields: [
      { id: 'examined_on', label: t('report_f_examined_on'), kind: 'date', value: (r) => r.examined_on, display: (r) => day(r.examined_on, locale) },
      { id: 'work_id', label: t('report_col_id'), kind: 'number', value: (r) => r.oeuvre_id },
      { id: 'work_title', label: t('report_col_title'), kind: 'text', value: (r) => orNull(work(r)?.Titre) },
      {
        id: 'technique',
        label: t('report_col_technique'),
        kind: 'enum',
        value: (r) => {
          const tech = work(r)?.Technique
          return tech != null ? orNull(maps.tM[tech]) : null
        },
      },
      { id: 'examiner', label: t('report_f_examiner'), kind: 'enum', value: who },
      { id: 'grade', label: t('report_f_grade'), kind: 'enum', value: (r) => (r.grade ? t(GRADE_KEY[r.grade]) : null) },
      { id: 'notes', label: t('report_col_notes'), kind: 'text', value: (r) => orNull(r.notes) },
      { id: 'action', label: t('report_f_action'), kind: 'text', value: (r) => orNull(r.action) },
      { id: 'action_status', label: t('report_f_action_status'), kind: 'enum', value: (r) => t(ACTION_STATUS_KEY[r.action_status]) },
      { id: 'issues_count', label: t('report_f_issues_count'), kind: 'number', sum: true, value: (r) => r.issues.length },
      {
        id: 'issues',
        label: t('report_f_issues'),
        kind: 'text',
        value: (r) => orNull(r.issues.map((i) => (i.location ? `${i.description} (${i.location})` : i.description)).join(' · ')),
      },
      { id: 'photos', label: t('report_f_photos'), kind: 'number', sum: true, value: (r) => r.issues.filter((i) => i.photo_key).length },
      {
        id: 'status',
        label: t('report_col_status'),
        kind: 'enum',
        value: (r) => {
          const sid = work(r)?.statusId
          return sid != null ? orNull(maps.statusLabelMap[sid]) : null
        },
      },
      {
        id: 'location',
        label: t('report_col_location'),
        kind: 'text',
        value: (r) => {
          const o = work(r)
          return o ? formatReportCell(o, 'location', maps, locale) : null
        },
      },
    ],
    defaults: config(['examined_on', 'work_id', 'work_title', 'grade', 'action_status', 'action', 'issues_count'], 'examined_on'),
    rowKey: (r) => r.id,
  }
}

function kaizenSource(c: SourceCtx): SourceDef<KaizenItem> {
  const { t, locale } = c
  const who = (id: string | null) => (id ? c.kaizenNames[id] ?? t('kaizen_unknown_author') : null)
  const section = (i: KaizenItem) =>
    i.section === 'creation'
      ? t('kaizen_section_creation')
      : i.section === 'website'
        ? t('kaizen_section_website')
        : i.section === 'business'
          ? t('kaizen_section_business')
          : t('report_v_to_confirm')
  return {
    id: 'kaizen',
    fields: [
      { id: 'id', label: t('report_col_id'), kind: 'number', value: (i) => i.id },
      { id: 'title', label: t('report_f_kaizen_title'), kind: 'text', value: (i) => i.title },
      { id: 'body', label: t('report_f_kaizen_body'), kind: 'text', value: (i) => orNull(i.body) },
      { id: 'section', label: t('report_f_kaizen_section'), kind: 'enum', value: section },
      { id: 'state', label: t('report_f_kaizen_state'), kind: 'enum', value: (i) => (i.done_at ? t('report_v_done') : t('report_v_live')) },
      { id: 'author', label: t('report_f_author'), kind: 'enum', value: (i) => who(i.author_id) },
      { id: 'created', label: t('report_f_created'), kind: 'date', value: (i) => i.created_at, display: (i) => day(i.created_at, locale) },
      { id: 'done_at', label: t('report_f_done_at'), kind: 'date', value: (i) => i.done_at, display: (i) => day(i.done_at, locale) },
      { id: 'done_by', label: t('report_f_done_by'), kind: 'enum', value: (i) => who(i.done_by) },
      { id: 'works', label: t('report_f_works'), kind: 'multi', value: (i) => i.work_ids.map((w) => `#${w}`) },
    ],
    defaults: config(['title', 'section', 'state', 'author', 'created', 'works'], 'created'),
    rowKey: (i) => i.id,
  }
}

function salesSource(c: SourceCtx): SourceDef<SaleRow> {
  const { t, locale, maps } = c
  const base = workFields(c)
  const pick = (id: string): ReportField<SaleRow> => {
    const f = base.find((x) => x.id === id)!
    return { ...f, value: (r) => f.value(r.o), display: f.display ? (r) => f.display!(r.o) : undefined }
  }
  const buyerId = (r: SaleRow) => r.order?.buyer_id ?? r.o.AcheteurID ?? null
  const finalPrice = (r: SaleRow) => (r.order?.prix_final ?? r.o.PrixFinal ?? null) as number | null
  const cataloguePrice = (r: SaleRow) => (r.order?.prix_catalogue ?? r.o.Prix ?? null) as number | null
  const delivery = (r: SaleRow) => r.order?.delivery_date ?? r.o.DateLivraison ?? null
  const paid = (r: SaleRow) =>
    r.order?.payments?.length ? r.order.payments.reduce((s, p) => s + Number(p.amount || 0), 0) : null
  return {
    id: 'sales',
    fields: [
      pick('id'),
      pick('title'),
      pick('year'),
      pick('technique'),
      pick('status'),
      {
        id: 'buyer',
        label: t('report_col_buyer'),
        kind: 'enum',
        value: (r) => {
          const id = buyerId(r)
          return id != null ? orNull(maps.cM[id]) : null
        },
      },
      { id: 'price_catalogue', label: t('report_f_price_catalogue'), kind: 'number', sum: true, value: cataloguePrice, display: (r) => money(cataloguePrice(r), locale) },
      { id: 'price_final', label: t('report_f_price_final'), kind: 'number', sum: true, value: finalPrice, display: (r) => money(finalPrice(r), locale) },
      { id: 'delivery', label: t('report_f_delivery'), kind: 'date', value: delivery, display: (r) => day(delivery(r), locale) },
      { id: 'order_ref', label: t('report_f_order_ref'), kind: 'text', value: (r) => orNull(r.order?.order_ref) },
      {
        id: 'order_status',
        label: t('report_f_order_status'),
        kind: 'enum',
        value: (r) => (r.order ? (ORDER_STATUS_KEY[r.order.statut] ? t(ORDER_STATUS_KEY[r.order.statut]) : r.order.statut) : null),
      },
      { id: 'deposit_paid', label: t('report_f_deposit_paid'), kind: 'bool', value: (r) => !!r.order?.deposit_paid },
      { id: 'balance_paid', label: t('report_f_balance_paid'), kind: 'bool', value: (r) => !!r.order?.balance_paid },
      { id: 'paid_total', label: t('report_f_paid_total'), kind: 'number', sum: true, value: paid, display: (r) => money(paid(r), locale) },
      { id: 'delivered', label: t('report_f_delivered'), kind: 'bool', value: (r) => !!r.order?.delivered },
      {
        id: 'commission',
        label: t('report_f_commission'),
        kind: 'number',
        sum: true,
        value: (r) => r.order?.commission_amount ?? null,
        display: (r) => money(r.order?.commission_amount, locale),
      },
      pick('location'),
      pick('themes'),
    ],
    defaults: config(['id', 'title', 'year', 'status', 'buyer', 'price_final', 'delivery'], 'delivery'),
    rowKey: (r) => r.o.OeuvreID,
  }
}

function contactsSource(c: SourceCtx): SourceDef<ReportContactRow> {
  const { t } = c
  const name = (r: ReportContactRow) =>
    orNull(r.NomInstitution) ?? orNull(`${r.Prénom ?? ''} ${r.Nom ?? ''}`) ?? `#${r.ContactID}`
  return {
    id: 'contacts',
    fields: [
      { id: 'id', label: t('report_col_id'), kind: 'number', value: (r) => r.ContactID },
      { id: 'name', label: t('report_f_contact_name'), kind: 'text', value: name },
      { id: 'first_name', label: t('report_f_first_name'), kind: 'text', value: (r) => orNull(r.Prénom) },
      { id: 'last_name', label: t('report_f_last_name'), kind: 'text', value: (r) => orNull(r.Nom) },
      { id: 'institution', label: t('report_f_institution'), kind: 'text', value: (r) => orNull(r.NomInstitution) },
      { id: 'type', label: t('report_f_type'), kind: 'enum', value: (r) => orNull(r.Type) },
      { id: 'role', label: t('report_f_role'), kind: 'enum', value: (r) => orNull(r.Role) },
      { id: 'city', label: t('report_f_city'), kind: 'enum', value: (r) => orNull(r.Ville) },
      { id: 'country', label: t('report_f_country'), kind: 'enum', value: (r) => orNull(r.Pays) },
      { id: 'email', label: t('report_f_email'), kind: 'text', value: (r) => orNull(r.Email) },
      { id: 'phone', label: t('report_f_phone'), kind: 'text', value: (r) => orNull(r.Téléphone1) },
      { id: 'active', label: t('report_f_active'), kind: 'bool', value: (r) => !!r.Actif },
      { id: 'team', label: t('report_f_team'), kind: 'bool', value: (r) => r.is_team_member },
      { id: 'owner', label: t('report_f_owner'), kind: 'bool', value: (r) => !!r.PropriétaireOeuvre },
      { id: 'bought', label: t('report_f_bought'), kind: 'number', sum: true, value: (r) => c.worksByBuyer.get(r.ContactID) ?? 0 },
      { id: 'located', label: t('report_f_located'), kind: 'number', sum: true, value: (r) => c.worksAtLocation.get(r.ContactID) ?? 0 },
    ],
    defaults: config(['name', 'type', 'role', 'city', 'country', 'email', 'bought'], 'name', 'asc'),
    rowKey: (r) => r.ContactID,
  }
}

/** Erases the row type so the tab can hold any source (fields and rows always travel together). */
export function buildSource(id: ReportSource, c: SourceCtx): SourceDef<unknown> {
  const def =
    id === 'works'
      ? worksSource(c)
      : id === 'production'
        ? productionSource(c)
        : id === 'constats'
          ? constatsSource(c)
          : id === 'kaizen'
          ? kaizenSource(c)
          : id === 'sales'
            ? salesSource(c)
            : contactsSource(c)
  return def as unknown as SourceDef<unknown>
}
