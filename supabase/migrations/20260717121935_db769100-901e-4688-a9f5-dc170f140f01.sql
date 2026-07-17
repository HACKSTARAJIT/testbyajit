
CREATE TABLE public.test_mistake_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL UNIQUE REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  test_id uuid,
  subject_id uuid,
  overall jsonb NOT NULL DEFAULT '{}'::jsonb,
  question_analyses jsonb NOT NULL DEFAULT '[]'::jsonb,
  mistake_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  time_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  thinking_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  improvements jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  related_learning jsonb NOT NULL DEFAULT '[]'::jsonb,
  coach_summary text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_mistake_analyses TO authenticated;
GRANT ALL ON public.test_mistake_analyses TO service_role;
ALTER TABLE public.test_mistake_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own analyses select" ON public.test_mistake_analyses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own analyses insert" ON public.test_mistake_analyses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own analyses update" ON public.test_mistake_analyses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own analyses delete" ON public.test_mistake_analyses FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_tma_user ON public.test_mistake_analyses(user_id, created_at DESC);
CREATE TRIGGER trg_tma_updated BEFORE UPDATE ON public.test_mistake_analyses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mistake_dna (
  user_id uuid PRIMARY KEY,
  distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_attempt_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mistake_dna TO authenticated;
GRANT ALL ON public.mistake_dna TO service_role;
ALTER TABLE public.mistake_dna ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dna select" ON public.mistake_dna FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own dna insert" ON public.mistake_dna FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own dna update" ON public.mistake_dna FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_dna_updated BEFORE UPDATE ON public.mistake_dna FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
