import type { AideChapter } from './types'

/** Team guide — English. Same chapters, same order as `team.fr.ts`. */
export const TEAM_EN: AideChapter[] = [
  {
    id: 'scope',
    title: 'The project and its scope',
    verified: '2026-11-18',
    md: `
## What the app is for

PEM Studio is the working tool of Pem's atelier. It keeps a trace of the work in all its forms: the paintings, the writings, anything to do with his wondering at the world. The aim: to pass it on, to create links between things, and to give the work its value.

> "I hope somebody, now or in the future, will be able to extract from my painting some joy, emotion, mystery: anything that creates true value to other humans." Pem

## The four aims, in order

1. **Trace**: nothing gets lost. Capture is quick, on the phone, in the field.
2. **Links and mapping**: search, suggestions, the journal linked to the works, the Constellation, the map.
3. **Transmission**: the public site, portfolios, diffusion; and an archive that stays readable without the app.
4. **Value**: what the work gives to others. Provenance, condition reports and certificates support it.

When you are unsure what to record or what to ask for, these aims decide, in this order.

## What the app covers

- **The catalogue**: every work, its photos, dimensions, condition, history, who owns it, who holds it and where it is.
- **Production**: works under way, up to the catalogue.
- **The field**: the day (Today), the journal, voice notes, photographed work sessions.
- **Ideas**: projects and concepts.
- **Commercial**: orders (sale, gift, loan, deposit), shipments, contacts, income and expenses, the Vault (documents).
- **Public**: the www.thepemworkshop.com site, PDF portfolios, visitor statistics.

The commercial tools stay simple: they only grow when a real case needs it.

## Who uses it

- Pem (admin) and the atelier team, each with their own account. There is no public sign-up: the atelier creates the accounts.
- **The phone is for the field**: capture, fix, move things along. **The computer is for the deeper work**: the catalogue, tables, commercial.
- A team member sees almost everything. Their new works, changes saved on a card and added photos wait for an admin's approval; a few screens are for admins only.

## What the app does not do

- It does not edit photos. Catalogue photos are prepared in Lightroom, then added to the work (see Works → Adding photos).
- There is no public sign-up and no visitor account: the team signs in with accounts the atelier creates.
`,
  },
  {
    id: 'start',
    title: 'Getting started',
    verified: '2026-11-18',
    md: `
## Signing in

1. Open www.thepemworkshop.com/login.
2. Enter your email and password, or use the Google button.
3. Lost password: "Forgot password?" on the same page sends you a link by email.

To change your password or sign out: at the bottom of the ☰ menu on the phone, in the header on the computer.

## Installing the app on the phone

- **iPhone**: open the site in Safari, tap Share, then "Add to Home Screen".
- **Android**: open the site in Chrome, ⋮ menu, then "Install app" or "Add to Home screen".

The icon opens **Today** directly. On Android, the installed app also shows in the phone's Share menu; on iPhone it does not (see Works → Adding photos).

## On the phone: Today

Today is the home screen: the day. It shows what was done, the works of the day, writings and notes, and "See again".

- ‹ › moves to the day before or after.
- 📅 opens the list of days (the Journal).
- The bottom bar captures in one tap: **Write** · **Voice** · **Work** · **Photo · doc**.

## On the phone: the ☰ menu

☰ opens the menu over the page, on every screen.

- **At the top, search**: type #1234 or part of a title, and the work's card opens.
- **The tiles**, with their counts: Today, Works, Production, Ideas, Orders, Logistics, Events, Journal. Admins also see the Feed.
- **"Everything else"** (folded): all the other screens.
- **"Actions"** (folded): Sale, Contact (business card), Document, Issue, Pipeline, Triage.
- **At the bottom**: your account, the language (FR / EN), sign out.

On the other screens, the "Today" chip at the top right takes you back to the day.

## On the computer: the sidebar

Screens are sorted into groups:

- **Kaizen**: Operations & Strategy, and this Help.
- **Catalogue**: Inventory, Reports, Themes / Groups, Constellation, Timeline, Slideshows.
- **Field**: Production, Journal.
- **Studio**: Overview, Pipeline, Exhibitions, Ideas, Supplies.
- **Business**: Orders, Contacts, Map, Logistics, Income & Expenses, Vault.
- **Public**: Public site, Portfolio, Analytics.

Everywhere:

- **⌘K** (Mac) or **Ctrl+K** (PC) opens search: a work, a screen, an action.
- Clicking a work opens its card at the side.
- The **FR / EN** buttons in the header change the language.

## This guide

- Each chapter carries the date it was checked in the app. If the screen no longer matches the guide, the screen is right: report it in Kaizen → Operations & Strategy (+ New entry).
- What changed since: Kaizen → Operations & Strategy → **What's new**.
- The guide follows the app's language.
`,
  },
  {
    id: 'works',
    title: 'Works',
    verified: '2026-11-18',
    md: `
Every work has a number (#2407) and a card. The card opens the same way everywhere: click or tap the work.

## Finding a work

**When:** you are looking for one work, or a set of works.

1. **On the phone**: ☰, then type #2407 or part of the title in the search at the top of the menu.
2. **On the computer**: ⌘K (Mac) or Ctrl+K (PC), then the number or the title.
3. **For a set**: Catalogue → Inventory. The "Search…" box takes a title or #number; the lists next to it filter by theme, group, state, period, place and source. "Filters +", "Colours" and "Periods & sources" go further.

**Next:** clicking a row opens the card. "Report" opens Reports on the works (print, XLSX, CSV, PDF).

## Reading and editing the card

**When:** you fix a title, a size, a place, or add information.

1. Open the card. "Folded" shows the essentials, "Expanded" shows everything.
2. From top to bottom: the photos; the title; **Production** (In production, Catalogued, Available) and **Ownership** (Studio, Reserved, Consigned, On loan, Sold, Gift, Archive); owner, custodian, technique, support, dimensions, period; then the folding parts: **Création** (period and source, creation history, notes, themes, links with other works, field sessions) and **Object** (provenance, logistics, presentation, value, groups, condition reports, QR label).
3. Edit, then **Save** at the bottom. "Cancel" goes back to the card as it was.

**Next:** if you are not an admin, the change goes for approval ("Submitted for admin review"): it shows on the card once accepted.

**Watch out:**
- **Lines** in "Comments & notes" count at once, without approval: Pem reads them in his Feed.
- Leaving a changed card without saving: the app asks first.

## Recording a new work on the phone

**When:** a work starts or has just been made.

1. In the bottom bar, tap **Work**, then **New work**.
2. **Add the picture**: pick the image from the phone's photo library (several at once if needed).
3. Fill in what you know: title, technique, support, format, dimensions (cm), place ("Nearest place" suggests a saved place within 2 km), period, source, note. "All fields" opens the rest.
4. **Create the work**.

**Next:** the work gets its number ("Work #… created"). A voice note can open right after, if you asked for it. If you are not an admin, the new work waits for approval.

**Watch out:** an unsaved draft is kept on the phone and picked up next time ("Draft from … picked up"); "Clear" throws it away.

## Recording a rework

**When:** Pem works again on a work that already exists.

1. **Work**, then **Rework a work**.
2. Find the reworked work (number or title).
3. Add a picture, the rework date and a "what changed" line (ground, glaze…).
4. **Add to #…**.

**Next:** the picture goes at the end of the picture strip and a "Rework" line goes into the creation history. The work keeps its number.

## Adding photos

**When:** a work needs its photos, or better photos.

1. Prepare the photos in Lightroom and export them as JPEG to the phone's Photos.
2. Open the work's card, tap the **+** box in the picture strip, then pick the photos.
3. **Android only**: you can also, from Lightroom or the gallery, Share → PEM Workshop. The images land in "Share inbox", where you choose a new work, one work per image, or attach them to an existing work.
4. **iPhone**: the Share menu does not list the app; use the card's **+** box, or the "Import from this device" form on the Share inbox page.

**Next:** in the picture strip, drag ⠿ to change the order: the first image is the cover. If you are not an admin, the photos wait for approval ("Pictures awaiting approval").

**Watch out:** the app shrinks and converts each image once, on upload. Keep the originals in Lightroom.

## Making a condition report

**When:** you check a work's condition (arrival, departure, loan, framing), or you see a problem.

1. Card → Expanded → **Condition reports** → **+ New report**.
2. Kind **Examination**, date, condition (Excellent, Good, Fair, Poor, Critical), examined by (empty = you), notes.
3. For each issue: what it is (crack, stain…), where (top left corner, back…), a photo, then **Add issue**.
4. **Save report**.

**Next:** the report stays on the card with its date and author; it can be edited later.

**Watch out:** a destruction, a loss or a theft are also recorded with a report, but only an admin can save them.

## The QR label

**When:** you label a work, or want to find a labelled work.

1. Card → Expanded → **Physical label** → **Print** (or "Copy link").
2. To read a label: bottom bar → **Photo · doc** → **QR label**, or the phone's camera.

**Next:** the label opens the work's card in the Atelier (you need to be signed in).
`,
  },
  {
    id: 'production',
    title: 'Production',
    verified: '2026-11-18',
    md: `
Production (Field → Production) is the board of the steps left to do on the atelier's works.

## Reading the board

- One column per step: Catalogue, Photography, Retouching, Mounting, Framing, Exhibition, Shipping. The number at the top of a column counts its works.
- A work not yet catalogued is in Catalogue; once catalogued, in Photography while its photo is still to do. The other columns add up when one of their steps is open.
- A finished work with no open step, or a sold, lost or destroyed work, is not on it.
- The top line sums up: on the board, available, PEM archives, other statuses.
- "Material overview" lists the open material reports (interventions, anomalies, points to sort).
- The "Filter by title, ID, technique…" box narrows the board.
- "Entrusted outside the studio" (folded) shows works gone to a craftsperson, with their order.

## Moving a work along

**When:** a step is done.

1. On the work's card, in the step's column, tap **✓** ("Mark step done").
2. ✎ or a click on the card opens the work's card.

**Next:** the step closes and the card leaves the column.

**Watch out:**
- ✓ in **Photography** validates the photo. For a catalogued studio work, the app asks first: "It will become Available and show on the website." Cancel changes nothing.
- On the computer, you can drag a card back to an earlier column to reopen a step; onto Catalogue, the work goes back to the studio stage. You cannot drag onto Photography: only ✓ leads there.

## Adding a work to a step

1. The **+** at the top of a column: find the work, it joins the column.
2. "Columns" (top right, next to "Report") manages the columns themselves: name, colour, what ticking the step changes on the work.
`,
  },
]
