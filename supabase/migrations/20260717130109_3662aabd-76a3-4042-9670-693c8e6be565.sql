CREATE TABLE public.user_exam_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_name text NOT NULL,
  exam_date date,
  target_score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exam_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_exam_targets TO authenticated;
GRANT ALL ON public.user_exam_targets TO service_role;
ALTER TABLE public.user_exam_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own exam targets" ON public.user_exam_targets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_uet_updated BEFORE UPDATE ON public.user_exam_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();