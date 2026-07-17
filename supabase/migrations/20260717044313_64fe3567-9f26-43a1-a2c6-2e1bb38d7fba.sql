
CREATE TABLE public.ai_mock_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Mock Analysis',
  exam_name text,
  file_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  ocr_text text,
  report jsonb,
  overall_score numeric,
  accuracy numeric,
  readiness_score numeric,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_mock_reports TO authenticated;
GRANT ALL ON public.ai_mock_reports TO service_role;

ALTER TABLE public.ai_mock_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mock reports" ON public.ai_mock_reports
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all mock reports" ON public.ai_mock_reports
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ai_mock_reports_updated
  BEFORE UPDATE ON public.ai_mock_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ai_mock_reports_user ON public.ai_mock_reports(user_id, created_at DESC);
