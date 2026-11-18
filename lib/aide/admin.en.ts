import type { AideChapter } from './types'

/** Admin guide — English. Same chapters, same order as `admin.fr.ts`. Only what an admin does beyond the team guide. */
export const ADMIN_EN: AideChapter[] = [
  {
    id: 'admin-scope',
    title: 'This guide',
    verified: '2026-11-18',
    md: `
This guide covers only what is reserved for admins. For everything else (works, journal, orders…), the team guide applies to you too.

## What the admin has on top

- **The Feed**: everything the team adds comes to you to sort.
- **Approval**: new works, card changes and photos proposed by the team wait for your agreement.
- **Field sessions**: capturing a session's photos and applying them.
- **Audit**: the system ledger, approvals, what was taken out of the Feed, and the rule checks.
- **Going back**: a work's versions, the bins, permanent deletion.
- **Broadcast**: the queue of works ready to be posted on social media.
- **Accounts**: giving or removing access to the studio.
- A few reserved actions: recording a destruction, a loss or a theft; moving a sold or given work to the trash; marking a contact "Private"; changing several works at once (status, contact, price…).

## Where the reserved screens are

- **On the computer**: [Audit Log](/atelier/audit) (Audit) at the top of the Kaizen group (its badge counts pending proposals); [Broadcast](/atelier/broadcast) in the Public group. The Overview shows two more signals: **Local jobs** and **System**.
- **On the phone**: the **Feed** tile in the ☰ menu and the "Feed" counter on Today only show for admins; so does "Edit the session" on a day.
- **Help**: on the computer, the "?" of a reserved screen opens this guide.

## What is not done in the app

Service keys, backups and sign-in accounts are set outside the app (Vercel, GitHub, Cloudflare, Supabase). This guide says where, chapter by chapter; the technical detail is in the repository (docs folder).
`,
  },
  {
    id: 'admin-week',
    title: "The admin's week",
    verified: '2026-11-18',
    md: `
A short routine keeps the app right. Nothing here is urgent to the day; what stays unanswered for long ends up missing for the team.

## Every day, or nearly

1. **The Feed** (phone: ☰ → Feed): keep or take out lines, ideas and entries; approve or reject proposals.
2. **Audit → Review** if Audit's badge shows a number: these are works, photos or changes the team is waiting for.

## Once a week

1. **Overview**: read the signals at the top. **System** gives the errors of the last 7 days and the result of the last rule check (red = a rule is broken: open Audit → Rules). **Local jobs** gives the voice notes to transcribe and the age of the last archive copy on the PC (red = more than 14 days without a copy).
2. **Local jobs**: on your PC, "Run on this PC" transcribes the voice notes, then indexes search.
3. **Audit → Rules** → **Check**: every rule should answer OK.
4. **Kaizen → Operations & Strategy → To confirm**: entries waiting for your choice.
5. **Broadcast → Queue**: a work that stays there with several attempts is probably stuck (see Broadcast).
6. **Orders** and **Logistics**: a draft order prepared by the team stays in the Feed until it is signed or cancelled.

## Once a quarter

- **The restore drill**: check that a backup really reads back (see Backups).
- **Accounts**: remove access for anyone who no longer works at the studio (see Accounts and access).

## Emails not to ignore

GitHub writes to you when a night job fails: the database backup (03:17 UTC) or the rule check (03:47 UTC). Such an email needs an answer the same day (see Troubleshooting).
`,
  },
  {
    id: 'admin-fil',
    title: 'The Feed',
    verified: '2026-11-18',
    md: `
The Feed gathers what others have added and you have not seen yet.

## Three sections

- **Creation**: lines written in a work's notes, lines added to an idea, proposed ideas.
- **Records**: a changed card, a proposed new work or image, an order prepared as a draft.
- **Kaizen**: entries added to Kaizen.

## Sorting

1. Open the Feed (☰ → Feed, or the "Feed" counter on Today).
2. Swipe a card right to **keep** (or **Approve** a proposal), left to **take out** (or **Reject**).
3. You have 6 seconds to "Undo".

**Next:**
- Approving a record proposal applies it to the work, as Audit → Review does (see Approving the team's work).
- A draft order stays in the Feed until it is signed or cancelled: "Keep" leaves it, "Take out" cancels the draft.
- What is left unsorted for more than 14 days goes into "Cooled": readable, never lost. Record proposals and draft orders never cool: they wait for your choice.

**Watch out:** what is taken out is not erased. Audit → **Taken out of the feed** lists it, and "Recall" puts it back in the Feed (except a rejected image).
`,
  },
  {
    id: 'admin-approve',
    title: "Approving the team's work",
    verified: '2026-11-18',
    md: `
What a team member records on a work does not apply at once: a new work, a change saved with **Save** on a card, an added photo. Each becomes a proposal that waits for your agreement. The rest of their work (journal, note lines, condition reports, creation history, contacts…) counts at once.

## Where the proposals are

- **Audit → Review** → "Pending proposals": the full list, newest first. Audit's badge in the sidebar counts them.
- **The Feed**, Records section: the same, one per card, to swipe.

## Reading a proposal

1. Each row gives the kind and the work: "New work: title", "New image: #… · title", or "#… · title" for a change; then who sent it, when, and how many fields change ("field(s) changed").
2. ▸ opens the detail: field by field, **Before** and **Proposed**. For a new image, the image itself.

## Approving

1. **Approve**, then confirm ("Approve and apply this proposal?").

**Next:**
- **New work**: the work is created and gets its number; if it came from "Share inbox", its images attach to it. The photos, place, period and source picked on the phone did not come with it: the person adds them now.
- **New image**: the photo joins the work's picture strip.
- **Change**: the card is saved as the person sent it, in their name.

**Watch out:**
- **Before** shows the card as it was when the person saved, not today's card. Approving sends their whole card: if you changed the same work in the meantime, your values on those fields are replaced. Look at the card first; if needed, go back to your version (see Going back to a version of a work). Lines in the history are never lost.
- A work's rules apply to an approval as to your own saves: a proposal that breaks one is refused with the rule's message (see Troubleshooting).

## Rejecting

1. **Reject**, a reason if you like ("Reason for rejection (optional)"), then **Confirm rejection**.

**Next:** nothing changes on the work. A rejected image is thrown away.

**Watch out:** the reason is kept with the proposal, but the app does not show it to its author yet: tell them.

## Session photos

Further down in Review, **"Field sessions (photos)"**: the team's sessions with photos to attach. The photos stay in the session until you apply them.

1. **Apply** attaches the photos to the work ("Attach session photos to this work?").
2. **Reject** asks for a reason, stored on the session.

## Kaizen

Kaizen → Operations & Strategy → **To confirm**: entries brought over with a proposed section. Nothing moves before you confirm ("Confirm", or "Confirm all").

## How long all this stays

A pending proposal stays until you choose. A handled proposal (approved or rejected) is erased from the database after 180 days.
`,
  },
  {
    id: 'admin-session',
    title: 'Field sessions',
    verified: '2026-11-18',
    md: `
A field session keeps the photos of a work session and attaches them to the works.

## Capturing a session on the phone

1. Bottom bar → **Work** → **Session photos**.
2. "Add painting", then the photos: "Take photo" or "Choose from library", then send them.
3. Choose **New work** (a title is required) or **Existing work** (its number), then "Save link".
4. **Apply to work**.
5. If you like: "Capture location & weather", and field notes.

**Next:** the photos are on the work; you can add another painting to the same session. The session shows in the day's Journal; "Edit the session" there is for admins only.

**Watch out:** photos with no linked work block applying; pick the work first.
`,
  },
  {
    id: 'admin-audit',
    title: 'Audit, tab by tab',
    verified: '2026-11-18',
    md: `
[Audit](/atelier/audit) (Kaizen → Audit Log, computer only) has four tabs at the top: **Ledger**, **Review**, **Taken out of the feed**, **Rules**.

## Ledger

The system ledger: the last 200 actions recorded by the app, newest first. Columns: Timestamp (date and time), Event (the kind of action), User (who; "System" when it is the app itself), Table (where), Details.

- The pills at the top filter by kind. You will see for example: PRICE CHANGE (a price changed), STATUS CHANGE (a status), LOCATION MOVE (a move), ORDER CREATED (an order created), PAYMENT GRAIN (a payment), VAULT UPLOAD (a document added to the Vault), VISIBILITY GATE (a work becoming visible or not on the site), ARCHIVE RUN (a copy of the archive on the PC), SYSTEM CONFIG (various settings and captures: Production columns, business card, sharing…), RUNTIME ERROR (an app error). Only the kinds present in the last 200 rows get a pill.
- Plain screen visits are not listed.

**Tidying up:**
1. Tick rows, or "Select all" (within the current filter).
2. **Delete (n)**, then confirm.

**Watch out:** rows written by hand (the ledger in Kaizen → Operations & Strategy → System) are never deleted from here. Every Sunday, an automatic job also erases rows older than a year.

## Review

The team's proposals and session photos (see Approving the team's work).

## Taken out of the feed

"Everything taken out stays here and can come back." Columns: Taken out, Kind, What.

1. **Recall** puts the item back in the Feed ("Recalled: back in the feed.").
2. A rejected image cannot come back ("Rejected image: cannot come back").

## Rules

A work's rules, checked across the whole database. Read only: nothing is changed here.

1. **Check**.
2. The answer: "… works checked · no rule broken", or the number of breaks, with the time.
3. One line per rule: OK, or the number of works concerned. Open the line: each work shows with its thumbnail and what is wrong; a click opens its card.

**Next:** fix each work on its card, then check again. The rules in detail are in the chapter A work's rules and the checks.
`,
  },
  {
    id: 'admin-versions',
    title: 'Going back to a version of a work',
    verified: '2026-11-18',
    md: `
Each time a work's card changes, the database keeps the version from before. Versions are read and restored on the card, by an admin only.

## Reading the versions

1. Open the card → Expanded → **Object** → History / provenance → **Data history**.
2. Each version shows how many fields changed; open it: **Field**, **Previous**, **This version**.

## Restoring

**When:** a change was a mistake (yours, or a proposal approved too fast).

1. On the right version: **Restore**.
2. Confirm ("Restore this version? Current values will be replaced (kept in history).").

**Next:** the card takes back that version's values. The values from before the restore become a version themselves: you can go back a second time.

**Watch out:**
- Restoring only touches the card's fields. Photos, themes, groups, orders and condition reports do not come back.
- Nor does what the database decides by itself (visibility on the site, the cover photo, the fate of a destroyed, lost or stolen work).
- The history (History / provenance) is never shortened: the restored version keeps every line written since.
- A work with a destruction, loss or theft report still open cannot be restored: "This work has an open destruction / loss report: close or delete it before restoring a version."
- Versions older than a year are erased every Sunday.
`,
  },
  {
    id: 'admin-delete',
    title: 'Deleting: bins and permanent deletion',
    verified: '2026-11-18',
    md: `
The app has two bins: the **works** bin, in the database, and the **storage** bin (photos and files, 90 days). Only permanent deletion really erases.

## Moving a work to the trash

1. Card → **Trash** → **Move to trash…**; or, in the Inventory, tick works → **Delete**, then confirm.
2. The message "Work(s) moved to trash. You can undo shortly." offers "Undo" for a few seconds.

**Next:** the work disappears from the lists, the site and Production; its steps are paused. Anyone in the team can move a work to the trash; a sold or given work, the admin only.

**Watch out:** once those few seconds are over, no screen shows the works bin. The record stays in the database, hidden; bringing it back is technical work (a development session).

## Deleting a work permanently

1. Card → **Admin zone** → **Delete permanently…**
2. Confirm: "Permanently delete work #…? The record, its themes and links will be erased, the pictures go to the R2 recycle bin (90 days). This cannot be undone."

**Next:** "Work permanently deleted." The record, its themes and its links with other works are erased. Its photos go to the storage bin.

**Watch out:** this cannot be undone in the app, and the versions are no use any more (there is no record left to restore). Only a database backup would bring it back (see Backups). Prefer the trash, except for a duplicate or an entry mistake.

## Deleting a photo

1. In the card's picture strip, on the photo: "Delete this picture (admin)".

**Next:** the photo leaves the work and goes to the storage bin. If it was the cover, the next one takes its place.

## The storage bin

- Every deleted file (work photo, condition report photo, voice note audio, Vault document) is first copied into a "recycle" folder of the storage (Cloudflare R2), under the day's date.
- It stays there **90 days**, then Cloudflare erases it.
- No screen in the app shows it: getting a file back is done in the Cloudflare dashboard (R2 → the recycle folder → the date), then it is put back in place. This is technical work.

## Recording a fate

A destruction, a loss or a theft are not "deleted": they are recorded with a condition report (admin only), and the work stays in the catalogue with its history (see the team guide, Works → Making a condition report). "Found" closes a loss or a theft.
`,
  },
  {
    id: 'admin-rules',
    title: "A work's rules and the checks",
    verified: '2026-11-18',
    md: `
Your rules for a work are written in the repository (docs/WORK_RULES.md) and held, for the most part, by the database itself: every screen, the phone and the scripts follow them. The team guide tells them in the chapter "What the app does by itself".

## The rules checked

Audit → Rules, the night check and the check before each release test the same rules, with these names:

- **Rule 2**: Catalogued needs at least one photo.
- **Rule 3**: Available needs the photo validated.
- **Rule 4**: Archive: catalogued, tasks paused.
- **Rule 5**: In the studio, the status follows the stage.
- **Rule 6**: Tasks follow the stage.
- **Rule 7**: A ticked task keeps its day.
- **Rule 8**: End of production only when Ready.
- **Rule 9**: Owner, custodian, address follow the stage.
- **Rule 10**: A work leaves Pem only through an order.
- **Rule 12**: Destroyed / lost: report, tasks, orders.
- **Rule 13**: Public = public status, no fate.
- **Rule 14**: Every status change has its dated line.
- **Rule 17**: Destroyed / lost: never « Showable ».

No state to check: 1 (going back is a move), 11 (a gift = status 11, checked by 9 and 10), 15 (a guard on deleting), 16 (one definition in the code).

## Three checks, one list

1. **By hand**: Audit → Rules → **Check**, whenever you like.
2. **Every night, at 03:47 UTC** (after the backup): an automatic job runs the same rules. If one comes back with works, the job fails and GitHub writes to you; Overview → **System** shows the result ("rules: OK", "n break(s)", or "to check (Audit)" when no check is recorded).
3. **Before each release**: the development session runs the data checks (the work rules, plus the consistency of orders, payments and shipments). They warn without blocking.

None of these checks changes anything.

## When a rule is broken

1. Audit → Rules → **Check** to see the works concerned.
2. Open each work and fix it on its card or through its order. The reason is written next to each work (for example "catalogued, no photo").
3. Check again.

**Watch out:** a break that comes back without anyone touching it comes from a path that goes around a rule; report it in Kaizen with the work's number, so that a development session closes it in the database.
`,
  },
  {
    id: 'admin-privacy',
    title: 'Contacts: confidentiality and merging',
    verified: '2026-11-18',
    md: `
There are two different confidentiality settings: one on a **work's card**, the other on a **contact's card**.

## On a work's card: "Contact confidentiality"

Card → Expanded → **Object** → **Contact confidentiality**: "How the owner's name is shown (public, masked, confidential)." Three levels:

- **Public**: "Contact visible publicly".
- **Masked**: "Contact masked — name visible to admins only".
- **Private**: "Confidential contact — admins only". The card shows "CONFIDENTIAL".

**What the Private level changes today:** exports and selection PDFs mark the work "⚠ NON PUBLIC", the export warns first, and the Constellation and exhibitions flag it. The level is changed like the rest of the card (a proposal, for the team).

## On a contact's card: "Private"

1. Business → Contacts → the contact → **Private**: "Private contact (admin-only visibility)". The box only shows for admins.
2. Contacts imported with "Google CSV" or "URL" arrive already marked Private.

**Watch out:** today, the box marks the contact; it does not hide it from the team yet, who see it in Contacts and in the lists. Do not rely on it to keep a contact secret. Giving a contact access to the studio removes the Private mark.

## Merging two contacts

**When:** the same person exists twice (an import, a business card, a typo).

1. Business → Contacts: tick the two contacts.
2. **Merge** (in the bar that appears).
3. "Merge two contacts": choose the one to **keep**.
4. **Merge**.

**Next:** "Contacts merged." The other contact is removed, after its works, orders and documents are transferred; its fields fill the empty fields of the contact kept.

**Watch out:** a merge cannot be undone. Anyone in the team can merge. A contact with studio access keeps its account: if both have a different one, the app refuses and says so.
`,
  },
  {
    id: 'admin-accounts',
    title: 'Accounts and access',
    verified: '2026-11-18',
    md: `
Everyone at the studio has a sign-in account, linked to their contact card. There is no public sign-up: you give the access.

## Giving someone access

1. Business → Contacts: open (or create) the person's card, with their email in the Emails part, then save.
2. The **Studio access** part (admins only): if the person has already signed in once (for example with Google), their account exists: **Connect studio access**. Otherwise: **Send invite email (new account)**; they receive an email to choose their password.
3. Check that **Team member** is ticked ("Allows sign-in to the studio (when an account is linked).") and that "Account linked" shows.

**Next:** "Studio access connected." The person signs in at www.thepemworkshop.com/login and sees the Atelier as a team member: their works, changes and photos come to you for approval.

**Watch out:**
- One account = one card. "This login is already linked to contact #…": open the other card, or merge the two contacts.
- "Add an email before inviting.": the invite goes to the card's email.

## Removing access

1. The person's card → **Studio access** → untick **Team member**.

**Next:** they no longer have access to the Atelier or the phone. Their sign-in account still exists; deleting it for good is done in Supabase (Authentication), technical work.

## Admin

The admin role is a box on the contact card, with no button in the app: it is given or removed in the database (a development session). Keep as few admins as possible.

## Password and personal settings

- **Change password** and **Sign out**: in the header on the computer, at the bottom of the ☰ menu on the phone. A Google-only account has no password to change.
- Lost password: "Forgot password?" on the sign-in page.
- **FR / EN** and the sun ☀ (light or dark theme): in the header.

## There is no "Settings" screen

What is set outside the app:

- **Vercel** (the site's hosting): service keys (AI, Broadcast…), in Settings → Environment Variables.
- **GitHub** (the code): the night jobs and their secrets (backup, rule check).
- **Cloudflare R2**: storage for photos, documents and backups, and the storage bin.
- **Supabase**: the database and the sign-in accounts.

Changing any of them is technical work: ask a development session.
`,
  },
  {
    id: 'admin-broadcast',
    title: 'Broadcast',
    verified: '2026-11-18',
    md: `
[Broadcast](/atelier/broadcast) (Public → Broadcast) follows the posting of works on social media. The posting itself is done outside the app, by a Make.com scenario (Make → Buffer → Slack) that reads the app's queue.

## How a work goes out

1. On the card: Object → **Presentation** → **Ready for broadcast** ("Ready for a post (Broadcast): picture validated, caption text checked."), and if you like a **Broadcast note**: "A phrase, a memory, a context cue — passed to the downstream AI. Not a sales pitch."
2. Or, in the Inventory, the **Broadcast** column ticks several works at once.
3. The work is offered to Make when it is public, has a cover image, is not in the trash, and "Ready for broadcast" is ticked.
4. Make takes the work (it moves into the **Queue**), writes the caption with its AI from the title, technique, dimensions and your note, and prepares the post in Buffer. A work already in the Queue is no longer offered.
5. Once posted, Make tells the app: the work moves into **Posted**.

## The three tabs

- **Queue**: the works Make has taken and not posted yet, with the time queued and the number of attempts.
- **Posted**: the history, with the date; "Open" opens the post.
- **Activity**: the events Make reports (All or VIP).

**Watch out:**
- A work that stays in the Queue with several attempts is stuck: **Release** ("Release this queued item?") makes it available to Make again.
- If nothing moves at all, the Make scenario is stopped or its key no longer matches: check it in Make, not in the app.
- What goes to Make: the title, year, technique, support, dimensions, image and broadcast note. Never a price or a contact.
- Activity events older than 180 days are erased every Sunday, except errors.
`,
  },
  {
    id: 'admin-ai',
    title: 'The AI engines and their keys',
    verified: '2026-11-18',
    md: `
The public site uses no AI. In the Atelier, AI is always optional: when an engine is not installed or does not answer, the feature does less, nothing breaks.

## Who does what

- **Meaning-based search (⌘K) and the Journal's ✦ suggestions**: an Ollama model on your PC turns texts into markers, kept in the database. On the live site, a new phrase is searched as plain text.
- **Voice notes**: on the phone, the browser writes the words as you speak (Safari → Apple, Chrome → Google); the full transcription is done on your PC.
- **Business cards**: the text is read by the iPhone itself (Live Text), nothing is sent. "Improve with AI" then goes through OpenAI if a key is set on Vercel, otherwise through the Ollama model on your PC, which only answers when the app runs on that PC.
- **A contact from a web address ("URL")**: the same: the page is read without AI, the AI fills in when it can be reached.
- **Broadcast captions**: Make.com's AI (OpenAI or Anthropic), outside the app.

## Running your PC's jobs

1. Overview → **Local jobs**: "… voice note(s) to transcribe", "Search: … waiting for indexing".
2. **Run on this PC**: transcribes the voice notes, then indexes search, one after the other, with the PC's graphics card.

**Watch out:** the button only works on your PC, set up once for it. On the phone, it says to run it from the PC.

## The keys

Keys are set on Vercel (Settings → Environment Variables → Production), never in the app or in a message:

- **OPENAI_API_KEY**: turns on OpenAI for business cards and web addresses. Without it, these two passes have no AI on the live site.
- **CONTACT_CARD_VISION** = none: stops sending the card photo to OpenAI.
- **CONTACT_ENRICH_LLM** = none: turns off the AI for cards and web addresses.
- **INVENTORY_BROADCAST_SECRET**: the key Make shows to read the Broadcast queue; the same value in Make.

To know whether the live site has an OpenAI key: Vercel → the project → Settings → Environment Variables.

## What leaves your machines

- To **OpenAI**: a business card photo or a web page's text, and only with the key set.
- To **Make.com** and its AI: the titles, techniques, dimensions and broadcast notes of works "Ready for broadcast".
- Everything Ollama does stays on your PC.
`,
  },
  {
    id: 'admin-backups',
    title: 'Backups and the restore drill',
    verified: '2026-11-18',
    md: `
## What is backed up, and when

- **The database**, every night at 03:17 UTC: a full copy (every table) goes to a separate storage space (Cloudflare R2, daily folder). A GitHub job does it; if it fails, GitHub writes to you.
- **The catalogue's links**, every Sunday at 04:30 UTC: two CSV files readable in a spreadsheet, even without the app (weekly folder).
- **The archive on the PC**: a readable copy of everything (images, Vault, an index.html page that opens with no app and no network, the tables, the Journal) in the PEM-Archive folder on your PC. It runs every Sunday at 10:00 if the Windows task is installed, or by hand. Overview → Local jobs shows its age; red after 14 days.
- **Deleted photos and files** stay 90 days in the storage bin.

**Watch out:** the archive holds prices, notes and contacts: keep the folder private. A copy on a second disk, or with a trusted person, is still to be done by hand.

## What each copy is for

- The database's night copy: **restoring** the whole database, or finding a single row deleted by mistake.
- The Sunday CSVs: reading the catalogue's links when the app is unavailable.
- The PC archive: reading and handing on; it does not restore the database, but its images are the ones a restore would put back online.

## The restore drill

A backup that was never read back is only a hope. Once a quarter, check that a night copy reads back.

1. Ask a development session: "restore drill, docs/BACKUP_RECOVERY.md".
2. It downloads the latest copy from Cloudflare R2 and loads it into a **new, throwaway** database (never into the real one).
3. It counts the rows of the main tables (works, contacts, proposals, versions) and gives you the figures.
4. Compare them with the app's numbers (for example the number of works in the Inventory).
5. The throwaway database is then deleted.

**Next:** note the drill's date in Kaizen. If the copy does not read back, it is urgent: the night backup is useless until it is fixed.

## In a real accident

- **A row or a record deleted by mistake**: a development session finds it in the previous night's copy and puts it back, without touching the rest.
- **A card change to undo**: no backup needed, use the versions (see Going back to a version of a work).
- **A deleted photo**: under 90 days, it is in the storage bin (see Deleting).
- **The whole database**: restoring the whole database erases what was done since the copy. It is your decision, never a session's alone.
`,
  },
  {
    id: 'admin-trouble',
    title: 'Troubleshooting',
    verified: '2026-11-18',
    md: `
The messages below are the app's own, word for word, except the first two, which the app shows in French.

## A work refuses a status

- Catalogued without a photo is refused ("Une œuvre ne peut pas être cataloguée sans photographie."): add a photo first.
- Available with "Photo required" still ticked is refused: validate the photo (✓ in Production → Photography), the status follows.
- "Archive: catalogue the work first (a partial record is enough)."
- "Out of the archive straight to Available: the photo must be done. Otherwise, send the work back into production."
- "A work leaves Pem only through an order (consignment, loan, sale)": go through Orders; the card will follow.
- "Sold / gift: pick the acquirer (not Pem). Consigned / loan: pick the custodian (not Pem)."
- "Work out of circulation (sold, given, archived, destroyed, lost or already consigned)": it cannot be reserved, sold or consigned.

These refusals come from the database's rules: approving a team proposal gets them too.

## A work does not show on the site

1. Is its status public (Available, Reserved, Sold, Consigned, On loan, Gift), with no destruction, loss or theft?
2. Is it in the trash?
3. Audit → Rules → **Check**: rule 13 (Public = public status, no fate) should say OK.

## The System signal is red

1. Audit → Rules → **Check**, then fix the works listed (see A work's rules and the checks).
2. Errors only (orange): Audit → Ledger, RUNTIME ERROR pill. An error that repeats, report it in Kaizen with the time.

## Local jobs are red

- The archive is more than 14 days old: run the copy on your PC (or check the Sunday task).
- Voice notes are waiting: **Run on this PC**.

## GitHub wrote that a night job failed

- **Daily Supabase backup**: the night's copy does not exist. Run it again (GitHub → Actions → the job → Run workflow) or ask a development session, the same day.
- **Nightly work rule checks**: a rule has works concerned. Audit → Rules.

## Someone cannot sign in

1. Their contact card → **Studio access**: "Team member" ticked, "Account linked" showing?
2. Lost password: "Forgot password?" on the sign-in page.
3. They signed in with Google under another address: connect the access with that address.

## Restoring a version is refused

"This work has an open destruction / loss report": close the report ("Found") or delete it, then restore.

## "Improve with AI" does not answer

Normal away from your PC without an OpenAI key: "Analyse" is enough (see The AI engines and their keys).

## Changing several works at once is refused to the team

"Changing status, contact, price… on several works is admin only." Themes and groups stay editable by the team; the rest goes through the card, so through your approval.

## Nothing matches this guide

The screen is right. Report the gap in Kaizen → Operations & Strategy (+ New entry): the guide will be fixed.
`,
  },
]
