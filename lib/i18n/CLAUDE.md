# lib/i18n/ — copy details (loaded when working here; the core rule is in root CLAUDE.md)

- New copy: one module in `lib/i18n/messages/*.messages.ts` via `defineMessages()`, FR + EN together; register it in `lib/i18n/messages/index.ts`.
- Runtime: `resolveMessage` (`lib/i18n/resolve-message.ts`) — feature messages first, legacy `fr.ts` / `en.ts` fallback; dev `console.warn` on a miss.
- Legacy dict under `lib/i18n/dictionary/` stays until touched. No new feature copy via the old pattern unless maintaining a legacy surface.
- Enforcement: ESLint `pem-i18n/no-hardcoded-jsx-text` + `npm run i18n:check` (fails on missing legacy keys and hardcoded copy). Allowlist `scripts/i18n-check-allowlist.json` stays in sync with the `.eslintrc.json` overrides — history in `docs/archive/HANDOFF_SLICE4.md`.
- Server Components: pass translated strings, use a client leaf, or `dict[lang][key]`.
- `toLocale*` / Intl locale from `lang` (`fr-FR` / `en-GB`), never hardcoded.
