ALTER TABLE public.ai_mock_reports
  ADD COLUMN IF NOT EXISTS attempt_id uuid REFERENCES public.test_attempts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_test_id uuid REFERENCES public.tests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS analysis_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_attempt_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_error text,
  ADD COLUMN IF NOT EXISTS data_verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS analysis_version text,
  ADD COLUMN IF NOT EXISTS analysis_generated_at timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_mock_reports_analysis_status_check'
  ) THEN
    ALTER TABLE public.ai_mock_reports
      ADD CONSTRAINT ai_mock_reports_analysis_status_check
      CHECK (analysis_status IN ('pending', 'verified', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_mock_reports_attempt_id ON public.ai_mock_reports(attempt_id);
CREATE INDEX IF NOT EXISTS idx_ai_mock_reports_analysis_status ON public.ai_mock_reports(user_id, analysis_status, status);

CREATE TABLE IF NOT EXISTS public.ai_report_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.ai_mock_reports(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES public.test_attempts(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  analysis_version text NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  data_verification_status text NOT NULL,
  verified_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  consistency_status text NOT NULL DEFAULT 'passed',
  error text
);

GRANT SELECT ON public.ai_report_audit_logs TO authenticated;
GRANT ALL ON public.ai_report_audit_logs TO service_role;

ALTER TABLE public.ai_report_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_report_audit_logs' AND policyname = 'Users can read their own AI report audit logs'
  ) THEN
    CREATE POLICY "Users can read their own AI report audit logs"
    ON public.ai_report_audit_logs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.verify_ai_mock_report_data(
  _report_id uuid,
  _score numeric,
  _total_marks numeric,
  _correct integer,
  _wrong integer,
  _skipped integer,
  _accuracy numeric,
  _time_taken_seconds integer,
  _submitted_at timestamp with time zone,
  _negative_marks numeric DEFAULT 0,
  _attempt_id uuid DEFAULT NULL,
  _source_test_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _report record;
  _snapshot jsonb;
  _attempted integer;
  _expected_accuracy numeric;
  _err text;
BEGIN
  SELECT * INTO _report
  FROM public.ai_mock_reports
  WHERE id = _report_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'report not found';
  END IF;

  IF _score IS NULL OR _total_marks IS NULL OR _correct IS NULL OR _wrong IS NULL OR _skipped IS NULL
     OR _accuracy IS NULL OR _time_taken_seconds IS NULL OR _submitted_at IS NULL OR _negative_marks IS NULL THEN
    _err := 'Verified attempt data is incomplete. AI analysis cannot be generated until all required attempt values are saved.';
  ELSIF _total_marks <= 0 THEN
    _err := 'Total marks must be greater than zero.';
  ELSIF _score < 0 THEN
    _err := 'Score cannot be negative.';
  ELSIF _correct < 0 OR _wrong < 0 OR _skipped < 0 THEN
    _err := 'Correct, wrong and skipped counts cannot be negative.';
  ELSIF _accuracy < 0 OR _accuracy > 100 THEN
    _err := 'Accuracy must be between 0 and 100.';
  ELSIF _time_taken_seconds < 0 THEN
    _err := 'Time taken cannot be negative.';
  END IF;

  _attempted := COALESCE(_correct, 0) + COALESCE(_wrong, 0);
  IF _err IS NULL AND _attempted > 0 THEN
    _expected_accuracy := round((_correct::numeric / _attempted::numeric) * 100, 2);
    IF abs(_expected_accuracy - round(_accuracy, 2)) > 0.5 THEN
      _err := 'Accuracy does not match the verified correct/wrong counts.';
    END IF;
  END IF;

  _snapshot := jsonb_build_object(
    'attempt_id', _attempt_id,
    'student_id', auth.uid(),
    'test_id', _source_test_id,
    'score', _score,
    'total_marks', _total_marks,
    'correct', _correct,
    'wrong', _wrong,
    'skipped', _skipped,
    'accuracy', round(_accuracy, 2),
    'time_taken_seconds', _time_taken_seconds,
    'submitted_at', _submitted_at,
    'negative_marks', _negative_marks,
    'verified_at', now(),
    'source', CASE WHEN _attempt_id IS NULL THEN 'student_verified_upload' ELSE 'test_attempts' END
  );

  IF _err IS NOT NULL THEN
    UPDATE public.ai_mock_reports
    SET analysis_status = 'failed', verification_error = _err, status = 'failed', error = _err, updated_at = now()
    WHERE id = _report_id AND user_id = auth.uid();
    RAISE EXCEPTION '%', _err;
  END IF;

  UPDATE public.ai_mock_reports
  SET attempt_id = _attempt_id,
      source_test_id = _source_test_id,
      verified_attempt_snapshot = _snapshot,
      analysis_status = 'verified',
      verification_error = NULL,
      data_verified_at = now(),
      status = 'pending',
      error = NULL,
      updated_at = now()
  WHERE id = _report_id AND user_id = auth.uid();

  RETURN _snapshot;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_ai_mock_report_data(uuid, numeric, numeric, integer, integer, integer, numeric, integer, timestamp with time zone, numeric, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_ai_mock_report_data(uuid, numeric, numeric, integer, integer, integer, numeric, integer, timestamp with time zone, numeric, uuid, uuid) TO service_role;