# System map — the whole picture before any more building (draft, 2026-11-20)

Pem, after the scope interview: « When we have the bigger picture, we can build solid things that just need tweaks, but not rewritings. » This draft is that picture: what exists, the one spine everything should hang on, and the order in which the existing designs get re-read against it. **Design only — no SQL, no build.** Business questions for Pem are at the end and in the chat.

## 1. What exists (live DB, read only, 2026-11-20)

- ~90 tables. Big data lives in works (`Oeuvres` 1 182, images 1 237, versions 11 489, themes 1 297, descriptions 1 173, work actions 803).
- **A graph spine already exists:** `nodes` (1 673: 1 176 works, 61 contacts, 32 journal entries, 28 themes, 22 concepts, 5 groups) and `tblrelations` (3 772 links). Constellation draws it.
- **Business data is tiny:** 62 contacts, 14 orders, 4 enquiries, 2 expenses, 5 working groups. Nothing commercial is load-bearing yet → the cheapest moment to get the structure right is now.
- **The same fact is stored ten ways.** « This person met these works on this date, for this reason » lives separately in `work_order(_work)`, `event_contact` + `event_work`, `private_link(_work)` (kits), `inquiry`, `shipment(_work)`, `journal_entry_link`, `calendar_event_link`, `payments`, `suivi_process / suivi_reminder`, `work_action`. Each new feature added its own table and screen; that is why each one later needs a rewrite to talk to the others.

Design notes already written (each designed alone): contacts review + contacts as relationships (CatalogueGaps E, I), custody model, R6 events, R7 orders + R7b cascade, collector share kit, products engine (editions), supplies, reverse pricing (J), kit switches (K), R8 site, AI desk.

## 2. The spine — five things, nothing else

| Pillar | Answers | Tables today |
|---|---|---|
| **Works** | what | `Oeuvres` + images, editions / products later |
| **People** | who | `Contact` + addresses, spheres later |
| **Places** | where | custodian + address (custody model), `place` |
| **Moments** | when, why | every touchpoint: order, event, call, kit sent, enquiry, shipment, visit, gift, payment, reminder |
| **Ideas** | creation | journal, concepts, themes, Constellation (separate from business — themes ≠ groups) |

Rule: **every business record is a Moment** = who (people with a role) × what (works, or a group) × when (date) × kind × its paper. One shape.

## 3. The clever part — views, not new layers

If every Moment has that shape, most « CRM features » are **views on what is already stored**, not new tables or screens:

| Wanted (Pem, notes) | Is a view of |
|---|---|
| « Relation » timeline per contact | all Moments of that person |
| Which works were shown to whom | Moments of kind kit / event / visit / enquiry × works |
| Follow-up reminders | last Moment per person + a rule (« no touch in N days after an enquiry ») |
| Birthdays | `born_on` + a yearly rule |
| Provenance lines, COA | custody changes = Moments of kind sale / gift |
| CV generated | Moments of kind event / call / press |
| Sales report | Moments of kind sale + payments |
| Map of where works are | custody (Places) |
| Collector « first look » | sphere « collectors » × new works |

**No migration needed to start:** one read-only database view (a union over the ten tables above) gives the timeline today. New business features then add a *kind* or a *rule*, not a table and a tab. That is « build and test, then tweak » instead of « build, test, add, rewrite ».

## 4. What this changes in the roadmap (proposal for the lead — TODO is the main checkout's)

1. **Before any §3 design is built:** agree this map (one page).
2. **Re-read each existing design against it** and mark, per item, « new table », « new kind » or « view »: contacts as relationships, R6 events, R7 orders, kits, editions, reverse pricing, insights (step 7). Expect most to shrink.
3. **Then build in this order:** the Moment view (read only) → the contact page with its timeline → rules (reminders, birthdays) → papers and reports on top.
4. Ideas side (Journal sketchbook, Constellation → digests → 3D) stays separate and follows the scope interview order.
5. Wind-down 2026-12-17 / freeze ~12-10: this map and the re-reads are **design work that fits before the pause**; builds come after it.

## 5. Questions for Pem (business functions)

Asked in the chat as quick-fire questions; answers recorded below.

### Pem's answers (2026-11-20, chat)

