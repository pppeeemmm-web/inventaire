import { atelierMessages } from './atelier.messages'
import { hubMessages } from './hub.messages'
import { mobileSaleMessages } from './mobile-sale.messages'
import { publicMessages } from './public.messages'
import { siteBlocksMessages } from './site-blocks.messages'
import { systemMessages } from './system.messages'
import { workFormMessages } from './work-form.messages'

export const featureMessages = {
  ...atelierMessages,
  ...publicMessages,
  ...hubMessages,
  ...mobileSaleMessages,
  ...siteBlocksMessages,
  ...workFormMessages,
  ...systemMessages,
} as const

export type MessageKey = keyof typeof featureMessages
