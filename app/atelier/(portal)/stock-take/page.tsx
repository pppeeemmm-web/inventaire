import { redirect } from 'next/navigation'

/** Stock-take moved into Fournitures → Comptage (owner 2026-11-02). Old links keep working. */
export default function StockTakeRedirect() {
  redirect('/atelier/stock?view=count')
}