- **On the Moment idea:** « exactly the kind of foresight that brings an edge to become the master builder. »
- **A collector's year:** « All of them, I suppose. … The order seems to be okay. » (meets at a show → enquiry → studio visit → kit sent → sale → delivery → thank you → news of new works)
- **What gets lost:** « I'm not going to say I lose track, but I'm not keen on doing anything like that. So anything that nudges me towards better care of anybody who's interested in my work is a good move. » « I am quite shy, so it makes everything difficult. But it's not a reason to destroy opportunities. … collectors expect things … I don't want to trip on something that I don't need to trip on. I'd rather trip on creative stuff than this kind of endeavor. » « I would be very well happy to delegate this as soon as possible. And I want all my records in and handed out in the cleanest, most superb way to match my work and give it the most chances to reach out. »
- **Who matters:** « I would say thinkers. And thinkers could be galleries. … Everybody's important. Well, some more than others. I would say press is important. Galleries, curators, artists as well, because they actually guide a lot of people and help the sorting out. »
- **Remind or show:** « Basically, I'm not going to do it. And we need to find a way to make sure customer care is there, despite my strange dispositions. … just common sense things that need to be handled, even automatically, whatever. To take me out of the loop somehow, even if I am the grandmaster. »
- **Who knows whom:** « Oh yeah, I think it's interesting to know who knows who. … you build your way into whatever fate you have in your locker. It's not a matter of business development. Or it's just to let things happen instead of obstructing all the time the way I do it now. »
- **Who sees the business side:** « Of course, the team. Of course, the agents. Anybody involved in the business side has to be informed. That's the point of it. » « Anytime there is private information that I don't want to unveil, I will make sure you know it. And you can even mention it to me if you have any doubts. »

### What it changes in the map

