-- TODO 8 (Pem OK 2026-11-16), applied 2026-11-16: anonymous visitors keep SELECT everywhere; only
-- inquiry (public enquiry form) and page_view (visit counting) keep INSERT. Row rules already blocked every
-- other anon write (checked 2026-11-16: no other anon/public write policy without an auth check; the 3 views
-- with anon write grants are security_invoker). This removes the grants as defence in depth.
-- Supabase's default privileges still give anon writes on NEW tables: grant explicitly per table (CLAUDE.md),
-- and re-run this after adding tables if needed.
do $$ declare r record; begin
  for r in select c.relname from pg_class c
           where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','v','m','p')
             and c.relname not in ('inquiry','page_view')
  loop execute format('revoke insert, update, delete, truncate on public.%I from anon', r.relname); end loop;
end $$;
revoke update, delete, truncate on public.inquiry, public.page_view from anon;
