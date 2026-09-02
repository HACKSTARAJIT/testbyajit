ALTER TABLE public.wrong_questions
  ADD COLUMN IF NOT EXISTS practice_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS practice_correct_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mastery_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_practiced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sub_topic text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wrong_questions_mastery_status_check'
  ) THEN
    ALTER TABLE public.wrong_questions
      ADD CONSTRAINT wrong_questions_mastery_status_check
      CHECK (mastery_status IN ('active', 'mastered'));
  END IF;
END $$;

UPDATE public.wrong_questions
SET mastery_status = CASE WHEN status = 'mastered' THEN 'mastered' ELSE 'active' END,
    is_active = (status <> 'mastered'),
    practice_correct_count = CASE
      WHEN status = 'mastered' THEN GREATEST(COALESCE(correct_revision_count, 0), 2)
      ELSE LEAST(COALESCE(correct_revision_count, 0), 1)
    END,
    practice_attempts = GREATEST(COALESCE(total_attempts, 0), 0);

CREATE INDEX IF NOT EXISTS wrong_questions_active_idx
  ON public.wrong_questions (user_id, source_type, is_active);