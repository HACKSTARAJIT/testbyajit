
ALTER TABLE public.imported_report_insights
  ADD COLUMN IF NOT EXISTS hierarchy jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS patterns jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recurring jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deep_analysis_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS deep_analysis_error text;

CREATE TABLE IF NOT EXISTS public.imported_auto_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id uuid NOT NULL REFERENCES public.imported_mock_reports(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  subject text,
  chapter text,
  topic text,
  subtopic text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  item_count integer NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'medium',
  difficulty_curve text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imported_auto_tests TO authenticated;
GRANT ALL ON public.imported_auto_tests TO service_role;

ALTER TABLE public.imported_auto_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own imported auto tests"
  ON public.imported_auto_tests
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_imported_auto_tests_user_report
  ON public.imported_auto_tests (user_id, report_id, kind);

CREATE TRIGGER update_imported_auto_tests_updated_at
  BEFORE UPDATE ON public.imported_auto_tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
