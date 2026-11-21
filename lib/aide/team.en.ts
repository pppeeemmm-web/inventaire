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
- A team member sees almost everything. Only the admin (Pem) records a new work, a card change or a photo directly; the team's wait for his approval (see Getting started → What waits for Pem's approval). A few screens are for admins only.

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
- **"? Help for this screen"**: the chapter of this guide about the screen open under the menu.
- **"Everything else"** (folded): all the other screens.
- **"Actions"** (folded): Sale, Contact (business card), Document, Issue, Pipeline, Triage.
- **At the bottom**: your account, the language (FR / EN), sign out.

On the other screens, the "Today" chip at the top right takes you back to the day.

## What waits for Pem's approval

Pem (the admin) records everything directly. For a team member, the app makes two groups.

**Waits for approval** (the message "Submitted for admin review" says so):
- a new work, on the phone or on the computer;
- a change to the card saved with **Save** (title, status, dimensions, owner, themes, groups…);
- a photo added to a work, including a rework's or a shared one ("Pictures awaiting approval").

Until Pem approves, nothing changes on the work. Pem can also reject it. Your proposals and what Pem did with them are in the Overview, "For you": "Waiting for Pem", "Approved on …", or "Rejected on …" with its reason ("Reason: …", or "Rejected, no reason given.").

**Counts at once:**
- lines in "Comments & notes", the Journal's writings and voice notes;
- a work's period, source and creation history, including the "Rework" line;
- condition reports (see Works → Making a condition report);
- proposed ideas, discussion lines, contacts, supplies.

## On the computer: the sidebar

Screens are sorted into groups:

- **Kaizen**: Operations & Strategy, and this Help.
- **Catalogue**: Inventory, Reports, Themes / Groups, Constellation, Timeline, Slideshows.
- **Field**: Production, Journal.
- **Studio**: Overview, Pipeline, Exhibitions, Ideas, Supplies.
- **Business**: Orders, Contacts, Map, Logistics, Income & Expenses, Vault.
- **Public**: Public site, Portfolio, Analytics.

Everywhere:

- **⌘K** (Mac) or **Ctrl+K** (PC) opens search: a work, a screen, an action, the text of an inspiration photo.
- Clicking a work opens its card at the side.
- **?** in the header (or the **?** key) opens help for the screen you are on, over the page, with a search. Esc closes it.
- The **FR / EN** buttons in the header change the language.

## This guide

- Each chapter carries the date it was checked in the app. If the screen no longer matches the guide, the screen is right: report it in Kaizen → Operations & Strategy (+ New entry).
- What changed since: Kaizen → Operations & Strategy → **What's new**.
- The guide follows the app's language.
- **"Download the guide (PDF)"**, under the contents: the whole guide, laid out, to read or print away from the computer. It is always the same text as the Help.

## Reference: phone and computer

Every screen opens on both. The phone is for quick capture; the computer for lists, tables and long forms.

### On the phone

- **The bottom bar**: **Write** (a Journal entry), **Voice** (a voice note), **Work**, **Photo · doc**.
- **Work**, on Today, offers three choices: **New work** ("A new number: photo, title, technique, size"), **Resume a work** ("Same number: a photo and a « Reprise » line"), **Session photos** ("Lightroom → Share to PEM"). On the other screens, for a team member, Work opens the Journal: go through Today to record a work.
- **Session photos**, for a team member: the photos stay in the session and show on the work when Pem applies them.
- **Photo · doc** offers: **Document** ("Scan one or more pages; the text is read later on the PC"), **Business card** ("New contact from a card"), **QR label** ("Scan a work's label"). Admins also have **Inspiration**.
- **The ☰ menu**: search, the tiles, "Help for this screen", "Everything else", "Actions", your account and the language.
- **"Actions"**: Sale / payment ("Complete a sale", see Orders), Contact, Document, Issue, Pipeline, Triage.

**What only the phone does:** reading a business card's text (Live Text, on iPhone), dictating a voice note, reading a QR label with the camera, and on Android receiving images from another app (Share → PEM Workshop).

### On the computer

- The sidebar, **⌘K / Ctrl+K** and the **?** key (see above).
- **What only the computer does:** dragging a card from one column to another in Production, creating an event, and for the admin running the PC's jobs (transcription, search).
- Reports, exports and pivot tables read better on the computer.
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

**Next:** if you are not an admin, the change goes for approval ("Submitted for admin review"): the card changes only once Pem has accepted it.

**Watch out:**
- **Lines** in "Comments & notes" count at once, without approval: Pem reads them in his Feed.
- In **Création**, the period, the source and the creation history are also saved at once, without **Save** and without approval.
- Leaving a changed card without saving: the app asks first.

## Recording a new work on the phone

**When:** a work starts or has just been made.

