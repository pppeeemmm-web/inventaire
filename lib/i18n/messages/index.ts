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
import { curationUiMessages } from './curation-ui.messages'
import { worldMapUiMessages } from './world-map-ui.messages'
import { reportsPivotAtlasMessages } from './reports-pivot-atlas.messages'
import { searchMessages } from './search.messages'
import { loginMessages } from './login.messages'
import { contactsUiMessages } from './contacts-ui.messages'
import { analyticsUiMessages } from './analytics-ui.messages'
import { auditMessages } from './audit.messages'
import { stockUiMessages } from './stock-ui.messages'
import { portfolioConfigMessages } from './portfolio-config.messages'
import { knobsPanelMessages } from './knobs-panel.messages'

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
  ...curationUiMessages,
  ...worldMapUiMessages,
  ...reportsPivotAtlasMessages,
  ...searchMessages,
  ...loginMessages,
  ...contactsUiMessages,
  ...analyticsUiMessages,
  ...auditMessages,
  ...stockUiMessages,
  ...portfolioConfigMessages,
  ...knobsPanelMessages,
} as const

export type MessageKey = keyof typeof featureMessages
