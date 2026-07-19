
ALTER TABLE public.ai_mock_reports ALTER COLUMN verified_attempt_snapshot DROP NOT NULL;

UPDATE public.ai_mock_reports r
SET
  analysis_status = 'verified',
  status = 'completed',
  verification_error = NULL,
  error = NULL,
  data_verified_at = COALESCE(r.data_verified_at, now()),
  accuracy = COALESCE(r.accuracy, NULLIF((r.report->>'accuracy')::numeric, 0)),
  overall_score = COALESCE(r.overall_score, NULLIF((r.report->'totals'->>'score')::numeric, 0)),
  verified_attempt_snapshot = jsonb_build_object(
    'attempt_id', r.attempt_id,
    'student_id', r.user_id,
    'test_id', r.source_test_id,
    'score', (r.report->'totals'->>'score')::numeric,
    'total_marks', COALESCE((r.report->'totals'->>'max_score')::numeric, (r.report->'totals'->>'total_marks')::numeric),
    'correct', (r.report->'totals'->>'correct')::int,
    'wrong', (r.report->'totals'->>'wrong')::int,
    'skipped', COALESCE((r.report->'totals'->>'skipped')::int, 0),
    'accuracy', COALESCE((r.report->>'accuracy')::numeric, r.accuracy),
    'time_taken_seconds', COALESCE((r.report->'totals'->>'time_minutes')::numeric * 60, 0)::int,
    'submitted_at', COALESCE(r.created_at, now()),
    'negative_marks', COALESCE((r.report->'totals'->>'negative_marks')::numeric, 0),
    'verified_at', now(),
    'source', 'backfilled_from_prior_analysis'
  )
WHERE r.report IS NOT NULL
  AND (r.report->'totals'->>'score') IS NOT NULL
  AND (r.report->'totals'->>'correct') IS NOT NULL
  AND (r.report->'totals'->>'wrong') IS NOT NULL
  AND COALESCE((r.report->'totals'->>'max_score')::numeric, (r.report->'totals'->>'total_marks')::numeric, 0) > 0;

UPDATE public.ai_mock_reports
SET analysis_status = 'pending',
    status = 'pending',
    verification_error = NULL,
    error = NULL,
    verified_attempt_snapshot = NULL
WHERE analysis_status = 'failed'
  AND (report IS NULL OR report = '{}'::jsonb OR (report->'totals'->>'score') IS NULL);