1. In the bottom bar, tap **Work**, then **New work**.
2. **Add the picture**: pick the image from the phone's photo library (several at once if needed).
3. Fill in what you know: title, technique, support, format, dimensions (cm), place ("Nearest place" suggests a saved place within 2 km), period, source, note. "All fields" opens the rest.
4. **Create the work**.

**Next:**
- **Pem**: the work gets its number ("Work #… created"), with its photos, place, period and source. A voice note can open right after, if you asked for it.
- **A team member**: the new work goes for approval ("Submitted for admin review"). It has no number yet. The card's fields go with it; the photos, place, period and source do not: add them once the work is approved.

**Watch out:** an unsaved draft is kept on the phone and picked up next time ("Draft from … picked up"); "Clear" throws it away.

## Recording a rework

**When:** Pem works again on a work that already exists.

1. **Work**, then **Resume a work**.
2. Find the reworked work (number or title).
3. Add a picture, the rework date and a "what changed" line (ground, glaze…).
4. **Add to #…**.

**Next:** a "Rework" line goes into the creation history at once ("Rework added to #…"). The work keeps its number. The picture goes at the end of the picture strip: directly for Pem; for a team member, it waits for approval ("Pictures awaiting approval").

## Adding photos

**When:** a work needs its photos, or better photos.

1. Prepare the photos in Lightroom and export them as JPEG to the phone's Photos.
2. Open the work's card, tap the **+** box in the picture strip, then pick the photos.
3. **Android only**: you can also, from Lightroom or the gallery, Share → PEM Workshop. The images land in "Share inbox", where you choose a new work, one work per image, or attach them to an existing work.
4. **iPhone**: the Share menu does not list the app; use the card's **+** box, or the "Import from this device" form on the Share inbox page.

**Next:**
- **Pem**: the photos are on the work at once.
- **A team member**: the photos wait for approval ("Pictures awaiting approval") and show on the card only once accepted. For a work that is itself awaiting approval, wait until it is approved before adding its photos.
- In the picture strip, drag ⠿ to change the order: the first image is the cover.

**Watch out:** the app shrinks and converts each image once, on upload. Keep the originals in Lightroom.

## Making a condition report

**When:** you check a work's condition (arrival, departure, loan, framing), or you see a problem.

1. Card → Expanded → **Condition reports** → **+ New report**.
2. Kind **Examination**, date, condition (Excellent, Good, Fair, Poor, Critical), examined by (empty = you), notes; if needed, "Action / treatment" and its follow-up (To do, Done).
3. For each issue: what it is (crack, stain…), where (top left corner, back…), a photo (12 MB at most), then **Add issue**.
4. **Save report**.

**Next:** the report counts at once, without approval. It stays on the card with its date and author.

**Who can do what, today:**
- Any team member can make an **Examination** report on any work, and add an issue to any report.
- Only a report's author and the admin can **Edit** it; an issue is removed by its author or by the admin.
- **Delete report** is for the admin only.
- A **Destruction**, a **Loss** or a **Theft** are also recorded with a report, but only an admin can save them ("Only an admin can record a destruction, a loss or a theft."), and mark a work "Found".

## The QR label

**When:** you label a work, or want to find a labelled work.

1. Card → Expanded → **Physical label** → **Print** (or "Copy link").
2. To read a label: bottom bar → **Photo · doc** → **QR label**, or the phone's camera.

**Next:** the label opens the work's card in the Atelier (you need to be signed in).

## Reference: the card, part by part

"Folded" shows the whole top of the card, Création and Object closed, the empty fields gathered on one line. "Expanded" opens Création and Object, with the empty fields greyed in place.

### The top of the card

- **The photos**: the picture strip ("⠿ drag to reorder · the first = cover"). On a photo: "Download the original", "Replace with the retouched file", and for the admin "Delete this picture (admin)".
- **The title.**
- **Production**: where the record stands. **In production** ("Work in progress") → **Catalogued** ("Photo pending") → **Available** ("Ready for release"). Tap the next stage to move on; tap "photo needed" when the photo is done. Once the work has left the studio: "Production closed: the work has left the studio. Its state follows its order."
- **Ownership**: who owns the work (see What the app does by itself → Reference).
- **Owner**, **Custodian** (who has the work in hand) and their **Address ▾**, **Buyer** for a sale: "Managed by its order (sale, consignment, loan): owner and custodian change with it."
- **Year** or **Period**, **Technique**, **Support**, **Format**, **Dimensions** (cm; a diameter for a round work).
- **The chips**: "Public" or "Not public" (set by the database, read only); a shipment under way; "… session photo(s) to review"; "Entrusted · with …"; the fate of a destroyed, lost or stolen work.

### Création

