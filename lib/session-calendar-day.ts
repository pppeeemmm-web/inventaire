/** Civil calendar day (YYYY-MM-DD) in Europe/Paris — matches work_session day matching. */

export function calendarDayInParisFromIso(iso: string | null | undefined): string {
  if (!iso?.trim()) return ''
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return ''
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(time))
}

export function sessionAtIsoForCalendarDay(calendarDay: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDay)) return null
  const noon = Date.parse(`${calendarDay}T12:00:00`)
  return Number.isNaN(noon) ? null : new Date(noon).toISOString()
}

export function todayCalendarDayInParis(): string {
  return calendarDayInParisFromIso(new Date().toISOString())
}
