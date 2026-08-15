CREATE TABLE public.mock_mistake_intelligence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'idle',
  report JSONB,
  evidence JSONB,
  questions_analyzed INTEGER NOT NULL DEFAULT 0,
  signature TEXT,
  error TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_mistake_intelligence TO authenticated;
GRANT ALL ON public.mock_mistake_intelligence TO service_role;
ALTER TABLE public.mock_mistake_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mock mistake intelligence" ON public.mock_mistake_intelligence FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.mock_mistake_ai_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  pattern_key TEXT NOT NULL,
  subject TEXT,
  area TEXT,
  kind TEXT,
  severity TEXT,
  summary TEXT,
  advice TEXT,
  evidence JSONB,
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pattern_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_mistake_ai_memory TO authenticated;
GRANT ALL ON public.mock_mistake_ai_memory TO service_role;
ALTER TABLE public.mock_mistake_ai_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mock mistake ai memory" ON public.mock_mistake_ai_memory FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_mm_ai_memory_user ON public.mock_mistake_ai_memory (user_id, last_seen_at DESC);