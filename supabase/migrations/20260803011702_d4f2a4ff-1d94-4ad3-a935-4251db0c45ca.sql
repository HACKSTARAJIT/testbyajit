ALTER TABLE public.test_mistake_analyses
  ADD COLUMN IF NOT EXISTS topic_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS repeated_weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hindi_report jsonb NOT NULL DEFAULT '{}'::jsonb;