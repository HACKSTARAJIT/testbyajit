CREATE FUNCTION public.validate_cgl_settings() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v jsonb; n integer; zone text;
BEGIN
 zone:=coalesce(NEW.settings->>'timezone','Asia/Kolkata');
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=zone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
 IF NEW.settings ? 'revisionIntervals' THEN
 IF jsonb_typeof(NEW.settings->'revisionIntervals')<>'array' OR jsonb_array_length(NEW.settings->'revisionIntervals')<1 THEN RAISE EXCEPTION 'At least one revision interval required'; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(NEW.settings->'revisionIntervals') LOOP
 IF (v::text)::numeric<>trunc((v::text)::numeric) OR (v::text)::numeric<1 OR (v::text)::numeric>365 THEN RAISE EXCEPTION 'Revision intervals must be whole days from 1 to 365'; END IF;
 END LOOP;
 END IF;
 FOREACH zone IN ARRAY ARRAY['retryDays','masterySuccesses'] LOOP
 IF NEW.settings ? zone THEN IF (NEW.settings->>zone)::numeric<>trunc((NEW.settings->>zone)::numeric) OR (NEW.settings->>zone)::numeric<1 OR (NEW.settings->>zone)::numeric>365 THEN RAISE EXCEPTION 'Retry and mastery values must be positive whole numbers'; END IF; END IF;
 END LOOP;
 IF NEW.settings ? 'dailyHours' AND ((NEW.settings->>'dailyHours')::numeric<=0 OR (NEW.settings->>'dailyHours')::numeric>24) THEN RAISE EXCEPTION 'Daily study hours must be between 0 and 24'; END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER validate_cgl_settings_before_save BEFORE INSERT OR UPDATE ON public.cgl_study_settings FOR EACH ROW EXECUTE FUNCTION public.validate_cgl_settings();
REVOKE ALL ON FUNCTION public.validate_cgl_settings() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.arrange_cgl_tasks(_date date,_placements jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE placement jsonb; task public.cgl_command_tasks;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 PERFORM id FROM public.cgl_command_tasks WHERE user_id=auth.uid() AND task_date=_date FOR UPDATE;
 FOR placement IN SELECT value FROM jsonb_array_elements(_placements) LOOP
 SELECT * INTO task FROM public.cgl_command_tasks WHERE id=(placement->>'id')::uuid AND user_id=auth.uid() AND task_date=_date;
 IF task.id IS NULL THEN RAISE EXCEPTION 'Task unavailable or not owned by you'; END IF;
 IF task.locked OR task.status IN ('completed','skipped') THEN CONTINUE; END IF;
 UPDATE public.cgl_command_tasks SET start_minute=(placement->>'start')::integer,updated_at=now() WHERE id=task.id AND user_id=auth.uid();
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.arrange_cgl_tasks(date,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.arrange_cgl_tasks(date,jsonb) TO authenticated;