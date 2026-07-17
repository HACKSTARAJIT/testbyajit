
ALTER TABLE public.ai_mock_reports
  ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'full_mock',
  ADD COLUMN IF NOT EXISTS detected_subject text,
  ADD COLUMN IF NOT EXISTS detected_chapter text,
  ADD COLUMN IF NOT EXISTS detected_topic text;

CREATE INDEX IF NOT EXISTS ai_mock_reports_user_type_idx
  ON public.ai_mock_reports (user_id, report_type, created_at DESC);
