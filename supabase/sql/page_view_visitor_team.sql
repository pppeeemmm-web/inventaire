-- Anonymous public-site visitor id + team-session flag for "net" analytics.
-- Apply after page_view exists.

alter table public.page_view
  add column if not exists visitor_id text null,
  add column if not exists is_team_session boolean not null default false;

comment on column public.page_view.visitor_id is
  'Stable random id from public site localStorage (pem_public_vid); used for distinct visitor counts.';

comment on column public.page_view.is_team_session is
  'True when trackView ran with an authenticated Atelier session where is_team() is true.';

create index if not exists page_view_created_visitor_idx
  on public.page_view (created_at desc, visitor_id)
  where visitor_id is not null;
