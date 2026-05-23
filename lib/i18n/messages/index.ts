import { atelierMessages } from './atelier.messages'
import { hubMessages } from './hub.messages'
import { mobileSaleMessages } from './mobile-sale.messages'
import { portfolioPdfMessages } from './portfolio-pdf.messages'
import { publicMessages } from './public.messages'
import { siteBlocksMessages } from './site-blocks.messages'
import { systemMessages } from './system.messages'
import { workFormMessages } from './work-form.messages'
import { exhibitionsUiMessages } from './exhibitions-ui.messages'
import { fiscalUiMessages } from './fiscal-ui.messages'
import { salesUiMessages } from './sales-ui.messages'
import { inventoryUiMessages } from './inventory-ui.messages'
import { vaultUiMessages } from './vault-ui.messages'

export const featureMessages = {
  ...atelierMessages,
  ...publicMessages,
  ...hubMessages,
  ...portfolioPdfMessages,
  ...mobileSaleMessages,
  ...siteBlocksMessages,
  ...workFormMessages,
  ...systemMessages,
  ...exhibitionsUiMessages,
  ...fiscalUiMessages,
  ...salesUiMessages,
  ...inventoryUiMessages,
  ...vaultUiMessages,
} as const

export type MessageKey = keyof typeof featureMessages
