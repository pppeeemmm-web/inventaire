'use server'

// Cost per work — expenses attributed to works (supabase/sql/expense_oeuvre_cost.sql).
// Admin only: the owner enters costs alone for now. RLS on `expense_oeuvre` enforces it too.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fromSaleOrder } from '@/lib/sales/sales-client'

export type ExpenseWorkLink = { oeuvre_id: number; amount: number | null }

export type WorkCostLine = {
  expense_id: number
  date: string | null
  libelle: string | null
  category: string | null
  /** This work's part of the expense (explicit amount, or TTC split evenly). */
  amount: number
  /** True when the amount comes from an even split across the expense's works. */
  split: boolean
}

export type WorkCost = {
  total: number
  byCategory: { category: string; amount: number }[]
  lines: WorkCostLine[]
  /** Final price of the completed sale order for this work, when there is one. */
  salePrice: number | null
}

async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' as const, supabase: null }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'admin_only' as const, supabase: null }
  return { error: null, supabase }
}

export async function fetchExpenseWorkLinks(expenseId: number): Promise<ExpenseWorkLink[]> {
  const { error, supabase } = await guardAdmin()
  if (error || !supabase) return []
  const { data } = await supabase
    .from('expense_oeuvre')
    .select('oeuvre_id, amount')
    .eq('expense_id', expenseId)
    .order('oeuvre_id')
  return (data ?? []).map((r) => ({ oeuvre_id: r.oeuvre_id, amount: r.amount == null ? null : Number(r.amount) }))
}

/** Replace the works an expense is attributed to. */
export async function setExpenseWorkLinks(
  expenseId: number,
  links: ExpenseWorkLink[],
): Promise<{ ok: true } | { error: string }> {
  const { error, supabase } = await guardAdmin()
  if (error || !supabase) return { error: error ?? 'auth' }

  const clean = [...new Map(
    links
      .filter((l) => Number.isInteger(l.oeuvre_id) && l.oeuvre_id > 0)
      .map((l) => [l.oeuvre_id, { oeuvre_id: l.oeuvre_id, amount: l.amount != null && l.amount >= 0 ? l.amount : null }]),
  ).values()]

  const { error: delErr } = await supabase.from('expense_oeuvre').delete().eq('expense_id', expenseId)
  if (delErr) return { error: delErr.message }
  if (clean.length) {
    const { error: insErr } = await supabase
      .from('expense_oeuvre')
      .insert(clean.map((l) => ({ expense_id: expenseId, ...l })))
    if (insErr) return { error: insErr.message }
  }
  revalidatePath('/atelier/fiscal')
  return { ok: true }
}

/** What a work cost, by category, plus the sale price when it has been sold. Null for non-admins. */
export async function fetchWorkCost(oeuvreId: number): Promise<WorkCost | null> {
  const { error, supabase } = await guardAdmin()
  if (error || !supabase) return null

  const { data: links } = await supabase
    .from('expense_oeuvre')
    .select('expense_id, amount, expense:expense_id (date, libelle, category, montant_ttc)')
    .eq('oeuvre_id', oeuvreId)

  const rows = (links ?? []) as unknown as {
    expense_id: number
    amount: number | null
    expense: { date: string | null; libelle: string | null; category: string | null; montant_ttc: number | null } | null
  }[]

  // Even splits need the number of works on each expense.
  const splitIds = rows.filter((r) => r.amount == null).map((r) => r.expense_id)
  const worksPerExpense = new Map<number, number>()
  if (splitIds.length) {
    const { data: all } = await supabase.from('expense_oeuvre').select('expense_id').in('expense_id', splitIds)
    for (const r of all ?? []) worksPerExpense.set(r.expense_id, (worksPerExpense.get(r.expense_id) ?? 0) + 1)
  }

  const lines: WorkCostLine[] = rows.map((r) => {
    const ttc = Number(r.expense?.montant_ttc ?? 0)
    const split = r.amount == null
    const amount = split ? ttc / Math.max(1, worksPerExpense.get(r.expense_id) ?? 1) : Number(r.amount)
    return {
      expense_id: r.expense_id,
      date: r.expense?.date ?? null,
      libelle: r.expense?.libelle ?? null,
      category: r.expense?.category ?? null,
      amount: Math.round(amount * 100) / 100,
      split,
    }
  }).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  const byCat = new Map<string, number>()
  for (const l of lines) byCat.set(l.category ?? '', (byCat.get(l.category ?? '') ?? 0) + l.amount)

  const { data: sale } = await fromSaleOrder(supabase)
    .select('prix_final')
    .eq('oeuvre_id', oeuvreId)
    .eq('statut', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    total: Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100,
    byCategory: [...byCat.entries()]
      .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount),
    lines,
    salePrice: sale?.prix_final != null ? Number(sale.prix_final) : null,
  }
}
