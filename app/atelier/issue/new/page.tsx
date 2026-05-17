import { IssueNewForm } from '@/components/atelier/IssueNewForm'
import type { IssueActionTypeOption } from '@/components/atelier/IssueNewForm'
import { createClient } from '@/lib/supabase/server'

type IssueWorkRow = {
  OeuvreID: number
  Titre: string | null
  Année: string | null
}

export default async function IssueNewPage() {
  const supabase = await createClient()
  const [{ data: works }, { data: actionTypes }] = await Promise.all([
    supabase
      .from('Oeuvres')
      .select('OeuvreID,Titre,"Année"')
      .is('deleted_at', null)
      .order('OeuvreID', { ascending: false })
      .limit(500),
    supabase
      .from('work_action_type')
      .select('id,label,color,sort_order')
      .order('sort_order')
      .order('id'),
  ])

  const workOptions = ((works ?? []) as IssueWorkRow[]).map((work) => ({
    id: work.OeuvreID,
    label: work.Titre?.trim()
      ? `#${work.OeuvreID} · ${work.Titre.trim()}${work.Année ? ` · ${work.Année.slice(0, 4)}` : ''}`
      : `#${work.OeuvreID}`,
  }))
  const actionTypeOptions = (actionTypes ?? []) as IssueActionTypeOption[]

  return (
    <IssueNewForm
      workOptions={workOptions}
      actionTypeOptions={actionTypeOptions}
    />
  )
}
