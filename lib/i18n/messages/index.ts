import { atelierMessages } from './atelier.messages'
import { hubMessages } from './hub.messages'
import { publicMessages } from './public.messages'
import { systemMessages } from './system.messages'
import { workFormMessages } from './work-form.messages'

export const featureMessages = {
  ...atelierMessages,
  ...publicMessages,
  ...hubMessages,
  ...workFormMessages,
  ...systemMessages,
} as const

export type MessageKey = keyof typeof featureMessages
