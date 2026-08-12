ALTER TABLE public.wrong_questions
  ADD COLUMN IF NOT EXISTS total_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_correct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_wrong integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_skipped integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_wrong_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_wrong_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS test_name text;

UPDATE public.wrong_questions
SET total_wrong = GREATEST(COALESCE(wrong_count,0), 0),
    total_correct = GREATEST(COALESCE(correct_revision_count,0), 0),
    total_attempts = GREATEST(COALESCE(wrong_count,0),0) + GREATEST(COALESCE(correct_revision_count,0),0),
    first_wrong_at = COALESCE(first_wrong_at, created_at),
    last_wrong_at = COALESCE(last_wrong_at, last_attempt_at, created_at)
WHERE total_attempts = 0;