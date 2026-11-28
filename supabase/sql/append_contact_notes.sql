-- append_contact_notes: the share sheet's « → contact » adds its block to the card's Notes in ONE statement
-- (TODO §1, ContactDoor.md step 2; Pem « Launch three batches to tackle the full list »). Replaces the app's
-- read-then-write (two shares at once could lose one). Not through save_contact on purpose: a share is not a card
-- edit and must not log a « Contact modifié » Fil line per share.
-- Rules, as the other people doors: team or admin only; a private card is « not found » for a non-admin.
-- Same block format as before (share-triage/actions.ts appendBlock): « <notes>\n\n---\n[Share]\n<block> ».
-- Answers: {ok} · {unchanged} (empty block) · {refused: forbidden | not_found}.
-- New function: execute for authenticated only. Applied only on Pem's own OK; test append_contact_notes.test.sql.

create or replace function public.append_contact_notes(p_contact int, p_block text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin boolean := public.is_admin();
  v_ws constant text := E' \n\r\t';
  v_id int;
begin
  if not (v_admin or public.is_team()) then
    return jsonb_build_object('refused', 'forbidden');
  end if;
  if nullif(btrim(coalesce(p_block, ''), v_ws), '') is null then
    if exists (select 1 from public."Contact" c
                where c."ContactID" = p_contact and (v_admin or not coalesce(c.is_private, false))) then
      return jsonb_build_object('unchanged', true);
    end if;
    return jsonb_build_object('refused', 'not_found');
  end if;
  update public."Contact" c
     set "Notes" = case when nullif(btrim(coalesce(c."Notes", ''), v_ws), '') is null then p_block
                        else btrim(c."Notes", v_ws) || E'\n\n---\n[Share]\n' || p_block end
   where c."ContactID" = p_contact and (v_admin or not coalesce(c.is_private, false))
   returning c."ContactID" into v_id;
  if v_id is null then
    return jsonb_build_object('refused', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end
$$;

revoke all on function public.append_contact_notes(int, text) from public, anon;
grant execute on function public.append_contact_notes(int, text) to authenticated;
