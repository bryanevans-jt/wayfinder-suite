-- Services Interrupted is a terminal stage (same caseload removal as Closed / Dismissed).
-- Ensure Individual Job Placement (TN) has that stage, and archive clients already on it.

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

      IF stage_title ~* '^(closed(\s+successfully)?|dismissed|services[[:space:]]+interrupted)$' THEN
        NEW.archived_at := NOW() + INTERVAL '24 hours';
      ELSE
        NEW.archived_at := NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.clients.archived_at IS
  'When current stage is Closed, Closed Successfully, Dismissed, or Services Interrupted: scheduled archive time (now+24h on stage change). Cleared when stage changes back. Effective archive when archived_at <= now().';

DO $$
DECLARE
  v_has_name boolean;
  v_service_id uuid;
  v_before_idx int;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_milestones'
      AND column_name = 'name'
  ) INTO v_has_name;

  SELECT id
  INTO v_service_id
  FROM public.services
  WHERE name ILIKE '%job placement%(tn)%'
  LIMIT 1;

  IF v_service_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.service_milestones m
    WHERE m.service_id = v_service_id
      AND lower(coalesce(m.title, '')) = 'services interrupted'
  ) THEN
    SELECT coalesce(min(m.order_index), 0)
    INTO v_before_idx
    FROM public.service_milestones m
    WHERE m.service_id = v_service_id
      AND lower(coalesce(m.title, '')) IN ('dismissed', 'closed');

    IF v_before_idx = 0 THEN
      SELECT coalesce(max(m.order_index), 0) + 1
      INTO v_before_idx
      FROM public.service_milestones m
      WHERE m.service_id = v_service_id;
    ELSE
      UPDATE public.service_milestones
      SET order_index = order_index + 1
      WHERE service_id = v_service_id
        AND order_index >= v_before_idx;
    END IF;

    IF v_has_name THEN
      INSERT INTO public.service_milestones (service_id, order_index, title, name)
      VALUES (v_service_id, v_before_idx, 'Services Interrupted', 'Services Interrupted');
    ELSE
      INSERT INTO public.service_milestones (service_id, order_index, title)
      VALUES (v_service_id, v_before_idx, 'Services Interrupted');
    END IF;
  END IF;
END $$;

UPDATE public.clients c
SET archived_at = NOW()
FROM public.service_milestones m
WHERE c.current_stage_id = m.id
  AND m.title ~* '^services[[:space:]]+interrupted$'
  AND c.archived_at IS NULL;
