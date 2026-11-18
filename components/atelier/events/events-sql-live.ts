'use client'

import { createContext, useContext } from 'react'
import { R6_EVENTS_SQL_LIVE } from '@/lib/events/event-model'

/**
 * Whether the parts that need supabase/sql/r6_events.sql are usable. The real tab = R6_EVENTS_SQL_LIVE;
 * the dev-only demo (`?demo=1`, development build, nothing written) shows them on so the layout can be seen.
 */
export const EventsSqlLiveContext = createContext<boolean>(R6_EVENTS_SQL_LIVE)
export const useEventsSqlLive = () => useContext(EventsSqlLiveContext)
