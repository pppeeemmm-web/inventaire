import { redirect } from 'next/navigation'

/** System moved into Kaizen → Opérations & Stratégie → Système (`/atelier/kaizen-ops`, owner 2026-11-02). Old links keep working. */
export default function SystemRedirect() {
  redirect('/atelier/kaizen-ops?view=website')
}
