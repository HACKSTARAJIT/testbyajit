
ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS answers jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_questions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_taken_seconds integer NOT NULL DEFAULT 0;
