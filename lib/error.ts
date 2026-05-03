/**
 * Utility to stringify any error type (Error, string, DOM Event, or unknown)
 * for safe display in UI components (alerts, error messages).
 */
export function stringifyError(err: any): string {
  if (!err) return 'Unknown error'
  
  // Handle standard Error objects
  if (err instanceof Error) {
    return err.message
  }

  // Handle strings
  if (typeof err === 'string') {
    return err
  }

  // Handle Supabase/Postgrest errors
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }

  // Handle [object Event] (common in network failures or misconfigured handlers)
  if (err instanceof Event) {
    return `Event Error: ${err.type} on ${err.target?.constructor?.name || 'unknown target'}`
  }

  // Handle generic objects (try to find a message, or JSON stringify)
  if (typeof err === 'object') {
    try {
      // If it's a server action result { error: ... }
      if (err.error) return stringifyError(err.error)
      
      const str = JSON.stringify(err)
      if (str === '{}') return String(err)
      return str
    } catch {
      return String(err)
    }
  }

  return String(err)
}

/**
 * Higher-order function to wrap an async function and ensure it returns 
 * a standardized { error: string } or { ok: true } result.
 */
export async function safeAction<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn()
  } catch (e) {
    console.error("Action Error Caught:", e)
    return { error: stringifyError(e) }
  }
}
