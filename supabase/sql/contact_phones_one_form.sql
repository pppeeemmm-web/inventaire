-- Phones in one form — one-off for the numbers already stored (ContactDoor.md step 4; Pem 2026-11-27 « Use Google lib »).
-- PROPOSAL — not applied; live only on Pem's own OK. Generated from the live rows of 2026-11-27 with the same function
-- the door now uses (lib/contacts/phone.ts, libphonenumber-js): « +33 » + « 6 74 89 02 54 ». Each update applies only
-- if the row still holds exactly the value read that day (a number edited since is left alone).
-- Left out on purpose: the four lone « 0 », one number too long to be valid (#685), and three numbers with no country on
-- their card or an unusual reading (listed at the end, to check by Pem). Duplicates revealed by the repair: separate block below, own OK.
-- Test (throwaway Postgres only): contact_phones_one_form.test.sql.

begin;
update public.contact_phones set country_code = '+353', phone = '1 7894 5623' where id = 10 and coalesce(country_code, '') = '' and phone = '178945623'; -- ∅ 178945623 → +353 1 7894 5623
update public.contact_phones set country_code = '+33', phone = '6 60 75 49 43' where id = 412 and coalesce(country_code, '') = '+33' and phone = '660754943'; -- +33 660754943 → +33 6 60 75 49 43
update public.contact_phones set country_code = '+33', phone = '6 63 02 67 68' where id = 512 and coalesce(country_code, '') = '+33' and phone = '663026768'; -- +33 663026768 → +33 6 63 02 67 68
update public.contact_phones set country_code = '+33', phone = '6 63 02 67 68' where id = 513 and coalesce(country_code, '') = '+336' and phone = '63026768'; -- +336 63026768 → +33 6 63 02 67 68
update public.contact_phones set country_code = '+34', phone = '656 31 80 22' where id = 576 and coalesce(country_code, '') = '+34' and phone = '656318022'; -- +34 656318022 → +34 656 31 80 22
update public.contact_phones set country_code = '+33', phone = '9 66 81 24 34' where id = 686 and coalesce(country_code, '') = '+33' and phone = '966812434'; -- +33 966812434 → +33 9 66 81 24 34
update public.contact_phones set country_code = '+33', phone = '4 91 96 83 61' where id = 687 and coalesce(country_code, '') = '+33' and phone = '491968361'; -- +33 491968361 → +33 4 91 96 83 61
update public.contact_phones set country_code = '+33', phone = '4 91 96 62 49' where id = 688 and coalesce(country_code, '') = '+33' and phone = '491966249'; -- +33 491966249 → +33 4 91 96 62 49
update public.contact_phones set country_code = '+44', phone = '20 7229 1099' where id = 689 and coalesce(country_code, '') = '+44' and phone = '020 7229 1099'; -- +44 020 7229 1099 → +44 20 7229 1099
update public.contact_phones set country_code = '+353', phone = '89 951 5900' where id = 708 and coalesce(country_code, '') = '+353' and phone = '899515900'; -- +353 899515900 → +353 89 951 5900
update public.contact_phones set country_code = '+353', phone = '89 965 4262' where id = 709 and coalesce(country_code, '') = '+353' and phone = '899654262'; -- +353 899654262 → +353 89 965 4262
update public.contact_phones set country_code = '+33', phone = '6 21 57 54 15' where id = 710 and coalesce(country_code, '') = '+33' and phone = '621575415'; -- +33 621575415 → +33 6 21 57 54 15
update public.contact_phones set country_code = '+33', phone = '6 15 88 05 02' where id = 711 and coalesce(country_code, '') = '+33' and phone = '615880502'; -- +33 615880502 → +33 6 15 88 05 02
update public.contact_phones set country_code = '+33', phone = '6 83 25 63 39' where id = 712 and coalesce(country_code, '') = '+33' and phone = '683256339'; -- +33 683256339 → +33 6 83 25 63 39
update public.contact_phones set country_code = '+33', phone = '6 32 93 26 16' where id = 714 and coalesce(country_code, '') = '+336' and phone = '32932616'; -- +336 32932616 → +33 6 32 93 26 16
update public.contact_phones set country_code = '+33', phone = '4 91 48 25 01' where id = 715 and coalesce(country_code, '') = '+33' and phone = '491482501'; -- +33 491482501 → +33 4 91 48 25 01
update public.contact_phones set country_code = '+33', phone = '6 29 16 29 04' where id = 716 and coalesce(country_code, '') = '+33' and phone = '629162904'; -- +33 629162904 → +33 6 29 16 29 04
update public.contact_phones set country_code = '+33', phone = '7 76 99 20 27' where id = 717 and coalesce(country_code, '') = '+33' and phone = '776992027'; -- +33 776992027 → +33 7 76 99 20 27
update public.contact_phones set country_code = '+33', phone = '6 26 22 82 70' where id = 718 and coalesce(country_code, '') = '+33' and phone = '626228270'; -- +33 626228270 → +33 6 26 22 82 70
update public.contact_phones set country_code = '+33', phone = '6 29 66 31 35' where id = 719 and coalesce(country_code, '') = '+33' and phone = '629663135'; -- +33 629663135 → +33 6 29 66 31 35
update public.contact_phones set country_code = '+33', phone = '6 74 89 02 54' where id = 723 and coalesce(country_code, '') = '+33' and phone = '06 74 89 02 54 '; -- +33 06 74 89 02 54 → +33 6 74 89 02 54
update public.contact_phones set country_code = '+33', phone = '4 91 90 39 06' where id = 724 and coalesce(country_code, '') = '+33' and phone = '491903906'; -- +33 491903906 → +33 4 91 90 39 06
update public.contact_phones set country_code = '+33', phone = '6 63 54 80 12' where id = 725 and coalesce(country_code, '') = '+33' and phone = '663548012'; -- +33 663548012 → +33 6 63 54 80 12
update public.contact_phones set country_code = '+33', phone = '4 91 47 28 37' where id = 726 and coalesce(country_code, '') = '+33' and phone = '491472837'; -- +33 491472837 → +33 4 91 47 28 37
update public.contact_phones set country_code = '+34', phone = '686 76 46 52' where id = 728 and coalesce(country_code, '') = '+34' and phone = '686764652'; -- +34 686764652 → +34 686 76 46 52
update public.contact_phones set country_code = '+1', phone = '917 831 6931' where id = 729 and coalesce(country_code, '') = '' and phone = '917-831-6931'; -- ∅ 917-831-6931 → +1 917 831 6931
update public.contact_phones set country_code = '+33', phone = '4 95 37 61 71' where id = 731 and coalesce(country_code, '') = '+33' and phone = '495376171'; -- +33 495376171 → +33 4 95 37 61 71
update public.contact_phones set country_code = '+33', phone = '6 60 85 62 02' where id = 734 and coalesce(country_code, '') = '+33' and phone = '660856202'; -- +33 660856202 → +33 6 60 85 62 02
update public.contact_phones set country_code = '+33', phone = '6 60 85 62 02' where id = 735 and coalesce(country_code, '') = '+336' and phone = '60856202'; -- +336 60856202 → +33 6 60 85 62 02
update public.contact_phones set country_code = '+33', phone = '9 51 43 77 30' where id = 736 and coalesce(country_code, '') = '+33' and phone = '951437730'; -- +33 951437730 → +33 9 51 43 77 30
update public.contact_phones set country_code = '+33', phone = '6 24 16 31 59' where id = 737 and coalesce(country_code, '') = '+33' and phone = '624163159'; -- +33 624163159 → +33 6 24 16 31 59
update public.contact_phones set country_code = '+33', phone = '6 12 62 94 21' where id = 738 and coalesce(country_code, '') = '' and phone = '612629421'; -- ∅ 612629421 → +33 6 12 62 94 21
update public.contact_phones set country_code = '+33', phone = '6 65 69 72 88' where id = 739 and coalesce(country_code, '') = '+33' and phone = '665697288'; -- +33 665697288 → +33 6 65 69 72 88
update public.contact_phones set country_code = '+33', phone = '9 82 58 90 21' where id = 740 and coalesce(country_code, '') = '+33' and phone = '982589021'; -- +33 982589021 → +33 9 82 58 90 21
update public.contact_phones set country_code = '+34', phone = '678 55 83 17' where id = 743 and coalesce(country_code, '') = '+34' and phone = '678558317'; -- +34 678558317 → +34 678 55 83 17
update public.contact_phones set country_code = '+33', phone = '4 95 32 11 71' where id = 748 and coalesce(country_code, '') = '+33' and phone = '495321171'; -- +33 495321171 → +33 4 95 32 11 71
update public.contact_phones set country_code = '+33', phone = '4 95 37 67 76' where id = 749 and coalesce(country_code, '') = '+33' and phone = '495376776'; -- +33 495376776 → +33 4 95 37 67 76
update public.contact_phones set country_code = '+33', phone = '4 42 11 56 14' where id = 750 and coalesce(country_code, '') = '+33' and phone = '442115614'; -- +33 442115614 → +33 4 42 11 56 14
update public.contact_phones set country_code = '+33', phone = '6 23 67 82 69' where id = 751 and coalesce(country_code, '') = '+33' and phone = '623678269'; -- +33 623678269 → +33 6 23 67 82 69
update public.contact_phones set country_code = '+33', phone = '6 23 67 82 69' where id = 752 and coalesce(country_code, '') = '+336' and phone = '23678269'; -- +336 23678269 → +33 6 23 67 82 69
update public.contact_phones set country_code = '+33', phone = '6 10 39 16 15' where id = 753 and coalesce(country_code, '') = '+33' and phone = '610391615'; -- +33 610391615 → +33 6 10 39 16 15
update public.contact_phones set country_code = '+33', phone = '4 42 55 27 18' where id = 754 and coalesce(country_code, '') = '+33' and phone = '442552718'; -- +33 442552718 → +33 4 42 55 27 18
update public.contact_phones set country_code = '+33', phone = '4 42 45 18 60' where id = 755 and coalesce(country_code, '') = '+33' and phone = '442451860'; -- +33 442451860 → +33 4 42 45 18 60
update public.contact_phones set country_code = '+33', phone = '6 20 34 74 38' where id = 756 and coalesce(country_code, '') = '+33' and phone = '620347438'; -- +33 620347438 → +33 6 20 34 74 38
update public.contact_phones set country_code = '+33', phone = '6 09 77 66 46' where id = 758 and coalesce(country_code, '') = '+33' and phone = '609776646'; -- +33 609776646 → +33 6 09 77 66 46
update public.contact_phones set country_code = '+33', phone = '6 64 76 81 92' where id = 761 and coalesce(country_code, '') = '+336' and phone = '64768192'; -- +336 64768192 → +33 6 64 76 81 92
update public.contact_phones set country_code = '+33', phone = '4 90 20 98 82' where id = 762 and coalesce(country_code, '') = '+334' and phone = '90209882'; -- +334 90209882 → +33 4 90 20 98 82
update public.contact_phones set country_code = '+33', phone = '7 83 00 35 41' where id = 767 and coalesce(country_code, '') = '+337' and phone = '83003541'; -- +337 83003541 → +33 7 83 00 35 41
update public.contact_phones set country_code = '+33', phone = '7 60 17 68 05' where id = 768 and coalesce(country_code, '') = '+337' and phone = '60176805'; -- +337 60176805 → +33 7 60 17 68 05
update public.contact_phones set country_code = '+33', phone = '7 83 00 35 41' where id = 769 and coalesce(country_code, '') = '+33' and phone = '783003541'; -- +33 783003541 → +33 7 83 00 35 41
update public.contact_phones set country_code = '+33', phone = '6 63 14 75 88' where id = 770 and coalesce(country_code, '') = '+33' and phone = '663147588'; -- +33 663147588 → +33 6 63 14 75 88
update public.contact_phones set country_code = '+353', phone = '86 382 2559' where id = 771 and coalesce(country_code, '') = '+353' and phone = '863822559'; -- +353 863822559 → +353 86 382 2559
update public.contact_phones set country_code = '+353', phone = '87 413 9207' where id = 773 and coalesce(country_code, '') = '+353' and phone = '874139207'; -- +353 874139207 → +353 87 413 9207
update public.contact_phones set country_code = '+33', phone = '9 55 69 67 31' where id = 780 and coalesce(country_code, '') = '+33' and phone = '0955696731'; -- +33 0955696731 → +33 9 55 69 67 31
commit;

-- to check: --   #393  ∅ 0879262103  (would read +33 879 26 21 03 — no country on the card)
-- to check: --   #694  ∅ 777228136  (would read +33 7 77 22 81 36 — no country on the card)
-- to check: --   #713  ∅ 867251493  (would read +33 867 25 14 93, an unusual French grouping — reads like an Irish 86 mobile)

-- ── Duplicates (SEPARATE OK — a delete) ──────────────────────────────────────────────────────────────────────────────
-- After the repair these rows hold the same number as another row of the same contact (the badly split copy):
--   #513 = #512 (contact 827) · #735 = #734 (823) · #752 = #751 (764) · #767 = #769 (742)
-- delete from public.contact_phones where id in (513, 735, 752, 767);