- **Period & source**: the working period (automatic from the history, or picked by hand) and the sources (memory, motif, photo…), with a note per source.
- **Creation history**: the dated steps of the work (place, date, note), including the "Reprise" lines.
- **Comments & notes**: the note lines, and the linked voice notes.
- **Themes.**
- **Links to other works**: a number and a "Link type": Painted on, Derived from, Answers, Same series as, Diptych with, Influence with, Close to. The link reads both ways ("Painted over by", "Gave rise to", "Answered by").
- **Field sessions**: the photographed sessions of this work.
- **✦ Seen by AI**: a description suggested by the AI, to judge ("Useful?").

### Object

- **History / provenance**: the work's dated log (statuses, owners, moves). The app writes in it by itself; you can add a line by hand. The admin also sees "Data history" there.
- **Logistics**: the shipments linked to the work, the delivery date and the return date.
- **Presentation**: the gates: **Mounted** (on a stretcher / backing), **Framed**, **Showable** ("Physically ready to show: mounted, framed, varnished. ≠ Available"), **Ready for broadcast** and the **Broadcast note**; then the **Presentation**: Non montée, Montée, Marouflée sur carton, Marouflée sur toile, Roulée.
- **Contact confidentiality**: how the owner's name is shown (Public, Masked, Private).
- **Value**: **Base price (€)**, **Discount (%)**, **FINAL AMOUNT (EXCL. TAX)**, **VAT (%)**, **Payment received** (filled by the order when there is one), **Commission** (a work made to order, with its client). "Costs (admin)" for the admin.
- **Groups.**
- **Condition · reports**: the condition reports (see above).
- **Fate**: "neither destroyed nor lost — set through a condition report".
- **Physical label**: the QR label.
- **Trash**: "Move to trash…". **Admin zone**: "Delete permanently…" (admin).

