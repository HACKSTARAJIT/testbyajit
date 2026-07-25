
-- imported_mock_reports
CREATE TABLE public.imported_mock_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_number integer NOT NULL DEFAULT 1,
  mock_name text,
  original_text text NOT NULL,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric,
  accuracy numeric,
  attempt_percent numeric,
  negative_marks numeric,
  time_used text,
  verdict text,
  exam_readiness text,
  extraction_status text NOT NULL DEFAULT 'pending',
  extraction_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imported_mock_reports TO authenticated;
GRANT ALL ON public.imported_mock_reports TO service_role;
ALTER TABLE public.imported_mock_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own imported reports" ON public.imported_mock_reports
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_imported_mock_reports_user ON public.imported_mock_reports(user_id, created_at DESC);
CREATE TRIGGER update_imported_mock_reports_updated_at BEFORE UPDATE ON public.imported_mock_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- imported_report_insights
CREATE TABLE public.imported_report_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.imported_mock_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  strong_subjects jsonb NOT NULL DEFAULT '[]'::jsonb,
  weak_subjects jsonb NOT NULL DEFAULT '[]'::jsonb,
  strong_chapters jsonb NOT NULL DEFAULT '[]'::jsonb,
  weak_chapters jsonb NOT NULL DEFAULT '[]'::jsonb,
  strong_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  weak_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  critical_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  conceptual_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  silly_mistakes jsonb NOT NULL DEFAULT '[]'::jsonb,
  guesswork jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  reading_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  time_problems jsonb NOT NULL DEFAULT '[]'::jsonb,
  red_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision_priority jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_plan_3day jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_mock_strategy jsonb NOT NULL DEFAULT '[]'::jsonb,
  high_roi_chapters jsonb NOT NULL DEFAULT '[]'::jsonb,
  high_roi_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imported_report_insights TO authenticated;
GRANT ALL ON public.imported_report_insights TO service_role;
ALTER TABLE public.imported_report_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own imported insights" ON public.imported_report_insights
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_imported_report_insights_report ON public.imported_report_insights(report_id);
CREATE TRIGGER update_imported_report_insights_updated_at BEFORE UPDATE ON public.imported_report_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- imported_coach_memory (rolling summary per user, single row)
CREATE TABLE public.imported_coach_memory (
  user_id uuid PRIMARY KEY,
  memory jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_report_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imported_coach_memory TO authenticated;
GRANT ALL ON public.imported_coach_memory TO service_role;
ALTER TABLE public.imported_coach_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coach memory" ON public.imported_coach_memory
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_imported_coach_memory_updated_at BEFORE UPDATE ON public.imported_coach_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
