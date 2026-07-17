
-- 1) QUESTIONS: remove anonymous exposure of answer keys
DROP POLICY IF EXISTS "Anyone can view questions" ON public.questions;
REVOKE ALL ON public.questions FROM anon;
-- keep authenticated SELECT for app functionality (already granted)

-- 2) APP_RELEASE: restrict to authenticated
DROP POLICY IF EXISTS "Anyone can view app release" ON public.app_release;
CREATE POLICY "Authenticated view app release" ON public.app_release
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.app_release FROM anon;

-- 3) STORAGE: wrong-question images scoped to owner folder
DROP POLICY IF EXISTS "Users can read wrong question images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own wrong question images" ON storage.objects;

CREATE POLICY "Users read own wrong question images" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'study-materials'
    AND (storage.foldername(name))[1] = 'wrong-questions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
CREATE POLICY "Users upload own wrong question images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'study-materials'
    AND (storage.foldername(name))[1] = 'wrong-questions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
CREATE POLICY "Users delete own wrong question images" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'study-materials'
    AND (storage.foldername(name))[1] = 'wrong-questions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 4) TEST_ATTEMPTS: server-side score validation trigger
CREATE OR REPLACE FUNCTION public.validate_test_attempt_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _correct int := 0;
  _incorrect int := 0;
  _total int := 0;
  _marks numeric := 0;
  _attempted int;
  _skipped int;
  _accuracy int;
  ans text;
  q RECORD;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  IF NEW.answers IS NULL THEN
    NEW.answers := '{}'::jsonb;
  END IF;

  FOR q IN SELECT id, correct_option, marks FROM public.questions WHERE test_id = NEW.test_id LOOP
    _total := _total + 1;
    ans := NEW.answers->>(q.id::text);
    IF ans IS NOT NULL AND ans <> '' THEN
      IF ans = q.correct_option THEN
        _correct := _correct + 1;
        _marks := _marks + COALESCE(q.marks, 1);
      ELSE
        _incorrect := _incorrect + 1;
      END IF;
    END IF;
  END LOOP;

  _attempted := _correct + _incorrect;
  _skipped := GREATEST(_total - _attempted, 0);
  _accuracy := CASE WHEN _attempted > 0 THEN ROUND((_correct::numeric / _attempted) * 100)::int ELSE 0 END;

  NEW.correct_count := _correct;
  NEW.incorrect_count := _incorrect;
  NEW.unattempted_count := _skipped;
  NEW.skipped_count := _skipped;
  NEW.marks_obtained := _marks;
  NEW.total_questions := _total;
  NEW.accuracy := _accuracy;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_test_attempt_score() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_test_attempt_score ON public.test_attempts;
CREATE TRIGGER trg_validate_test_attempt_score
  BEFORE INSERT OR UPDATE ON public.test_attempts
  FOR EACH ROW EXECUTE FUNCTION public.validate_test_attempt_score();

-- 5) has_role: switch to SECURITY INVOKER (user_roles already has RLS SELECT own)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Restrict handle_new_user (trigger-only)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
