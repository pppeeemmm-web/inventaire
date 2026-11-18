import type { AideChapter } from './types'

/** Admin guide — English. Same chapters, same order as `admin.fr.ts`. Only what an admin does beyond the team guide. */
export const ADMIN_EN: AideChapter[] = [
  {
    id: 'admin-scope',
    title: 'This guide',
    verified: '2026-11-18',
    md: `
This guide covers only what is reserved for admins. For everything else (works, journal, orders…), the team guide applies to you too.

## What an admin has on top

- **The Feed**: everything the team adds comes to you to sort.
- **Approval**: new works, card changes and photos proposed by the team wait for your agreement.
- **Field sessions**: capturing a session's photos and applying them.
- **Going back**: a work's version history, the audit log, the rule checks, permanent deletes.
- **Broadcast**: the queue of works ready to be posted on social networks.
- A few reserved gestures: recording a destruction, a loss or a theft; moving a sold or given work to the trash; seeing private contacts.

On the phone, the **Feed** tile in the ☰ menu and the "Feed" counter on Today show only to admins. On the computer, **Audit** heads the Kaizen group and Broadcast is in Public.
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
- Approving a record proposal applies it to the work, as in Audit → Review.
- A draft order stays in the Feed until it is signed or cancelled: "Keep" leaves it, "Take out" cancels the draft.
- What is left unsorted for more than 14 days goes into "Cooled": readable, never lost.

**Watch out:** what is taken out is not erased. Audit → **Taken out of the feed** lists it, and "Recall" puts it back in the Feed (except a rejected image).
`,
  },
  {
    id: 'admin-approve',
    title: "Approving the team's work",
    verified: '2026-11-18',
    md: `
## Proposals

1. Audit → **Review** → "Pending proposals" (or the Feed, Records section).
2. Each proposal shows its kind (new work, new image, change) and, field by field, **Before** and **Proposed**.
3. **Approve** applies the proposal; **Reject** refuses it, with a reason if you like.

## Session photos

"Field sessions (photos)", in the same view: the team's sessions with photos to attach. **Apply** puts them on the work; **Reject** asks for a reason, shown in the session.

## Kaizen

Kaizen → Operations & Strategy → **To confirm**: entries brought over with a proposed section. Nothing moves before you confirm ("Confirm", or "Confirm all").
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
    id: 'admin-undo',
    title: 'Fixing and going back',
    verified: '2026-11-18',
    md: `
## Going back to a version of a work

Every change to a work keeps the previous version.

1. Card → Expanded → **Object** → History / provenance → **Data history**.
2. Each version shows what changed (Previous / This version).
3. **Restore** brings that version back; the current values stay in the history.

## The audit log

Audit → **Ledger** lists the system's actions. You can select entries and delete them; the manual register (System) is not touched.

## Checking the rules

Audit → **Rules** → "Check" runs a work's rules (see "What the app does by itself" in the team guide) over the whole database. Read only: each rule should come back empty; otherwise the works concerned are listed.

## Deleting

- **A photo**: in the card's picture strip, "Delete this picture (admin)". It goes to the storage bin (90 days).
- **A work**: "Move to trash…" (everyone; can be undone for a few seconds; a sold or given work: admins only). **Delete permanently…** (admin) erases the card, its themes and links; the photos go to the storage bin (90 days). It cannot be undone.
- **A destruction, a loss, a theft**: a condition report of that kind, for admins only (see Works → Making a condition report).
`,
  },
  {
    id: 'admin-broadcast',
    title: 'Broadcast',
    verified: '2026-11-18',
    md: `
Broadcast (Public → Broadcast) follows the posting of works on social networks, done by an outside tool (Make / n8n).

## Which works go out

A work joins the queue when it is public, has a cover image, is not in the trash, and "Ready for broadcast" is ticked on its card (Object → Presentation).

## The three tabs

- **Queue**: works waiting to be posted, with the number of attempts.
- **Posted**: the history; "Open" opens the post.
- **Activity**: the events reported back by the posting tool (All or VIP).

**Watch out:** a work stuck in the queue is freed with **Release**.
`,
  },
  {
    id: 'admin-privacy',
    title: 'Contact confidentiality',
    verified: '2026-11-18',
    md: `
On a work's card (Object → **Contact confidentiality**), three levels say who can see the linked contact:

- **Public**: "Contact visible publicly".
- **Masked**: "Contact masked — name visible to admins only".
- **Private**: "Confidential contact — admins only".

**Watch out:** a private contact is visible to admins only; the card shows it with "CONFIDENTIAL".
`,
  },
  {
    id: 'admin-backups',
    title: 'Backups',
    verified: '2026-11-18',
    md: `
- Every night at 03:17 UTC, a full copy of the database goes to separate storage (Cloudflare R2).
- Deleted photos and files stay 90 days in the storage bin before being erased.
- Restoring a backup is technical work: the steps are in the repository, docs/BACKUP_RECOVERY.md. A restore drill is planned (task list).
`,
  },
]