- **Care runs without Pem.** Rules on Moments (enquiry not answered, visit not followed up, kit opened, birthday, new work matching someone's taste) create **care tasks assigned to a team member or agent**, not reminders for Pem. Pem sees a summary, not the nudges. Sending messages by itself is a deferred feature (`CLAUDE.md`: transactional email needs a GO) → first version: the app drafts, a person sends.
- **People get roles that matter:** thinker, press, gallery, curator, artist, collector — as spheres (several per person), not a single type.
- **Who knows whom is in:** a person ↔ person link (introduced by, works with, knows) — a Moment kind « introduction » plus a link; feeds the map.
- **Business side is team-wide by default;** private items are flagged by Pem, and Claude raises a privacy doubt when it sees one (as with the wallpaper).
- **Records must be presentation-grade:** every paper, kit and export drawn from the same Moments, so what goes out matches the work.

## 6. The TODO builds, confronted with the map (2026-11-20)

Pem: « Those builds have to be confronted to what we've just discussed. We need to know what we are about to build is what we need to be at state of the art, even at the forefront of invention and intelligence. »

Verdicts: **keep** (fits as designed) · **reshape** (re-read as a Moment kind or a view before building) · **merge** (folds into another item) · **park** (waits on something).

| TODO item | Verdict | Why, against the map |
|---|---|---|
| §3 Contacts as relationships | **reshape — first** | Becomes « People + their Moments »: the four-part card, spheres (thinker, press, gallery, curator, artist, collector), who-knows-whom, the timeline as a view, care tasks for the team. The centre of the business side. |
| §3 Reverse pricing | **keep** | A calculation, independent; a sale Moment later feeds the real margin. |
| §3 Phone outbox | **merge** | Same need as the quick-capture inbox: one capture path, phone and desk, one outbox. |
| §3 R8 public site | **keep, re-read** | Pages read works + Moments (shows, press) so the site, the CV and the kits never disagree. Design references stay separate from ideas. |
| §3 Editions | **keep, after the map** | A Works extension; each copy sold is a sale Moment. |
| §3 AI desk, web addresses | **park** | The AI desk is « hide what doesn't work » until after the pause. |
| §4 Step 1 condition + transit chips | **keep** | Read-only, small, independent. |
| §4 Step 2 work-record fields | **keep** | Work record only; no business overlap. |
| §4 Step 3 papers | **reshape** | Every paper (inventory, labels, sales report) drawn from the same Moments. |
| §4 Step 4 events and calls | **reshape** | Events and calls are Moment kinds (with people + roles, works, dates, fee); avoid one more parallel table. |
| §4 Step 5 contact fields | **merge** | Into contacts as relationships. |
| §4 Step 6 kits, CV, video, press | **reshape** | A kit sent = a Moment; CV and press list = views; video links stay on the work. |
| §4 Step 7 insights | **becomes a view** | Comes nearly free once Moments exist. |
| §4 Step 8 « Volée » | **keep** | Fate rule, independent. |
| §4 Public site small items, panorama, S6 | **keep** | Transmission polish; no structure at stake. |
| §4 Speed 17–19 | **keep — now** | The main waste of time Pem named. |
| §4 Storage / vault naming | **keep** | Housekeeping. |
| §4 Trace (handwriting, voice > 4 MB, R1 score) | **keep as is** | Ideas side; follows the scope interview order. |

### Where « forefront » is real, and cheap

- **Works ↔ people matching.** Search embeddings already exist for works. The same vectors for a person's past Moments (works they saw, bought or asked about) let the app say « these new works suit these five people », and the care task drafts the note. This is what galleries with big CRMs do by hand; here it falls out of the map.
- **Care that runs without Pem.** Rules on Moments → tasks for the team or an agent, with a draft in Pem's voice; Pem sees a summary. Pem stays the « grandmaster », not the operator.
- **One record, every output.** Site, kit, PDF, CV and sales report read the same Moments, so nothing contradicts and nothing gets typed twice.
- **The idea map with digests (later).** A local AI writes a digest per cluster in Constellation; the business map (who knows whom) and the idea map are two layers of the same graph, never mixed.

### Order this implies (for the lead)

1. Before the freeze (design only): agree this map → contacts-as-relationships redesigned as People + Moments → events / calls / papers / kits re-read as Moment kinds.
2. Now builds that are independent: quick-capture + debug window, speed, AI desk hide, catalogue steps 1–2.
3. After the pause: the Moment view (read-only) → contact page + timeline → care rules + drafts → matching → papers, CV, insights on top → editions.

## 7. More answers, and the hub (2026-11-20, chat)

- **A « thinker »:** « somebody who writes sharp things » (a curator who writes, a critic).
- **Drafts, a person sends; automatic sending later with a GO:** « Yes, and if for the moment nobody does it, if needed, I will do it. That's okay, but I'd rather delegate this if possible. »
- **The hub for everything:** « We haven't talked about integration of tools like emails. The PEM Hub needs to become the hub for everything. Okay, different profile, different privileges, different levels of authorization, but the same thing. The hub is like the airport, you know? »

### What « the airport » means for the map

- **Every outside tool is a gate, not a new section.** Email, calendar (OAuth exists: `calendar_account`, `calendar_event_link`), payments (SumUp), phone captures, the AI agent: each brings Moments in (an email from a collector → a Moment on that person) or takes papers out. No tool gets its own parallel copy of people or works.
- **One set of people, one set of works, many roles.** Profiles with levels (Pem admin, team, agent, maybe accountant / printer as outside guests) see the same records through their privileges — the RLS layer already does this for team vs admin.
- **Privacy risk to settle before any email gate:** a mailbox holds private and other people's mail. Proposal: only mail from or to known contacts is read in, only a summary + link is kept, and Pem flags private contacts. Needs Pem's OK and a security review (high effort, not delegated).
- Open: which gates first (questions in the chat).

## 8. Answers on gates, guests and money (2026-11-20, chat)

- **Everything a timeline:** « And every everything is a timeline with follow-up and all. Did I understand well? » → yes: every person, work, event and order shows its Moments in time, and follow-up = a rule on the last Moment.
- **Website form:** « There could be an email form for the website as well, and redirections done if it's something more personal. Could be done in many ways. » → the site's enquiry already lands as an `inquiry` (kits `c/[token]`, triage); the form is one more gate into the same Moments.
- **Who takes care tasks:** « All of us for now. »
- **Gate order:** calendar → email → Instagram and WhatsApp → payments.
- **Mailbox:** a studio address.
- **Email:** read only first; « then, I don't know, you choose ». → proposal: drafts only, a person sends, until a GO.
- **Outside guests:** « Nobody gets access to the hub for now. This is completely contained. That's why I want documents, kits to be handed, but no access to the system, even printers. I send files. I have a system in my file naming so that I know which original picture it is and I could use for printing. All contained and secured. » → no guest accounts; outside people receive kits, PDFs and files only.
- **Accountancy and tax:** « Are the tools ready … to be linked to accountancy, to give proper paperwork, to do my declaration for the taxes? We haven't talked about that. »

### Money, against the map (read in code and notes, 2026-11-20)

- **Exists:** `payments`, `invoice` + `invoice_order`, `expense` + `expense_oeuvre`, supplies orders, Fiscal (recettes by payment date, BNC), Income & Expenses screen.
- **Not fed:** 2 expenses, 0 real sale order with payment end to end (TODO_NOTES « money pipeline »). The tools exist; nothing has been tested with a real year.
- **Open decisions already noted:** gross vs net for BNC on consignment sales; `is_paid` still hand-editable instead of derived from payments; supplier invoice → stock not linked.
- **In the map:** a payment and an expense are Moments (who, which works, when, amount, paper). The yearly tax paperwork is then a view: receipts and expenses for the year, per category, with each paper attached → an export for the accountant (or for Pem's own declaration). The app prepares the figures; it does not file, and the accountant confirms the rules.
- **Before the freeze:** one end-to-end test on the Docker copy (sale → payment → Fiscal → export) so the money path is proven, not assumed.

## 9. Money answers, and the puppeteer (2026-11-20, chat)

- **Drafts to approve:** « like a folder with all the papers the director needs to sign, turns pages and signs. » → one approval folder: drafts (mails, papers, kits) waiting, Pem or a delegate signs page by page.
- **Gate order** = order of building (calendar → email → Instagram / WhatsApp → payments).
- **Testing:** « That's what the throwaway version is about. » → full-scale money test on the Docker copy: « Oh yeah, full scale. »
- **Gallery sale:** « the price after commission, of course … But the records for the work will be the full price with the commission rate and all, the breakdown. » « It's the money I get, accountancy-wise. The commission is a matter for the gallery. »
- **« Paid » by hand stays:** « it could be paid in cash to me, handed over, and there's no trace. » → keep the manual tick, but a cash payment becomes a payment Moment (amount, date, « espèces ») so the income report sees it.
- **Supplies:** « I order, I get the delivery and have the checked invoice, and then I feed this into your system so that stocks, everything's up to date. » Not top of the list.
- **Reports:** « they're just reports … pivot tables could be a great use. » → yes: pivots already exist (`PivotPanel`); tax and money reports are saved pivots on Moments, plus an export.
- **What counts legally:** « ce ne sont pas ces documents qui feront foi. Si un comptable produit une déclaration à mon nom, c'est la sienne qui compte. … Mais si c'est moi qui l'ai faite, il faudra la garder et la certifier. » → the hub keeps the filed declaration as a locked, dated document (vault), plus the figures it came from.
- **Declaration:** Pem does it themselves; probably micro-BNC, sole entrepreneur with limited liability.

### Facts checked (web, 2026-11-20 — to confirm with the tax office or an accountant)

- Micro-BNC: declare **gross receipts** (excl. VAT); the tax office applies a flat 34 % allowance; expenses are not deducted. Ceiling: €77,700 for 2025 income, €83,600 for 2026 (sources: service-public F32113, copeps.fr).
- Obligation: a **chronological receipts book** (livre des recettes). An invoice for an original work is only required if the buyer asks.
- Gallery commission (gross vs after commission): **no source settles it** — must be checked with the tax office or an accountant before the Fiscal report is fixed. Pem's view: the money received.
- Consequence for the map: under micro-BNC, expenses matter for management (margin, reverse pricing), not for tax. The receipts book is the one tax paper the hub must produce, from payment Moments.

### The vocabulary Pem wants to think in

« The airport », « the black box »: things come in, come out in different ways; « it's all organisms ». « The puppets: the figure moves at the bottom, but the puppeteer knows where it's going. He knows the scenario. » → the map is the scenario; screens and gates are the figures. Talk at that level first, details after.

## 10. What this map does not cover yet (stated so nothing is held back)

1. **Life after the wind-down:** who fixes a bug in January; monthly running costs (Supabase, Vercel, R2, domain); the runbook. Biggest practical risk.
2. **Legacy / estate:** « now or in the future » — who inherits the archive, the readable export, a catalogue raisonné. Aim 3 says it; no plan yet.
3. **Rights:** resale right (droit de suite) on later resales of Pem's works; reproduction rights and image licences; whether Pem is with a rights society. Tracking resales is a Moment kind.
4. **GDPR:** contacts, read-in emails, who-knows-whom are personal data — retention, consent, a « forget me » path. Needed before the email gate.
5. **Artist-author status:** social contributions (URSSAF artistes-auteurs), VAT franchise threshold — the receipts book feeds both; not checked.
6. **Security of the hub itself:** two-factor sign-in, a lost phone, team members leaving.
7. **Measuring use:** whether a built tool is used (the « built, never used » risk) — a quiet usage count per screen, read once a month.
8. **What I have not read:** I read STRATEGY, TODO, the design-note headings, the live table list and counts — not every design note in full, not the code. A master-plan pass should.

## 11. Answers on the gaps (2026-11-20, chat)

- **Gallery commission and tax:** « We need to settle it with proper knowledge. But the principle is that I can only pay tax on what I get. »
- **After the wind-down:** « I need to set hard deadlines. I don't know what next year will be like. » → the freeze date and the runbook are the hard deadline.
- **Legacy:** a plan exists and is **private — ask Pem**; not written in the repo. Wanted: an **introduction package, FR + EN**, on how to handle the archive and the works.
- **Rights:** « We need to track this as well, as much as we can. » Membership of ADAGP (rights society) to check. « Anything I receive is an income … unless it's exempted. » → resale royalties and reproduction fees are payment Moments.
- **GDPR:** « very similar to the website policy that's in the vault » → reuse the site's policy (`LEGAL_POLICY.md`, `WEBSITE_LEGAL_PAGES.md`) for contacts and read-in mail.
- **Status / thresholds:** the authorities set thresholds high enough to give room, then « come back to you and settle a custom approach ». → track receipts against the micro-BNC and VAT thresholds; no more for now.
- **Security:** « not national security information … » → basic hygiene (two-step sign-in, revoke a leaver), no more.
- **Usage count:** « If you want. » → low-cost, read monthly.
