
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS negative_marks numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS question_image_url text,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_tests_updated_at ON public.tests;
CREATE TRIGGER trg_tests_updated_at BEFORE UPDATE ON public.tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_questions_updated_at ON public.questions;
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.test_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.test_edit_history TO authenticated;
GRANT ALL ON public.test_edit_history TO service_role;

ALTER TABLE public.test_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read edit history"
  ON public.test_edit_history FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins write edit history"
  ON public.test_edit_history FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') AND edited_by = auth.uid());

CREATE INDEX IF NOT EXISTS test_edit_history_test_idx ON public.test_edit_history(test_id, created_at DESC);
