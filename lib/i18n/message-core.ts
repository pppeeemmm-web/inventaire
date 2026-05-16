export type MessageVars = Record<string, string | number | boolean | null | undefined>

export type BilingualMessage = {
  fr: string
  en: string
}

export type BilingualMessages = Record<string, BilingualMessage>

export function defineMessages<const T extends BilingualMessages>(messages: T): T {
  return messages
}

export function flattenMessages<T extends BilingualMessages>(
  messages: T,
  lang: keyof BilingualMessage,
): { [K in keyof T]: string } {
  return Object.fromEntries(
    Object.entries(messages).map(([key, value]) => [key, value[lang]]),
  ) as { [K in keyof T]: string }
}

export function interpolateMessage(message: string, vars?: MessageVars): string {
  if (!vars) return message

  return message.replace(/\{([A-Za-z0-9_]+)\}/g, (token, name: string) => {
    const value = vars[name]
    return value === undefined || value === null ? token : String(value)
  })
}
