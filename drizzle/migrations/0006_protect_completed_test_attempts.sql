CREATE OR REPLACE FUNCTION public.protect_completed_test_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Completed test attempts are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_completed_test_attempt ON public.test_attempts;
CREATE TRIGGER protect_completed_test_attempt
  BEFORE UPDATE ON public.test_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_completed_test_attempt();