**Watch out:** some parts save by themselves, without **Save**: Period & source, Creation history, Comments & notes, Links, Field sessions, Seen by AI, and condition reports. The rest of the card (themes and groups included) waits for **Save** at the bottom ("● unsaved changes").
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
  {
    id: 'day',
    title: 'The day and the Journal',
    verified: '2026-11-18',
    md: `
The Journal keeps one page per day: the writings, voice notes, photos and works of that day. On the phone, the day's page is called **Today**.

## Reading the day

- At the top: the date, ‹ › to change day, 📅 for the list of days.
- Under the date: how many entries, works and notes that day, then **Past due · Today · Review · Inbox**: the field queue (reminders, sessions to review, shares, issues). A tap opens it.
- **See again today** brings back an old entry or two close works. "Open the day" goes there; "Later" puts it off for 7 days; "1 / 3 ›" moves to the next.
- Then the works of the day, and the writings and notes of the day.

## Writing an entry

**When:** a thought, an observation, a spark, to keep.

1. Bottom bar → **Write**.
2. Pick the kind: Spark, Trigger, Reflection or Note.
3. Write it as it comes. Type **#2399** in the text to link work no. 2399.
4. **Add**.

**Next:** the entry is added to that day ("Saved on this day").

**Watch out:** an entry cannot be edited. To correct it, add a new one.

## Recording a voice note

**When:** speaking is faster than writing.

1. Bottom bar → **Voice**. Recording starts at once.
2. Speak. When the phone allows it, the words appear on screen as you speak.
3. **Stop and save**.
4. If you like: add details afterwards (optional).

**Next:** the note is kept with its date and time, and shows in the day's writings and notes. "Link…" on the note ties it to a work, an idea or a project. A fuller transcript comes later, made on the studio PC.

**Watch out:**
- "Microphone not available": allow the microphone for the site in the browser settings, then "Retry"; or "Write a note" instead.
- "Not saved": tap "Retry saving" before closing, the audio is still there.

## Finding a day

1. On the phone: 📅 on Today, or the **Journal** tile in the ☰ menu.
2. Tap a day to open it, or "Go to" to pick a date.

**Watch out:** the whole team reads the Journal; only admins capture or edit a work session.
`,
  },
  {
    id: 'ideas',
    title: 'Ideas',
    verified: '2026-11-18',
    md: `
Ideas (Studio → Ideas) gathers Pem's projects and concepts. Pem decides on ideas; the team reads them, discusses them and proposes new ones.

## Reading an idea

1. The chips at the top filter by weight and by maturity; "Search ideas…" looks in the titles.
2. Tap an idea to open it: weight, maturity, notes and discussion.

## Adding a line to the discussion

1. Open the idea.
2. Write in "Add a line…", then **Add**.

**Next:** the line shows under the idea, with its date.

## Proposing an idea

1. **Propose an idea**.
2. Your idea in a few words; a work (#1234) if it relates to one.
3. **Send to Pem**.

**Next:** it goes straight into Pem's feed, and he decides what follows.
`,
  },
  {
    id: 'orders',
    title: 'Orders',
    verified: '2026-11-18',
    md: `
An order follows every work that leaves the atelier's hands, with its steps and its papers. Five kinds: **Sale**, **Consignment** (with a gallery), **Loan**, **Gift**, and **Entrusted** (with a craftsperson: framer, restorer…).

## Creating an order

**When:** a sale is agreed, a gallery takes works, a loan or a gift is being prepared, a work goes to a craftsperson.

1. Business → Orders → **+ New order** (easier on the computer).
2. **Which kind?**
3. **Works**: number or title, then Add.
4. **With whom**: the buyer, the gallery, the borrower, the recipient or the craftsperson.
5. The address the works go to (or "To set later").
6. Depending on the kind: the price and deposit (sale), the commission (consignment), the out and return dates (consignment, loan).
7. **Create the draft**.

**Watch out:** a work already on another open order is refused, with its number.

## Moving an order along

Open the order: its **Steps** are ticked in order with the next step's button.

- **Sale**: Draft → Signed (reserves the works) → Deposit → Paid (the buyer becomes the owner) → Delivered.
- **Consignment** and **Loan**: Draft → Signed → Out (with the gallery or the borrower) → Back at the studio.
- **Gift**: Draft → Deed signed (nothing moves yet) → Handed over (the recipient becomes the owner and holds the work).
- **Entrusted**: Draft → Entrusted (with the craftsperson) → Back at the studio.

**Next:** each step updates the work (status, owner, custodian); you do not have to do it on the card.

## The money

1. **Record a payment**: amount received, method, date, then "Save the payment". "Received" and "Left to pay" update.
2. A sale can be returned for **14 days** after delivery or hand-over: "Return (14-day right)". Until then, the money is marked "held — not definitive yet".

**Watch out:** the app never moves money. A return shows the amount to refund; the refund is made at the bank.

## The papers

1. **Make the paper** creates the order's document (in the Vault).
2. Once signed: **Add the signed copy** (PDF or photo, 4 MB at most).

## Cancelling

**Cancel the order** closes it; its works leave a shipment that has not left yet.

## Reference: steps and papers

### The steps, kind by kind

Each step button asks first: "Move to this step? The works change status, owner or custodian as the step says, with a line in their history."

- **Sale**: Draft → **Mark signed (reserves the works)** → **Deposit received** → **Paid in full (the buyer becomes the owner)** → **Delivered (the buyer holds the work)**. Then 14 days during which a return is possible.
- **Consignment**: Draft → **Mark signed** → **Out — at the gallery** → **Back at the studio**.
- **Loan**: Draft → **Mark signed** → **Out — with the borrower** → **Back at the studio**.
- **Gift**: Draft → **Deed signed (nothing moves until the hand-over)** → **Handed over (the recipient becomes the owner and holds the work)**.
- **Entrusted**: Draft → **Entrusted — with the craftsperson** → **Back at the studio**. The work keeps its stage and its owner; only the custodian changes.

Finished orders show with "+ closed": delivered, back, handed over, returned, cancelled.

### What the steps do by themselves

- **Signed** (sale, consignment, loan): the paper is made again without the "Draft" mark, and a shipment (or a collection) opens in Logistics.
- **Paid** (sale): one certificate of authenticity per work.
- **Delivered** (sale): the 14 return days start; a reminder comes on the day they end ("Return period ends").
- **Handed over** (gift): the deed of gift is made again, dated with the hand-over.
- **Entrusted**: the entrustment note is made when the work goes out.
- **Cancel the order**: "Works it reserved become available again."

### Each work's value on the order

By kind: **Sale price** (sale), **Agreed price** (consignment), **Insurance value** (loan, Entrusted), **Reference value (never printed)** (gift). Empty = the work's price today. After signing, a changed value means making the paper again and having it signed again.

### Money (sale)

- **Catalogue price (total)**, **Discount %**, **Final price (total)** (worked out as you type, can be changed), **Deposit %**. The final price includes VAT.
- VAT is read from each work (card → Value). "VAT: to be set (accountant)" while the rate is not decided.
- **Record a payment**: part of the price moves the sale to "Deposit" (works reserved); the whole price, to "Paid".
- **Taken away today**: "Paid and taken away at the studio: the sale becomes « Delivered » as soon as it is paid, and the 14 return days start."
- A return shows "To refund: … — the app moves no money". Once the transfer is made: **Mark refunded**, with its date.
- A sale of a consigned work: the gallery's commission is recorded at payment.

### Each kind's paper

One paper per order, in French with an English line:

- **Sale**: **Bon de commande** (purchase order).
- **Consignment**: **Bordereau de dépôt-vente** (consignment agreement).
- **Loan**: **Contrat de prêt** (loan agreement).
- **Gift**: **Acte de don** (deed of gift).
- **Entrusted**: **Bon de confiage** (entrustment note).

1. **Make the paper** (or **Make the paper again**). Until the order is signed, it carries "Brouillon" (draft).
2. **Open** reads it; **Share** sends the file itself (not a link); on the computer, it downloads.
3. Once signed: **Add the signed copy** (PDF or photo JPEG, PNG, WebP, HEIC; 4 MB at most).

### Invoice and credit note (sale)

- "The invoice is issued once the sale is paid." **Issue the invoice** is for the admin only: "Issue the invoice? Its number is final; a mistake is corrected with a credit note."
- Several paid sales to the same buyer: "Issue one invoice for … orders of this buyer".
- The invoice lists the works, the paid preparations and the shipping. The VAT mention is to settle with the accountant.
- **Make a credit note** cancels an invoice (it stays, marked "cancelled by credit note").

### Certificates (sale)

"Made automatically at payment, to put in the crate." One **certificate of authenticity** per work. If one is missing: **Make the certificates**.

### Around a sale

- **Delivery**: **Shipping** or **Collection (studio or event)**; "Shipping and insurance (paid by the buyer)": an amount, empty = included.
- **Preparation asked**: **Framing**, **Mounting**, **Dedication / signature**, with a detail and a price (empty = included). Each demand is ticked "Done" before packing; otherwise the shipment refuses: "Preparation not finished: … open demand(s)." Framing by a craftsperson is done with an "Entrusted" order.

### For every order

- **Shipment**: "Prepare the shipment", "Prepare the collection", or "Return" for a work that is out (see Logistics). On a shipment, **+ Report a claim**: insurer or carrier, claim no., police report no. (theft), amount claimed; then Open, Paid, Refused or Withdrawn.
- **Calendar**: "Put the dates in my calendar" (works go out, due back, planned delivery, end of the return period). A connected calendar is needed.

### Selling on the phone

☰ → Actions → **Sale / payment** ("Complete a sale"): **Works** → **Buyer** → **Payment** → **Review**, then **Create and finish**. With no payment, it is a draft to sign in Orders; with a payment, the order is signed, a deposit reserves the work and the full price makes it sold.
`,
  },
  {
    id: 'logistics',
    title: 'Logistics',
    verified: '2026-11-18',
    md: `
Logistics (Business → Logistics) shows the shipments under way. A shipment carries one or more orders going to the same address.

## Preparing a shipment

1. Open the order, then **Prepare the shipment** (or **Prepare the collection** when the work is collected at the studio or at an event).
2. The shipment shows in Logistics.

## Moving a shipment along

The steps are ticked in order, with "Move to « … »". For a shipment: Open → Condition photos → Picked → Packed → Insured → Label + tracking → Shipped → Delivered. A collection ends with "Handed over".

Fill in along the way: carrier, tracking no. and link, parcel size and weight, packing materials, insured value, insurer.

**Next:** "Show finished shipments" finds the delivered ones.

**Watch out:**
- "Cancel the shipment" leaves the works on their orders.
- An order cancelled or returned takes its works off a shipment not yet gone; an empty box is cancelled. A shipment already on the road is left as it is.
`,
  },
  {
    id: 'events',
    title: 'Exhibitions and events',
    verified: '2026-11-18',
    md: `
Exhibitions & events (Studio → Exhibitions) brings together exhibitions, collaborations and edition launches, with their works and their orders. On the phone you read them; you create them on the computer.

## Creating an event

1. **+ New event**.
2. Kind (Exhibition, Collaboration, Edition launch) and name, then **Create**.
3. Fill in: status (To confirm, Planned, On, Ended), place (a contact, or the studio), start and end, link, notes.
4. **People**: + person, with their role (venue, curator, organiser, gallery, partner, printer).

## An event's works

1. **Works**: create the selection from the works picked in Inventory, link an existing group, or **+ Works** to search for one.
2. **To prepare**: one column per preparation (presentation, label…), ticked work by work.
3. **Linked orders**: tick works, choose the order kind and the other party, then "Create the order".

**Next:** "Export to calendar" sends the event to a calendar. The list groups events on now, coming and past, with the works out and the returns due soon.
`,
  },
  {
    id: 'contacts',
    title: 'Contacts',
    verified: '2026-11-18',
    md: `
Contacts (Business → Contacts) gathers collectors, galleries, craftspeople, suppliers, friends and institutions.

## Finding a contact

1. The search box looks in the name, institution, city, email and notes; the "everywhere" and "all roles" lists narrow it.
2. The **Works**, **Holds** and **Bought** columns count the works the contact owns, the ones they keep, and the ones they bought.
3. Clicking a row opens the contact's card.

## Adding a contact

- On the computer: **+ New contact**.
- "Google CSV" imports a Google contacts export; "URL" suggests a contact from a web page, with a preview before creating it.

**Watch out:** an email already used by another contact is refused.

## A business card, on the phone

**When:** someone hands you a card, at a fair or in the street.

1. Bottom bar → **Photo · doc** → **Business card**.
2. Photograph the card.
3. Tap the text box twice, "Scan Text" (Live Text), point at the card, then **Analyse**: the contact fills in at once, with no AI and no studio network.
4. If you like: **Improve with AI** (stops after 30 s; the contact stays as it is if the AI does not answer).
5. Check the preview, then **Create contact**.

**Next:** the card's photo is kept with the contact, in the Vault (Business).

**Watch out:**
- A name or an institution is needed.
- **Improve with AI** works only when the app runs on Pem's computer, where the studio's AI is installed. On the phone and on the team's computers it is not available (unless installed): skip this step, "Analyse" is enough.
- Likewise, "URL" in Contacts reads the page without AI (name, email, phone, when the page gives them); the AI fills in the preview only on Pem's computer. Check the preview before creating.
`,
  },
  {
    id: 'supplies',
    title: 'Supplies',
    verified: '2026-11-18',
    md: `
Supplies (Studio → Supplies) keeps the studio's stock: colours, binders, supports, equipment. Four tabs: **Stock**, **Count**, **Restock / Order**, **Orders**.

## The stock

1. Search an item by name or notes; filter by category or supplier; "low stock only" shows what is under its threshold.
2. **−** and **+** adjust a quantity in one tap; **Edit** opens the item.
3. **New item** adds a material; "Suppliers" (folded) lists the suppliers.

## Counting

1. **Count**: for each item, the recorded quantity ("System") and the counted quantity, adjusted with − and +.
2. "Differences only" shows only what differs.
3. **Apply** updates the stock with what was counted.

## Ordering and receiving

1. **Restock / Order** lists what is missing or under its minimum, by supplier. Type the quantities "To order", then "Copy order" copies its text. The minimum is set here and lights the "Low" badge.
2. **Orders** follows supply orders; **+ Order** creates one by hand.
3. On delivery: **Receive…**, with the quantities received; "Receive the rest…" for a delivery in several parts.

**Next:** the stock updates on receipt.
`,
  },
  {
    id: 'reports',
    title: 'Reports',
    verified: '2026-11-18',
    md: `
Reports (Catalogue → Reports) makes lists to print or export, from six sources: Works, Production, Condition reports, Kaizen, Sales, Contacts.

## Making a report

1. Pick the source (tabs at the top).
2. **Fields**: tick the ones to show; ▲ ▼ change their order; "Filter" on a field keeps only some values.
3. "Search in the report…" narrows the list further.
4. **Print**, **Export XLSX**, **CSV** or **Export PDF** at the bottom.

## Keeping a report

"Save as…" keeps it under a name; "Saved reports" opens it again.

## Crossing the data

- **Pivot** counts and adds up by rows and columns (for example: works by year and by technique).
- "Pivot Atlas (graph)" shows the same data as a graph.
`,
  },
  {
    id: 'public',
    title: 'Public site, Portfolio, Analytics',
    verified: '2026-11-18',
    md: `
The Public group sets what the world sees: the www.thepemworkshop.com site, the PDF portfolio, and the visits.

## What shows on the site

A work is public when it is Available, Reserved, Sold, Consigned, on Loan or given, and neither destroyed nor lost. The app decides from the status: nothing is ticked by hand.

## Public site

- At the top: **Site**, **↓ PDF** and **/works** open the site, the portfolio PDF and the works page; the publish button puts the settings online (the date of the last publication is under it).
- **Composition**: the blocks of each page (Home, Works, About); add, reorder, hide.
- **Ambiance**: the light and shadows of each page, with rotary knobs.

## Portfolio

**Portfolio sections**: each section has a title, a text, a theme and the order of its works; together they make the downloadable PDF. **+ Add** creates a section; "Edit the text" opens its text.

## Analytics

The site's visits: page views and visitors (without Atelier sessions), the trend per day, the most viewed pages, countries and sources. "Site pages" or "All (raw)", and 7, 30 or 90 days at the top.
`,
  },
  {
    id: 'rules',
    title: 'What the app does by itself',
    verified: '2026-11-18',
    md: `
Some rules are kept by the database: every screen follows them, and nobody has to do them by hand.

## A work's path

- A work goes through three stages: **studio** (not catalogued yet), **catalogued, photo to take**, **ready** (catalogued and photo validated). It can go back.
- Cataloguing needs at least one photo.
- In the studio, the status follows the stage: **Available** when ready, **In production** otherwise.
- Production steps follow the stage: "Catalogue" stays open while the work is not catalogued, "Photograph" while the photo is still to do.
- Production ends the day the work becomes ready; going back clears that date and writes it in the history.
- **Archive**: the work is catalogued first, its steps are paused; it only comes out by choice.

## Who has the work

- A work only leaves the studio through an order: sale, consignment, loan, gift or Entrusted.
- The owner, the custodian and the address follow the order's steps.
- Every change of status, owner or custodian leaves a dated line in the history.

## Accidents

- A destruction, a loss or a theft are recorded with a condition report. Its open orders close; a destroyed work closes its steps, a lost work pauses them (they come back if it is found).
- A destroyed or lost work is never "Showable".
- A work put in the bin pauses its steps; they come back if it is taken out of the bin.
- Only an admin can delete a sold or given work.

## The site

What is public follows from the status (see Public site). Validating the photo of a studio work makes it Available and visible: the app asks first.

## Reference: statuses and stages

### The card's three stages (Production)

1. **In production** ("Work in progress"): in the studio, not catalogued yet. Open step: Catalogue.
2. **Catalogued** ("Photo pending"): described, with at least one photo; the catalogue photo is still to take. Open step: Photograph.
3. **Available** ("Ready for release"): catalogued and photo validated. For a studio work, it becomes visible on the site.

### Ownership (on the card)

- **Studio (Pem)**: "Full ownership".
- **Reserved**: "Sale in progress". Through a signed sale order.
- **Consigned**: "Gallery / no title transfer". Through a consignment order.
- **On loan**: "Institution / no title transfer". Through a loan order.
- **Sold**: "Title transferred". Through a sale order paid in full.
- **Gift**: "Title transferred". Through "Gift…", a gift order.
- **Archive (Pem)**: "Withdrawn from circulation". The work must be catalogued first.

Reserved, Consigned, On loan and Sold are closed on the card: they go through their order ("Prepare an order for this work (a draft, signed in Orders)."). A work with a craftsperson keeps its ownership and shows "Entrusted · with …".

### The statuses in the lists

The Inventory, the reports and the chips show one word per work. These chips are in French in both languages:

- **En production** (in production); **Catalogué** (yellow chip: catalogued, photo to take); **Disponible** (available);
- **Réservé** (reserved), **Consigné** (consigned), **Prêt** (on loan), **Vendu** (sold), **Don** (gift);
- **Archive (Pem)**;
- **Détruite** (destroyed), **Perdue** (lost), **Volée** (stolen).

**Public** (on the site): Available, Reserved, Consigned, On loan, Sold, Gift, with no destruction, loss or theft. **Not public**: In production, Catalogued, Archive, Destroyed, Lost, Stolen. The card's "Public / Not public" chip says so, read only.

A work sold or given, then destroyed, lost or stolen, keeps "Vendu" or "Don", with the mention "destroyed", "lost" or "stolen".

### The gates (Object → Presentation)

Four boxes, independent of the status: **Mounted**, **Framed** (also ticked by the Production steps), **Showable** (physically ready to show; never for a destroyed or lost work, or one in the archive), **Ready for broadcast** (posting on social media, followed by the admin).

### Fate

"neither destroyed nor lost — set through a condition report". After a destruction, a loss or a theft: "Stages locked: close or delete the loss / destruction report to change them."
`,
  },
  {
    id: 'faq',
    title: 'FAQ and troubleshooting',
    verified: '2026-11-18',
    md: `
The questions that come back, and the app's messages word for word, with what to do.

## Works and cards

### I saved, but the card did not change

"Submitted for admin review": your change is waiting for Pem's approval. The card changes when he accepts it. See Getting started → What waits for Pem's approval.

### My photos do not show

- "Pictures awaiting approval": they show once approved.
- "Submitted for admin review. The images you picked were not uploaded — add them once the change is approved.": it was a new work; it has no number yet. Add the photos once it is approved.

### I cannot find a work

1. ⌘K (Ctrl+K) on the computer, or the search in the ☰ menu on the phone: type #number or part of the title.
2. In the Inventory, check the "Search…" box and the filters: a filter left on hides works.
3. "Partial catalogue · …": the Atelier has loaded only part of the catalogue; "Load next batch" widens the lists.
4. A work moved to the trash no longer shows anywhere: ask Pem.

### The card refuses a status

- "Sold / gift: pick the acquirer (not Pem). Consigned / loan: pick the custodian (not Pem)."
- "A work leaves Pem only through an order (consignment, loan, sale); in production, available or archived, Pem owns and holds it.": go through Orders.
- "Work out of circulation (sold, given, archived, destroyed, lost or already consigned): it cannot be reserved, sold or consigned."
- "Archive: catalogue the work first (a partial record is enough)."
- "Out of the archive straight to Available: the photo must be done. Otherwise, send the work back into production."
- A work with no photo cannot be catalogued: add a photo first.

### I cannot change several works at once

"Changing status, contact, price… on several works is admin only. Themes and groups stay editable; for the rest, use the work drawer (approval)."

### I cannot move a work to the trash

"Only an admin can move a sold or given work to the bin."

### "Unsaved changes"

You are closing a changed card: **Save** keeps your changes, **Close without saving** throws them away, **Cancel** leaves you on the card.

### A place is refused in the creation history

"This place did not exist at that date — pick another place or fix the date."

### A condition report cannot be changed

- "Only the author or the admin can change this report."
- "Only an admin can record a destruction, a loss or a theft.": make an Examination report, and tell Pem.
- "Photo too large (12 MB max)."

## Orders and shipments

### The order is not created

- "Choose who it is with (not Pem)."
- "Add at least one work."
- "A sale needs its final price."
- "A consignment or loan needs its out and back dates."
- "Already on another open order:" followed by its number: open that order, finish or cancel it first.

### A step or a payment is refused

- "This step is not possible from the current one.": reload the order; someone may already have moved it on.
- "This amount is more than what is left to pay (already recorded?). Reload the order."
- "This order can no longer be changed (paid, out, handed over or closed)."
- "The 14-day return period is over: the sale is definitive."

### The shipment cannot be prepared, or does not move on

- "Every work of this order is already on a shipment.": it is already in Logistics.
- "Preparation not finished: … open demand(s).": tick "Done" on each of the sale's demands.

### The signed copy is refused

"File too large (4 MB at most)." or a format other than PDF, JPEG, PNG, WebP or HEIC. On the phone, a photo of the signed paper is enough.

### Where is the invoice?

The invoice is issued once the sale is paid, by Pem. The certificates of authenticity are made by themselves at payment. See Orders → Reference.

## Phone and network

### The microphone does not work

- "Microphone not available": allow the microphone for the site in the browser's settings, then "Retry"; or "Write a note".
- "Not saved": "Retry saving" before closing; the audio is still there.

### No network

- On a card: "Offline: save queued. It will sync when you are back online." The save goes out by itself when the network returns ("Offline queue synced.").
- "Offline" then "This page is not cached. Reconnect to continue, or open the Hub if you have visited it before.": pages already opened stay readable; the others wait for the network.
- For a note: "Write a note" keeps a draft on the phone.

### The Share menu does not list the app

On iPhone, that is normal: use the card's **+** box, or "Import from this device" in the Share inbox. On Android, install the app on the home screen first.

### "Improve with AI" does not answer

Normal away from Pem's computer: "Analyse" is enough. The contact stays as it was read.

### The QR label opens the sign-in page

You need to be signed in: sign in, and the label then opens the card.

## Account

### I lost my password

"Forgot password?" on the sign-in page sends a link by email. A Google-only account signs in with the Google button.

### I no longer have access to the Atelier

Access is given by Pem, on your contact card. Ask him to check "Studio access".

## Reporting a problem

- **A problem with a work or at the studio** (a loose stretcher, a stain…): on the phone, ☰ → Actions → **Issue** ("Report an issue"): a short title, details, a photo if you like, then "Submit report". With a work and a step chosen, it shows in Production.
- **A problem with the app, or a screen that does not match this guide**: Kaizen → Operations & Strategy → **+ New entry**. Say what you were doing, what happened, and the time.
`,
  },
  {
    id: 'glossary',
    title: 'Glossary',
    verified: '2026-11-18',
    md: `
The app's words, in French and English.

- **Œuvre** (Work): a piece by Pem, with its number (#2407).
- **Fiche** (Card): a work's page, which opens at the side.
- **Catalogué** (Catalogued): the work is described and photographed at least once.
- **En production** (In production): the work is in the studio and not ready yet.
- **Disponible** (Available): ready, in the studio, shown on the site.
- **Archive** (Archive): kept by the studio, out of circulation.
- **Réservé, Vendu** (Reserved, Sold): steps of a sale.
- **Consigné / Dépôt** (Consigned / Consignment): left with a gallery that may sell it.
- **Prêt** (Loan): lent for a time, then back.
- **Don** (Gift): given; the recipient becomes the owner at the hand-over.
- **Confié** (Entrusted): with a craftsperson (framer, restorer) for a job.
- **Propriétaire** (Owner): who the work belongs to.
- **Dépositaire** (Custodian): who has it in hand.
- **Commande** (Order): the record of a work leaving the studio, with its steps and papers.
- **Envoi** (Shipment): a parcel or a collection, for one or more orders.
- **Constat** (Condition report): a work's condition on a date, with its issues and their photos.
- **Validation** (Approval): Pem's agreement to a new work, a card change or a photo proposed by the team.
- **Reprise** (Rework): a work worked on again, keeping its number.
- **Période, Source** (Period, Source): when and from what the work was made (memory, motif, photo…).
- **Séance de terrain** (Field session): a photographed work session.
- **Journal** (Journal): one page per day, writings and voice notes.
- **Fil** (Feed): Pem's queue: proposals, lines and drafts to sort (admins).
- **Kaizen**: continuous improvement of the studio and the app; "Operations & Strategy" and this Help.
- **Coffre** (Vault): the documents (order papers, certificates, business cards).
- **Cartel** (Label): the small printed text next to an exhibited work.
`,
  },
]
