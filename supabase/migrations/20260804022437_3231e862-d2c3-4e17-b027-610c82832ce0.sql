ALTER TABLE public.mock_mistake_questions
  ADD COLUMN IF NOT EXISTS classification_id uuid,
  ADD COLUMN IF NOT EXISTS ai_subject text,
  ADD COLUMN IF NOT EXISTS ai_chapter text,
  ADD COLUMN IF NOT EXISTS ai_topic text,
  ADD COLUMN IF NOT EXISTS ai_subtopic text,
  ADD COLUMN IF NOT EXISTS classification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS practice_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correct_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wrong_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_practice_at timestamptz,
  ADD COLUMN IF NOT EXISTS mastered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_status text NOT NULL DEFAULT 'wrong';

CREATE INDEX IF NOT EXISTS idx_mmq_user_class ON public.mock_mistake_questions (user_id, classification_status);
CREATE INDEX IF NOT EXISTS idx_mmq_ai_chapter ON public.mock_mistake_questions (user_id, ai_chapter, ai_topic);

ALTER TABLE public.mock_mistake_mocks
  ADD COLUMN IF NOT EXISTS organize_status text NOT NULL DEFAULT 'not_organized',
  ADD COLUMN IF NOT EXISTS organize_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS organize_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS organize_message text,
  ADD COLUMN IF NOT EXISTS organize_error text,
  ADD COLUMN IF NOT EXISTS organized_at timestamptz;