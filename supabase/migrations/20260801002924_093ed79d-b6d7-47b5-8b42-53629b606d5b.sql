CREATE TABLE public.revision_practice_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('wrong_questions','mock_mistakes')),
  source_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Practice',
  subject TEXT,
  chapter TEXT,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  accuracy INTEGER NOT NULL DEFAULT 0,
  time_taken_seconds INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_analysis TEXT,
  ai_comparison TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.revision_practice_attempts TO authenticated;
GRANT ALL ON public.revision_practice_attempts TO service_role;

ALTER TABLE public.revision_practice_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own practice attempts"
ON public.revision_practice_attempts FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_rpa_user_source ON public.revision_practice_attempts (user_id, source, source_key, created_at DESC);

CREATE TRIGGER update_revision_practice_attempts_updated_at
BEFORE UPDATE ON public.revision_practice_attempts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();