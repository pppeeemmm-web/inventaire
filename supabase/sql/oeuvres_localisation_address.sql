-- Pin a work to ONE of its location contact's addresses.
--
-- `Oeuvres.LocalisationID` is an FK to `Contact` — it says WHICH contact holds the work,
-- but a contact can have several addresses (`contact_addresses`): the artist has
-- "Principal" and "Atelier", a gallery can have two sites. Until now the only outlet was
-- the free-text `LocalisationDetail`, so 1122 works pointed at the same contact with no
-- way to say which address.
--
-- Nullable on purpose: null = "at this contact, address unspecified", which is the
-- correct reading for every pre-existing row and for contacts that have only one address.
-- ON DELETE SET NULL so removing an address degrades to that, never orphans a work.
--
-- No GRANT/RLS changes: this is a column on an existing table, already covered by the
-- `Oeuvres` policies.
--
-- After applying: npm run gen:types

alter table public."Oeuvres"
  add column if not exists localisation_address_id integer
    references public.contact_addresses(id) on delete set null;

comment on column public."Oeuvres".localisation_address_id is
  'Optional: which of the LocalisationID contact''s contact_addresses rows holds this work. Null = address unspecified.';

-- Lookup path is "works at this address", so index the FK.
create index if not exists oeuvres_localisation_address_id_idx
  on public."Oeuvres" (localisation_address_id)
  where localisation_address_id is not null;

-- ── Ownership backfill ────────────────────────────────────────────────
-- Studio rule, stated by the owner: the artist is the producer, so a work is owned by
-- the artist (Contact 13) from the moment it is created. Ownership moves only by an
-- explicit transfer, and the holder's address is then the work's location.
--
-- Works created through the session and share-triage paths never set an owner, leaving
-- `ContactID` null — which reads as "unowned" and is wrong under that rule. Every such
-- row is a work the artist made and still holds.
--
-- Scoped to nulls only: the 7 works already transferred to other contacts are untouched.
update public."Oeuvres"
set "ContactID" = 13
where "ContactID" is null
  and deleted_at is null;
