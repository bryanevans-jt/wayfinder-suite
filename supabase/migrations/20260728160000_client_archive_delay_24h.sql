-- Delay archive until 24 hours after Closed / Closed Successfully / Dismissed.
-- Until then archived_at is in the future; app treats that as "pending archive"
-- (off ES active caseload immediately; hidden from supervisor/counselor after the timestamp).

COMMENT ON COLUMN public.clients.archived_at IS
  'When current stage is Closed, Closed Successfully, or Dismissed: scheduled archive time (now+24h on stage change). Cleared when stage changes back. Effective archive when archived_at <= now().';

CREATE OR REPLACE FUNCTION public.sync_client_archived_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  stage_title text;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id THEN
    IF NEW.current_stage_id IS NULL THEN
      NEW.archived_at := NULL;
    ELSE
      SELECT title INTO stage_title
      FROM public.service_milestones
      WHERE id = NEW.current_stage_id;

      IF stage_title ~* '^(closed(\s+successfully)?|dismissed)$' THEN
        NEW.archived_at := NOW() + INTERVAL '24 hours';
      ELSE
        NEW.archived_at := NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_sync_archived_at ON public.clients;

CREATE TRIGGER clients_sync_archived_at
  BEFORE INSERT OR UPDATE OF current_stage_id ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_archived_at();
