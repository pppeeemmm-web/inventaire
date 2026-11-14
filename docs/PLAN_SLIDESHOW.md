# Plan — Slideshow, step 1: in the browser (TODO R5)

Pem 2026-11-14: "the slideshow will be a good addition". Brief + Pem's first answers: [HANDOFF NEXT §6](./HANDOFF_2026-11-14_NEXT.md). This is the plan for **step 1 only** (no file export, no sound). **Not built. Pem answered the questions 2026-11-14 (end of this doc); one point still open: where saved slideshows are listed.** Checked against live code 2026-11-14.

## What it is for

Show a selection of works one by one, full screen, well framed — to look at a group of works together (studio review, a visit, a client on a screen) and, later, to become the base of the PowerPoint / MP4 / Reels exports (steps 2–5). The image is the point: never cropped, nothing on top of it unless Pem asks for a caption.

## Where it starts

- **From the selection dock** (`components/atelier/CurationDock.tsx`, the bar shown when works are selected): a new button « Diaporama » next to Exporter / Images / Comparer. Order = the order the works were selected (the dock's `selection` is a `Set`, which keeps that order).
- **From a saved slideshow** (Pem: "a small slideshow yes, named, reopened"): a short list « Diaporamas » with name, number of works, first image; open → plays.
- Opens as a full-screen layer over the current page (like the image loupe), so closing it returns exactly where Pem was.

## The screen

- **Image:** the full picture (`imageUrl()`), contained (never cropped), centred, with a margin. The next two images load in advance; the small version shows first if the full one is slow.
- **Background:** black / grey / white.
- **Caption (optional):**
  - language FR / EN (independent of the app's language);
  - Pem picks which details show: title, year, technique, support, dimensions, number `#1234`;
  - position: **dragged anywhere** on the slide (Pem), kept as a position relative to the screen so it lands in the same place on a phone or a large screen; one caption setting for the whole slideshow (Pem: "one is enough");
  - fade in / out: with the image, or a short delay after it;
  - a soft cast shadow behind the text so it reads on the background or over the image.
- **Controls** (hidden after 2 s of no movement; any move / tap shows them):
  - computer: ← → previous / next, Space play / pause, Esc close, F full screen;
  - phone: swipe left / right, tap to show / hide the controls, works in landscape;
  - play / pause, counter « 3 / 12 », settings button, close.
- **Timing and transitions:** seconds per slide (2–30, default 6); transition: cut, fade, slide (Pem: enough — no slow zoom); loop on / off; **random order** on / off (Pem) — shuffled once when it starts, so ← goes back to the previous work.
- **Phone note:** iPhone Safari cannot put a page element truly "full screen"; the layer fills the screen and hides everything else instead (same look, the address bar may stay).

## Settings and saving

- **Not saved:** the last settings used are remembered on this device (background, timing, transition, caption choices), so a quick slideshow needs no setup.
- **Saved slideshow:** « Enregistrer » → a name; stores the works in order + all settings. Reopen, rename, delete; change the order by dragging in a strip of thumbnails (settings panel).
- **Storage (proposed):** a new team table `slideshow` — `id`, `name`, `work_ids` (ordered list), `settings` (background, timing, transition, caption), `created_by`, `created_at`, `updated_at`; team RLS like the other team tables — **shared with the whole team** (Pem), no public access. A slideshow that points to a deleted work just skips it.
- **Size:** no limit needed. A saved slideshow stores only the work numbers (1 000 works ≈ a few kB), and the player only ever loads the current image and the next two, so a long slideshow plays as smoothly as a short one. The only practical limit is the thumbnail strip used to reorder — long lists scroll.

## Out of step 1

PowerPoint, MP4 / GIF, Premiere / Photoshop base, Reels (steps 2–5, each its own decision); music; a public / shared link (that is the collector share kit, TODO 11b); editing work data from the slideshow.

## Work, once agreed

1. SQL `supabase/sql/slideshow.sql` (table + RLS + grants) — shown to Pem before applying.
2. The player layer (image, background, controls, timing, transitions, caption) + « Diaporama » in the selection dock.
3. Settings panel + remembered settings + save / reopen / rename / delete + the « Diaporamas » list.
4. FR / EN copy, What's new item, docs (TODO, SITE_MAP, SYSTEM_LEDGER).
5. Checked at 375 px (phone, landscape too) and on a large screen; a real slideshow of ~10 works played through.

## Pem's answers (2026-11-14)

1. Caption: drag it anywhere — yes. 2. Cut / fade / slide: enough. 3. Saved slideshows: shared with the team. 4. Where the list goes: not clear (see below). 5. Size: "is there a technical limit?" — no (above). 6. One caption setting for the whole slideshow. Added: **random order**.

**Still open — where to find a saved slideshow again.** The selection bar only appears once works are selected, so it cannot be the only door. Proposed: a « Diaporamas » entry in the Catalogue menu (with Inventaire, Rapports, Thèmes, Constellation) that lists the saved ones; « Diaporama » in the selection bar starts a new one.

## Questions (as first asked)

1. **Caption position:** 6 fixed places enough, or do you want to drag it anywhere?
2. **Transitions:** cut / fade / slide enough for now? Ken Burns (slow zoom) — yes or never (it moves the image, which the "never cropped" rule may not like)?
3. **Saved slideshows:** shared with the whole team, or only yours?
4. **Where is the list « Diaporamas »:** in the selection dock, in Catalogue (desktop sidebar), or both?
5. **Size limit for saving:** 100 works OK?
6. **Captions in a slideshow:** one setting for the whole slideshow, or can one slide differ (e.g. no caption on a detail)?
