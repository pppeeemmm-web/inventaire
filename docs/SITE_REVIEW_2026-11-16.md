# Public site review — 2026-11-16

Scope: https://www.thepemworkshop.com as a visitor (`/`, `/works`, zoom view, `/about`, `/practice`, `/enquiry`) at 1440 px and 375 px, plus `curl` timings and page metadata. Atelier ignored. No code changed. Filter used: [`STRATEGY.md`](./STRATEGY.md) aim 3, Transmission.

## What works today

- A distinct mood. The circadian sky, the lit wall and the cast shadows feel like a place, not a template.
- Works hang at true relative scale. Keyboard arrows, swipe and click-to-zoom all work.
- No horizontal scroll at 375 px.
- The basics are right: canonical URLs, `robots.txt` (Atelier, hub and login are disallowed), a sitemap, and image `alt` set to the work title.
- Source images are good (1500–2000 px AVIF).
- The bio is a real story: Sciences Po, the old-master trade (Bailly, de Bayser, Turquin), chef, Ireland, back to Marseille, 1,000+ works since 2019. Few emerging painters have that.

## Top 10 improvements (impact ÷ effort, best first)

**1. Show the paintings big — S/M.** On `/works` a painting is about 95–110 px wide on a 1440 px screen, and 108 px on a phone. Zoom only takes it to about 15% of the screen. A grey haze and a heavy drop shadow also dull the colours. Make "large" the default: the work fills about 75% of the viewport height, with a clean background. Keep the true-scale wall as a second view ("Accrochage"). Every reference site leads with the image at full size.

**2. One page per work — M.** There is no URL for a single work. The address stays `/works` when you zoom, so a work cannot be shared, bookmarked, indexed or enquired about. Add `/works/[id]-[slug]` with title, year, medium, size, series, availability, two or three detail shots, and an "Enquire about this work" button (the `/enquiry?oeuvre_id=` route already exists). Give each page its own `og:image` and list it in the sitemap. This is the biggest gain for search and sharing.

**3. Landing: say who and what in three seconds — S.** First paint arrives after about 2.8 s of empty sky. Then one work appears, cropped to a circle; cropping a painting changes the work. The text is tiny and low-contrast. The nav shows only Oeuvres and Contact. The clock and "Hz since midnight" counter compete with the art. There is also an empty-text link to `/hub`, and the `/works` link's accessible name is a whole CSS block (an inline `<style>` sits inside the `<a>`), so screen readers read the CSS out loud. Fix: name, "painter, Marseille", one line, a full uncropped recent work, then Works · Journal · About · Contact.

**4. Social previews — S.** `og:image` is a 400×400 AVIF. Many link previews (WhatsApp, LinkedIn, Facebook) do not render AVIF reliably. `/works`, `/about` and `/practice` have no `og:image` at all. Serve a 1200×630 JPEG per page and per work.

**5. Speed and image hosting — M.** `/works` takes 1.9–3.4 s to its first byte, with `Cache-Control: private, no-store` and `X-Vercel-Cache: MISS`. The HTML is 243 KB and holds 837 image keys. Revalidate on publish (ISR) instead of rendering on every request. Images come from an `r2.dev` URL with no cache header. Cloudflare rate-limits `r2.dev` and says it is not for production. Use a custom image domain with long cache headers.

**6. One name — S.** The site uses "the pem workshop", "Pierre Emmanuel Moulin" and "Pem" in different places. Titles read "the pem workshop — painter", so a search for the person's name finds weak signals. Pick one main form, for example "Pierre Emmanuel Moulin (Pem) — painter, Marseille", and use it in `<title>`, `h1`, `og:site_name` and a JSON-LD `Person` block.

**7. FR/EN done properly — M.** The page says `lang="en"` and `og:locale=en_GB`, but the content is French. The `?lang=en` alternates declared in the metadata serve French HTML; English appears only after the client toggle, so search engines never see it. The English bio was pasted with hard line breaks, some mid-word ("de / Bayser"). The FR and EN bios also give different facts. Fix: server-render each language, clean the EN text, and keep one set of facts.

**8. About and Practice content — S/M.** `/practice` shows a heading only ("Des caprices kaléidoscopiques"). The landing and `/works` navs hide About and Practice, yet the sitemap lists both. The server HTML of `/about` (what Google reads) is a short default bio; the full CV only appears after hydration. Fill the gaps: an 80-word statement, a portrait or studio photo, and a dated list of exhibitions and selections. Either merge Practice into About or fill it.

