import { redirect } from 'next/navigation'

/** System moved into Kaizen → Opérations & Stratégie → Système (`?view=website`, owner 2026-11-02). Old links keep working. */
export default function SystemRedirect() {
  redirect('/atelier/kaizen?view=website')
}
