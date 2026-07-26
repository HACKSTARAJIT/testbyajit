
ALTER TABLE public.imported_mock_reports
  ADD COLUMN IF NOT EXISTS source_ai text,
  ADD COLUMN IF NOT EXISTS overall_rank numeric,
  ADD COLUMN IF NOT EXISTS percentile numeric,
  ADD COLUMN IF NOT EXISTS section_scores jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.imported_report_insights
  ADD COLUMN IF NOT EXISTS mistake_bank jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS skipped_bank jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS learning_repository jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS additional_insights jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS question_level jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS improving_topics jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS declining_topics jsonb DEFAULT '[]'::jsonb;