**9. Calls to action — S.** The enquiry form's reasons are after-sales only ("Réclamation", "Livraison / logistique"). There is nothing for buying a work, commissions, shows or press. There is no email address, no Instagram link and no newsletter signup anywhere. Add the missing reasons, an "Enquire" button on each work, a one-field newsletter signup in the footer, and an Instagram link.

**10. Captions and small copy — S.** Captions give title, year and size, but no medium. Add medium/support, series and an availability dot. The desktop view says "Pincer ou toucher pour zoomer" (touch wording) on first load.

## Daily feed and musings

The material already exists: journal entries, session photos and voice-note transcripts. The question is where the public sees it.

| | (a) Journal on the site | (b) Substack + Instagram | (c) Both |
|---|---|---|---|
| Ownership | Full. Stays in the archive (aim 3). | Rented. Substack lets you export the list; Instagram does not. | Archive owned, reach rented |
| Search | Every entry is a page on your domain, linked to its works | Search credit goes to substack.com | Site gets the search credit |
| Discovery | Low on its own | Substack recommendations and Instagram feeds bring new readers | Best |
| Effort per day | ~1 min: tick "public" on an entry already written | Re-type or copy-paste, then crop for each platform | ~1 min a day, plus ~20 min for a weekly letter |
| Build cost | Medium: public flag, RLS, page, design | None | Medium |

**Recommendation: (c), in stages, with the site as the source.** Post on the site first. Send a short weekly or fortnightly letter that links back to it. Use Instagram for pointers back to the site (the Broadcast queue already drafts posts). Do not post daily on Substack: the reference studio newsletters run weekly to monthly, and the long-running daily painter blog (Gurney) fell from 371 posts in 2020 to 39 in 2025 and moved its long pieces to Substack.

**Smallest first version (needs owner GO and a screen design first, per the 2026-11-14 rule):**

1. Add a `public` value to `journal_entry.visibility`. Today the check constraint only allows `team` and `private`. It also needs an `anon` read policy limited to public rows, plus an explicit `GRANT`.
2. A `/journal` page ("Carnet"): reverse date order; date, text, at most one photo, and a link to the work when one is attached (better once item 2 exists).
3. An RSS feed at `/journal/feed.xml`. Buttondown, Mailchimp and Kit can send it as a weekly email automatically. Substack cannot import RSS posts automatically, so with Substack the letter is pasted by hand. An external tool also avoids building transactional email (a CLAUDE.md non-goal without GO).
4. Link from the landing nav and the footer. No comments and no likes in v1.

Nothing is public unless Pem ticks it. Voice transcripts need editing before they go out.

## Reference sites

- [alibanisadr.com](https://www.alibanisadr.com) — nav split by medium (Paintings, Works on Paper, Sculpture) plus News, Exhibitions, Press, Publications, with an Instagram link in the footer. A clear grown-up structure to copy.
- [mireilleblanc.com](https://www.mireilleblanc.com) — French painter born 1985. The home page is a dated list of exhibitions with thumbnails, plus "Essays & Reviews" and "ITW & Podcasts". Borrow: let other people's words carry credibility.
- [simonburton.org/journal](https://www.simonburton.org/journal) — "Reflections from the studio": one page per year, notes and poems, works shown with full captions inside the text. Closest model for a site journal.
- [james-mcgrath.com](https://james-mcgrath.com/archive/) — "Studio Catalogue" nav: Works, About, Journal, Full Catalogue. Borrow: selected works up front, the full catalogue one click deeper.
- [austinkleon.com](https://austinkleon.com) — several short posts a week on his own blog (image + one line + permalink, tags, "On this date"), and a weekly Substack letter that points back. Option (c), working.
- [gurneyjourney.blogspot.com](https://gurneyjourney.blogspot.com) — a daily painter blog since 2007, with labels and archives. A warning: daily posting fell away and the essays moved to Substack.
- [paintandpaper.substack.com](https://paintandpaper.substack.com/p/studio-journal-71926) — a periodic "Studio Journal": sections, about 16 images, honest process doubts. A good letter format, but it links to no artist site, so its value stays on Substack.
- [raegeorge.substack.com](https://raegeorge.substack.com/about) — "Notes of a Painter", twice a month: works in progress, open studio, "first to see new paintings". Borrow the subscriber promise of early access to new work.
