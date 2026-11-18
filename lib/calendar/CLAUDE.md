# Calendar sync (loaded when working here; also `app/api/calendar/`, `app/atelier/calendar/actions.ts`)

- Tables: `calendar_account`, `calendar_event_link`.
- Env: `CALENDAR_TOKEN_ENCRYPTION_KEY`, `CALENDAR_OAUTH_STATE_SECRET`, Google / Microsoft OAuth secrets, `MICROSOFT_CALENDAR_TENANT`.
- Origin env: `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL`, no trailing slash. Required for OAuth, metadata, sitemap.
