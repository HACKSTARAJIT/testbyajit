ALTER TABLE public.wrong_questions
  ADD COLUMN IF NOT EXISTS mastery_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_result text;

UPDATE public.wrong_questions
SET mastery_score = LEAST(COALESCE(consecutive_correct, 0), 2);

UPDATE public.wrong_questions
SET status = 'mastered',
    mastered_at = COALESCE(mastered_at, now())
WHERE mastery_score >= 2 AND status <> 'mastered';