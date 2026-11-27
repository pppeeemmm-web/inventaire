-- Test for contact_phones_one_form.sql — throwaway Postgres only, NEVER live:
--   psql -v ON_ERROR_STOP=1 -f contact_phones_one_form.test.sql   (from supabase/sql/)
-- Loads the 62 rows as read on 2026-11-27, applies the one-off, checks.
drop table if exists public.contact_phones;
create table public.contact_phones (id int primary key, contact_id int, country_code text, phone text, label text, is_primary boolean);
insert into public.contact_phones (id, country_code, phone) values
  (6, null, '0'),
  (10, null, '178945623'),
  (12, null, '0'),
  (13, null, '0'),
  (393, null, '0879262103'),
  (412, '+33', '660754943'),
  (512, '+33', '663026768'),
  (513, '+336', '63026768'),
  (576, '+34', '656318022'),
  (685, '+33', '4955332874'),
  (686, '+33', '966812434'),
  (687, '+33', '491968361'),
  (688, '+33', '491966249'),
  (689, '+44', '020 7229 1099'),
  (694, null, '777228136'),
  (708, '+353', '899515900'),
  (709, '+353', '899654262'),
  (710, '+33', '621575415'),
  (711, '+33', '615880502'),
  (712, '+33', '683256339'),
  (713, null, '867251493'),
  (714, '+336', '32932616'),
  (715, '+33', '491482501'),
  (716, '+33', '629162904'),
  (717, '+33', '776992027'),
  (718, '+33', '626228270'),
  (719, '+33', '629663135'),
  (723, '+33', '06 74 89 02 54 '),
  (724, '+33', '491903906'),
  (725, '+33', '663548012'),
  (726, '+33', '491472837'),
  (728, '+34', '686764652'),
  (729, null, '917-831-6931'),
  (731, '+33', '495376171'),
  (734, '+33', '660856202'),
  (735, '+336', '60856202'),
  (736, '+33', '951437730'),
  (737, '+33', '624163159'),
  (738, null, '612629421'),
  (739, '+33', '665697288'),
  (740, '+33', '982589021'),
  (743, '+34', '678558317'),
  (748, '+33', '495321171'),
  (749, '+33', '495376776'),
  (750, '+33', '442115614'),
  (751, '+33', '623678269'),
  (752, '+336', '23678269'),
  (753, '+33', '610391615'),
  (754, '+33', '442552718'),
  (755, '+33', '442451860'),
  (756, '+33', '620347438'),
  (758, '+33', '609776646'),
  (761, '+336', '64768192'),
  (762, '+334', '90209882'),
  (767, '+337', '83003541'),
  (768, '+337', '60176805'),
  (769, '+33', '783003541'),
  (770, '+33', '663147588'),
  (771, '+353', '863822559'),
  (772, null, '0'),
  (773, '+353', '874139207'),
  (780, '+33', '0955696731');
\i contact_phones_one_form.sql
do $$
declare n int;
begin
  select count(*) into n from public.contact_phones where country_code ~ '^\+\d{1,3}$' and phone ~ ' ';
  assert n = 54, 'grouped rows: ' || n;
  assert (select phone from public.contact_phones where id = 752) = '6 23 67 82 69' and (select country_code from public.contact_phones where id = 752) = '+33', 'badly split +336 repaired';
  assert (select phone from public.contact_phones where id = 393) = '0879262103', 'no-country number left as typed';
  assert (select phone from public.contact_phones where id = 713) = '867251493', '#713 left for Pem';
  assert (select count(*) from public.contact_phones where phone = '0') = 4, 'lone zeros untouched';
  assert (select count(*) from public.contact_phones) = 62, 'nothing deleted';
  raise notice 'contact_phones_one_form: 6/6 checks passed';
end $$;
