export type CalendarProvider = 'google' | 'microsoft'

export type CalendarEventDraft = {
  summary: string
  description: string
  /** Inclusive YYYY-MM-DD for all-day */
  startDate: string
  /** Exclusive end YYYY-MM-DD (Google / Graph convention) */
  endExclusive: string
  location?: string | null
}

export type UpsertResult = {
  externalEventId: string
  etag: string | null
}
