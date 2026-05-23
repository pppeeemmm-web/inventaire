'use server'

import { revalidatePath } from 'next/cache'
import {
  addPayment,
  createSaleOrder,
  updateOrderStatut,
  type SaleOrderRow,
} from '@/app/atelier/(portal)/sales/actions'

export type MobileSaleStatus = 'confirmed' | 'deposit_paid' | 'completed'

export type CompleteMobileSaleResult =
  | { ok: true; order: SaleOrderRow; status: MobileSaleStatus; totalPaid: number }
  | { error: string }

function numberFromFormData(fd: FormData, key: string): number {
  const raw = fd.get(key)
  if (typeof raw !== 'string' || raw.trim() === '') return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export async function completeMobileSale(formData: FormData): Promise<CompleteMobileSaleResult> {
  const finalPrice = numberFromFormData(formData, 'prix_final')
  const paymentAmount = numberFromFormData(formData, 'payment_amount')
  const paymentMethod = String(formData.get('payment_method') || '').trim() || 'Paiement externe'

  if (formData.getAll('oeuvre_ids').length === 0) {
    return { error: 'Sélectionnez au moins une œuvre.' }
  }
  if (finalPrice <= 0) {
    return { error: 'Indiquez un prix final supérieur à zéro.' }
  }
  if (paymentAmount < 0) {
    return { error: 'Le montant réglé ne peut pas être négatif.' }
  }

  const orderResult = await createSaleOrder(formData)
  if ('error' in orderResult) return { error: orderResult.error }

  const order = orderResult.order
  if (paymentAmount > 0) {
    const paymentResult = await addPayment(order.id, paymentAmount, paymentMethod, 'Mobile sale flow')
    if ('error' in paymentResult) return { error: paymentResult.error }
  }

  let status: MobileSaleStatus = 'confirmed'
  const paidInFull = paymentAmount >= finalPrice

  if (paidInFull) {
    if (paymentAmount > 0) {
      const depositResult = await updateOrderStatut(order.id, 'deposit_paid', 'deposit_paid')
      if ('error' in depositResult) return { error: depositResult.error }
    }
    const completeResult = await updateOrderStatut(order.id, 'completed', 'balance_paid')
    if ('error' in completeResult) return { error: completeResult.error }
    status = 'completed'
  } else if (paymentAmount > 0) {
    const depositResult = await updateOrderStatut(order.id, 'deposit_paid', 'deposit_paid')
    if ('error' in depositResult) return { error: depositResult.error }
    status = 'deposit_paid'
  } else {
    const confirmResult = await updateOrderStatut(order.id, 'confirmed')
    if ('error' in confirmResult) return { error: confirmResult.error }
  }

  revalidatePath('/atelier')
  revalidatePath('/atelier/sale/new')

  return { ok: true, order: { ...order, statut: status }, status, totalPaid: paymentAmount }
}
