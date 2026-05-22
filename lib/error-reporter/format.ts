export type ErrorReporterContext = {
  source: string
  metadata?: Record<string, unknown>
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message: unknown }).message
    if (typeof m === 'string') return m
  }
  return 'Unknown error'
}

export function errorStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined
}

export function serializeError(err: unknown): { message: string; stack?: string } {
  return { message: errorMessage(err), stack: errorStack(err) }
}
