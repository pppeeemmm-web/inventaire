-- Contact links: one store per kind (TODO §1 « Saved social links don't show », option A, Pem « Go, option A » 2026-11-19).
-- Websites live in contact_websites, social handles in contact_socials. The legacy columns
-- Contact."Website" / "Instagram" / "LinkedIn" / "Facebook" / "Twitter" were saved but never shown by the editor.
-- This copies their values into the child tables (skips a value already there), and leaves the columns
-- in place: the app stops reading / writing them in the same change. Dropping them = a later step, its own OK.
-- Idempotent: running it twice adds nothing.

begin;

insert into public.contact_websites (contact_id, url, label)
select c."ContactID", btrim(c."Website"), 'Site'
from public."Contact" c
where coalesce(btrim(c."Website"), '') <> ''
  and not exists (
    select 1 from public.contact_websites w
    where w.contact_id = c."ContactID"
      and lower(regexp_replace(rtrim(w.url, '/'), '^https?://(www\.)?', '')) =
          lower(regexp_replace(rtrim(btrim(c."Website"), '/'), '^https?://(www\.)?', ''))
  );

insert into public.contact_socials (contact_id, platform, handle)
select c."ContactID", v.platform, btrim(v.handle)
from public."Contact" c
cross join lateral (values
  ('Instagram', c."Instagram"),
  ('LinkedIn',  c."LinkedIn"),
  ('Facebook',  c."Facebook"),
  ('X',         c."Twitter")
) as v(platform, handle)
where coalesce(btrim(v.handle), '') <> ''
  and not exists (
    select 1 from public.contact_socials s
    where s.contact_id = c."ContactID" and s.platform = v.platform
      and lower(regexp_replace(rtrim(btrim(s.handle), '/'), '^(https?://(www\.)?[^/]+/(in/)?|@)', '')) =
          lower(regexp_replace(rtrim(btrim(v.handle), '/'), '^(https?://(www\.)?[^/]+/(in/)?|@)', ''))
  );

commit;

-- A social row is skipped only when the same platform already holds the same handle (@name, URL and name compared).
-- Check after: rows per platform vs column values (expect contact_websites >= 7 contacts, Instagram >= 3 contacts).
-- select 'Website' k, count(*) filter (where coalesce(btrim("Website"),'') <> '') cols,
--        (select count(distinct contact_id) from contact_websites) rows_contacts from "Contact"
-- union all select p, (select count(*) from "Contact" where coalesce(btrim(case p when 'Instagram' then "Instagram" when 'LinkedIn' then "LinkedIn" when 'Facebook' then "Facebook" else "Twitter" end),'') <> ''),
--        (select count(distinct contact_id) from contact_socials where platform = p)
--   from unnest(array['Instagram','LinkedIn','Facebook','X']) p;
