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
SECURITY INVOKER
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

REVOKE ALL ON FUNCTION public.verify_ai_mock_report_data(uuid, numeric, numeric, integer, integer, integer, numeric, integer, timestamp with time zone, numeric, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_ai_mock_report_data(uuid, numeric, numeric, integer, integer, integer, numeric, integer, timestamp with time zone, numeric, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_ai_mock_report_data(uuid, numeric, numeric, integer, integer, integer, numeric, integer, timestamp with time zone, numeric, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_ai_mock_report_data(uuid, numeric, numeric, integer, integer, integer, numeric, integer, timestamp with time zone, numeric, uuid, uuid) TO service_role;