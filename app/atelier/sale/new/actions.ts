'use server'

// Phone sale (`/atelier/sale/new`) — R7 step 2: a sale order (`work_order`, V-YYYY-NNN) through
// the order code. Nothing paid → a draft (nothing moves; it is signed in Commandes). Money taken
// on the spot → the order is signed and the payment recorded (« Encaisser »): part of the price
// → « Acompte » (works reserved), all of it → « Soldée » (the buyer becomes the owner).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { MobileSaleWork } from '@/components/atelier/sale/SaleNewClient'
import {
  advanceWorkOrder,
  createWorkOrder,
  recordOrderPayment,
} from '@/app/atelier/(portal)/sales/orders-actions'

export type MobileSaleStatus = 'draft' | 'signed' | 'deposit_paid' | 'paid'

export type CompleteMobileSaleResult =
  | { ok: true; order: { id: string; ref: string | null }; status: MobileSaleStatus; totalPaid: number }
  | { error: string }

function numberFromFormData(fd: FormData, key: string): number {
  const raw = fd.get(key)
  if (typeof raw !== 'string' || raw.trim() === '') return 0
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export async function completeMobileSale(formData: FormData): Promise<CompleteMobileSaleResult> {
  const finalPrice = numberFromFormData(formData, 'prix_final')
  const paymentAmount = numberFromFormData(formData, 'payment_amount')
  const paymentMethod = String(formData.get('payment_method') || '').trim() || 'Paiement externe'

  if (formData.getAll('oeuvre_ids').length === 0) return { error: 'ord_err_no_work' }
  if (finalPrice <= 0) return { error: 'ord_err_price' }
  if (paymentAmount < 0) return { error: 'ord_err_amount' }

  const fd = new FormData()
  fd.append('kind', 'sale')
  formData.getAll('oeuvre_ids').forEach((id) => fd.append('oeuvre_ids', String(id)))
  fd.append('party_id', String(formData.get('buyer_id') ?? ''))
  for (const [from, to] of [['prix_catalogue', 'price_catalogue'], ['discount_pct', 'discount_pct'], ['prix_final', 'price_final'], ['deposit_pct', 'deposit_pct'], ['notes', 'notes']] as const) {
    const v = formData.get(from)
    if (typeof v === 'string' && v.trim() !== '') fd.append(to, v)
  }

  const created = await createWorkOrder(fd)
  if ('error' in created) return { error: created.error }
  const order = { id: created.id, ref: created.ref }

  let status: MobileSaleStatus = 'draft'
  if (paymentAmount > 0) {
    const signed = await advanceWorkOrder(order.id, 'signed')
    if ('error' in signed) return { error: signed.error }
    status = 'signed'
    const pay = new FormData()
    pay.append('order_id', order.id)
    pay.append('amount', String(paymentAmount))
    pay.append('method', paymentMethod)
    const paid = await recordOrderPayment(pay)
    if ('error' in paid) return { error: paid.error }
    status = paid.status as MobileSaleStatus
  }

  revalidatePath('/atelier')
  revalidatePath('/atelier/sale/new')
  return { ok: true, order, status, totalPaid: paymentAmount }
}

/**
 * Works beyond the 300 newest the page loads (an older work sold at the studio): by number
 * (« 120 », « #120 ») or title. Team only (RLS).
 */
export async function searchSaleWorks(q: string): Promise<MobileSaleWork[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const term = q.trim().replace(/^#/, '')
  if (!term) return []
  let query = supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, Technique, "Année", Prix, PrixFinal, Discount, statusId, "Catalogué", NeedsPhotograph, txtImageNameLink')
    .is('deleted_at', null)
    .limit(14)
  query = /^-?\d+$/.test(term) ? query.eq('OeuvreID', Number(term)) : query.ilike('Titre', `%${term.replace(/[%_]/g, '')}%`)
  const { data } = await query.order('OeuvreID', { ascending: false })
  return (data ?? []) as MobileSaleWork[]
}
