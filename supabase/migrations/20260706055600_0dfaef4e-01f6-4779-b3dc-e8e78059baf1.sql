
-- Extend wrong_questions with intelligence fields
ALTER TABLE public.wrong_questions
  ADD COLUMN IF NOT EXISTS question_id uuid,
  ADD COLUMN IF NOT EXISTS wrong_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS correct_revision_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consecutive_correct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS mastered_at timestamptz;

-- Ensure one row per user+question when question_id is present
CREATE UNIQUE INDEX IF NOT EXISTS wrong_questions_user_question_uidx
  ON public.wrong_questions (user_id, question_id)
  WHERE question_id IS NOT NULL;

-- Auto-generated revision tests (Wrong & Skipped) per user per original test
CREATE TABLE IF NOT EXISTS public.revision_tests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id uuid REFERENCES public.tests(id) ON DELETE CASCADE,
  subject_id uuid,
  chapter_id uuid,
  title text NOT NULL,
  question_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  question_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, test_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.revision_tests TO authenticated;
GRANT ALL ON public.revision_tests TO service_role;

ALTER TABLE public.revision_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own revision tests"
  ON public.revision_tests FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_revision_tests_updated_at
  BEFORE UPDATE ON public.revision_tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
