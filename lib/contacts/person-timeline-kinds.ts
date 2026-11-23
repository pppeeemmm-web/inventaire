// Kinds of rows on the person page's timeline (People.md §5). Kept out of the 'use server' read module, which may
// export async functions only.

export type TimelineKind = 'moment' | 'order' | 'payment' | 'shipment' | 'event' | 'kit' | 'paper' | 'enquiry'
export const TIMELINE_KINDS: TimelineKind[] = ['moment', 'order', 'payment', 'shipment', 'event', 'kit', 'paper', 'enquiry']
