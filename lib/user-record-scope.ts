/** Scopes for `user_record_done` — add new entity types here only. */
export const USER_RECORD_SCOPE = {
  oeuvre: 'oeuvre',
} as const

export type UserRecordScope = (typeof USER_RECORD_SCOPE)[keyof typeof USER_RECORD_SCOPE]
