ALTER TABLE public.wrong_questions
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'app_test';

UPDATE public.wrong_questions SET source_type = 'app_test' WHERE source_type IS NULL OR source_type = '';

ALTER TABLE public.wrong_questions
  DROP CONSTRAINT IF EXISTS wrong_questions_source_type_check;

ALTER TABLE public.wrong_questions
  ADD CONSTRAINT wrong_questions_source_type_check
  CHECK (source_type IN ('app_test', 'mock_mistake'));

CREATE INDEX IF NOT EXISTS wrong_questions_user_source_type_idx
  ON public.wrong_questions(user_id, source_type);