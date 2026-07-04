
-- 1. Allow guests (anon) to read published tests and their questions
GRANT SELECT ON public.questions TO anon;
GRANT SELECT ON public.tests TO anon;
GRANT SELECT ON public.subjects TO anon;
GRANT SELECT ON public.chapters TO anon;

CREATE POLICY "Anyone can view questions" ON public.questions FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can view tests" ON public.tests FOR SELECT TO anon USING (true);

-- 2. Publish status for tests
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

-- 3. Autosave / resume + richer analytics on test_attempts
ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'exam',
  ADD COLUMN IF NOT EXISTS skipped_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accuracy numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marked jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_test_attempts_updated_at ON public.test_attempts;
CREATE TRIGGER update_test_attempts_updated_at
  BEFORE UPDATE ON public.test_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Auto-save wrong questions WITHOUT screenshots: make image optional, add text fields
ALTER TABLE public.wrong_questions
  ALTER COLUMN image_path DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS question_text text,
  ADD COLUMN IF NOT EXISTS selected_option text,
  ADD COLUMN IF NOT EXISTS correct_option text,
  ADD COLUMN IF NOT EXISTS test_part text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
