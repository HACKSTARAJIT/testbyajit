
ALTER TABLE public.wrong_questions
  ADD COLUMN IF NOT EXISTS is_guess boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_marked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mistake_type text,
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS question_type text;

CREATE INDEX IF NOT EXISTS wrong_questions_user_status_idx
  ON public.wrong_questions(user_id, status);
CREATE INDEX IF NOT EXISTS wrong_questions_user_priority_idx
  ON public.wrong_questions(user_id, priority);
