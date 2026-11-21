# Survey 2 — the Journal (sketchbook) and capture (draft, 2026-11-21)

Status: **local draft**. Question: what do the proven day-by-day notebooks and phone capture tools do, what does the hub have, what is missing. Made from three web searches (sources at the end; mostly comparison articles and vendor pages, not official documentation) plus general knowledge, set against the hub's schema, `app/manifest.ts` and the Journal's data code. Not done: nothing tried on Pem's phone; the Journal screens not opened in a browser.

## 1. The notebook pattern (Roam, Logseq, Obsidian)

| What the best tools do | The hub today | Verdict |
|---|---|---|
| **The day's page is the default entry**: open the tool, you are on today, you write | The phone opens on `/hub`; the Journal is a tab | Take: the capture icon opens on today's page |
| **The unit is the block, not the page**: each line, note or image is one addressable item with its own links | Four stores by medium (`journal_entry`, `voice_note`, `inspiration_photo`, `note_line`), each linked its own way | Take: one input = one item (principles §2b) |
| **Backlinks are automatic**: mention a work on a day → the work's page shows that day's block, whole, in context, without anyone filing it | `#1234` in a journal text creates a link; a work shows its validated entries in Constellation's side panel only | **The gap behind « at a glance, connecting things »**: every work, idea and person page should show « everything that mentions me », by date |
| **Linked references are readable in place** (the whole block, its day, editable there) — Logseq and Roam; Obsidian shows only a line | — | Take the Logseq / Roam behaviour |
| **Unlinked mentions**: the tool notices a title written without a link and offers to link it | AI proposals by meaning (`journal_propose_links`), measured on Pem's accept / reject | The hub is ahead on meaning; a plain « you wrote this work's title » match is cheap and missing |
| **Embeds (transclusion)**: one block shown in several places, still one item | Each store shown in its own screen | Follows from one item + views |
| **Scrolling through days continuously**; a date picker and search beside it | One day at a time, assembled from eight reads | The feed (commandment 9) |
| Plain-text files the user owns | A database; `npm run archive` writes `journal/YYYY.md` | Covered by the archive |

**What not to copy:** the outliner (everything as nested bullets) — it is a writing style, not Pem's; the plugin culture; « everything is a page ». The hub's own strength the tools lack: the entry knows its medium, its work, its place, and the database refuses to lose it.

## 2. Capture on an iPhone SE (2nd generation)

| Fact | Source | Consequence |
|---|---|---|
| The phone runs iOS 18; it may get few further updates | Apple guide; community | Design for iOS 18 |
| **Back Tap** (double or triple tap on the back) is supported and can run a Shortcut | Apple | The « key combination »: back tap → Shortcut → capture page. That the Shortcut can open the hub's capture page is expected (general knowledge), **to try on the phone** |
| **iOS does not support the web « share target »** | Two 2026 guides | `app/manifest.ts` declares one (→ `/atelier/share-receive`). On Pem's iPhone the hub cannot appear in the share sheet that way. **The share-inbox path (13 files) likely serves no device Pem owns — to confirm with Pem.** Sharing into the hub on iOS goes through a Shortcut in the share sheet that sends to the hub |
| iOS ignores manifest `shortcuts` (long-press menu) | One 2026 guide, not checked against Apple | The second icon is not a manifest feature: it is a second home-screen entry or a Shortcut icon |
| Each home-screen web app may keep its own sign-in | General knowledge; the search did not confirm it | Try: does a second icon need a second sign-in? If yes, use a Shortcut icon that opens the one installed app |
| Background recording in a web app | Not found | Assume recording stops when the page leaves the front; **try on the phone** |
| A lock-screen widget can launch a Shortcut (iOS 16+) | General knowledge; not confirmed by the search | Try |
| Offline: a web app can cache itself and queue what was captured | General knowledge | The hub has an offline queue for work saves (per `ARCHITECTURE.md`); whether voice and photo captures queue offline is **to check in code** |

A native app would lift these limits (share sheet, background recording, widgets). It is not needed to start; the doors rule keeps it possible later.

## 3. What to take — for the Journal design

1. Open on today. One item per input. The page of a day = the items of that date, from one feed.
2. **Backlinks everywhere**: a work, an idea, a person each show, by date, every item that mentions them — whole and readable in place. This is the desk's « connecting at a glance ».
3. Cheap title-mention matching beside the AI proposals.
4. Capture entry on the iPhone: Back Tap → Shortcut → capture page; a share-sheet Shortcut; five things to try on the phone before designing (above).
5. The share path: **Pem 2026-11-21 — a share Shortcut « Pem's workshop » exists on the iPhone and is not used « because it goes nowhere ».** So the path is broken end to end for its only user. In the Journal design it is rebuilt as: share sheet → Shortcut → the day's page (commandment 9); the old share-inbox code is retired then, not before.

## Sources

- Notebook tools — https://thesweetsetup.com/obsidian-vs-roam/ · https://glukhov.org/knowledge-management/tools/obsidian-vs-logseq-comparison/ · https://itsfoss.com/comparison/obsidian-vs-logseq/ · https://forum.obsidian.md/t/why-obsidian-needs-better-block-support/74645
- iOS web apps — https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide · https://firt.dev/notes/pwa-ios/ · https://tappwa.com/blog/ios-pwa-limitations-2026
- Back Tap, iOS 18 — https://support.apple.com/en-kg/guide/iphone/aside/iph005001f91/15.0/ios · https://support.apple.com/guide/shortcuts/apd897693606/ios · https://macrumors.com/how-to/trigger-actions-back-tap-iphone
