-- Archive clients when they reach a terminal stage (Closed, Closed Successfully, Dismissed).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN public.clients.archived_at IS
  'Set when current stage is Closed, Closed Successfully, or Dismissed; cleared when stage changes back.';

UPDATE public.clients c
SET archived_at = COALESCE(c.archived_at, NOW())
FROM public.service_milestones m
WHERE c.current_stage_id = m.id
  AND m.title ~* '^(closed(\s+successfully)?|dismissed)$'
  AND c.archived_at IS NULL;

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
        NEW.archived_at := COALESCE(NEW.archived_at, NOW());
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
