# Survey 4 — contacts and care (draft, 2026-11-21)

Status: **local draft**. Run early at Pem's request; to be re-read when the People design starts (no real case yet). Question: how do galleries, studios and personal tools keep relations, and what does the hub have. Made from two web searches (sources at the end — **vendor marketing pages**, claims self-reported; no independent guidance found) plus general knowledge, set against the hub's schema. Not read: `ContactsReview.notes.md`, the contacts screens.

## 1. What the field does

| Practice | Where seen | The hub today | Verdict |
|---|---|---|---|
| **Every interaction logged against the contact**, in date order: enquiry, viewing, purchase, visit, call | Artlogic, ArtCloud, Artwork Archive; Monica (personal) | Orders, event membership, kits, enquiries each in their own table; no log of calls, visits, mails | The master plan's `moment` table + the timeline read. Confirmed as the field's shape |
| **Contacts linked to the works and artists they care about** (interest, not only purchase) | Artlogic, ArtCloud | Buyer / owner / holder on a work; works shown in a kit; nothing for « is interested in » | **Gap**: interest is a link person ↔ work (or theme), with its source (said it, asked about it, saw it) |
| **Preferences and personal context on the record** (how they like to be met, timing, motives) | Artlogic guides | `Notes` (one free text) | Enough as text; do not build fields |
| **Related contacts** (family, advisor, works with) | Artlogic | None | The plan's « who knows whom » — a link person ↔ person with a kind |
| **Groups / segments** for an event or a mailing (VIP preview list) | Artwork Archive, all | `Type`, `TypeContact`, `Role` — **three type fields** on `Contact`; no tags | The plan's tags (= spheres), one mechanism; retire the three fields into it |
| **Reminders per contact at an interval** (« stay in touch every N months »), birthdays automatic | Monica | `suivi_reminder` belongs to a process, not a person; **no birth date field found on `Contact`** | The plan's two care rules need the field first |
| **Website forms and sign-ups arrive in the contact record by themselves** | ArtCloud, Artlogic | `inquiry` holds name + email + work; becomes a contact by hand | Fine: the gate contract says a gate never creates a contact by itself |
| **One record across channels, nothing entered twice** | All | Contact merge exists (one transaction) | Covered |
| A sales pipeline with stages | Artlogic | Pipeline (`suivi_process`) | Covered |

## 2. Two warnings from the field

- **A relationship turned into tasks starts to feel like an inbox** (Monica's own guide). « Memory first » — record what happened, be reminded only of what you asked for — suits Pem (« I'm not keen on doing anything like that »; care delegated to the team). Monica states it plainly: the tool is deliberately « dumb », it reminds only of what you asked.
- **The data is about other people**, which makes it unusually sensitive (same source). GDPR before any gate that reads mail; `Contact` already has a « GDPR Requête » field and `is_private`.

## 3. What to take — for the People design, when it starts

1. One door first (`saveContact`), as the principles say.
2. The interaction log and the timeline read: the field's standard shape; build nothing else before it.
3. Three links, not three screens: person ↔ work (interest, with source), person ↔ person (kind), person ↔ tag.
4. Care = memory first; two rules at most; reminders go to the team.
5. Not worth copying: lead scoring, marketing automation, price-sensitivity fields, newsletters inside the tool (Substack holds the list).

## Sources

- https://artlogic.net/products/gallery/sales · https://artlogic.net/blog/44-3-ways-to-maximize-collector-relationships-three-easy-ways-to-maximize-your-collector-relationships/ · https://artcloud.com/contacts · https://www.artworkarchive.com/contact-management
- Monica (open-source personal CRM) — https://github.com/asbiin/monica · https://monicahq.com/en/personal-crm/
