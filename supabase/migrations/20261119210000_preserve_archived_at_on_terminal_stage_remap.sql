-- Preserve clients.archived_at when remapping between terminal stages.
--
-- Remap migrations that update clients.current_stage_id (e.g. service-catalog
-- merges that point milestones at a canonical service) should keep archived_at
-- for already-archived terminal clients. Previously sync_client_archived_at()
-- always set now()+24h on any transition into a terminal title, which reset
-- long-closed clients during the 20261118120000 services merge.
--
-- Behaviour:
--   non-terminal → terminal  : archived_at := now() + 24 hours (unchanged)
--   terminal → non-terminal  : archived_at := null (unchanged)
--   terminal → terminal      : keep OLD.archived_at when it is already set
--   INSERT into terminal     : archived_at := now() + 24 hours (unchanged)

create or replace function public.sync_client_archived_at()
returns trigger
language plpgsql
set search_path to public
as $$
declare
  new_stage_title text;
  old_stage_title text;
  new_is_terminal boolean := false;
  old_is_terminal boolean := false;
  terminal_re text := '^(complete|dismissed|closed(\s+successfully)?|services[[:space:]]+interrupted)$';
begin
  if tg_op = 'INSERT' or new.current_stage_id is distinct from old.current_stage_id then
    if new.current_stage_id is null then
      new.archived_at := null;
    else
      select title into new_stage_title
      from public.service_milestones
      where id = new.current_stage_id;

      new_is_terminal := coalesce(new_stage_title, '') ~* terminal_re;

      if tg_op = 'UPDATE' and old.current_stage_id is not null then
        select title into old_stage_title
        from public.service_milestones
        where id = old.current_stage_id;
        old_is_terminal := coalesce(old_stage_title, '') ~* terminal_re;
      end if;

      if new_is_terminal then
        if tg_op = 'UPDATE'
           and old_is_terminal
           and old.archived_at is not null then
          -- Terminal → terminal remap (or equivalent): keep existing archive schedule.
          new.archived_at := old.archived_at;
        else
          new.archived_at := now() + interval '24 hours';
        end if;
      else
        new.archived_at := null;
      end if;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.sync_client_archived_at() is
  'Sets clients.archived_at from current_stage_id. Terminal→terminal updates keep OLD.archived_at when already set so remap migrations do not reset long-closed clients.';
