CREATE OR REPLACE FUNCTION public.complete_mock_classification_item(
  _job_id uuid,
  _item_id uuid,
  _lease_token uuid,
  _hierarchy_version text,
  _ai_subject text,
  _ai_chapter text,
  _ai_topic text,
  _ai_subtopic text,
  _provider text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _question_id uuid;
  _already_current boolean;
BEGIN
  SELECT i.question_id INTO _question_id
  FROM public.mock_classification_job_items i
  JOIN public.mock_classification_jobs j ON j.id = i.job_id
  WHERE i.id = _item_id AND i.job_id = _job_id
    AND i.status = 'processing' AND j.lease_token = _lease_token
  FOR UPDATE OF i, j;

  IF _question_id IS NULL THEN RETURN false; END IF;
  IF NULLIF(btrim(_ai_subject), '') IS NULL OR NULLIF(btrim(_ai_chapter), '') IS NULL OR NULLIF(btrim(_ai_topic), '') IS NULL THEN
    RAISE EXCEPTION 'classification hierarchy is incomplete';
  END IF;

  SELECT classification_version = _hierarchy_version
         AND classification_status = 'classified'
         AND NULLIF(btrim(ai_chapter), '') IS NOT NULL
         AND NULLIF(btrim(ai_topic), '') IS NOT NULL
  INTO _already_current
  FROM public.mock_mistake_questions
  WHERE id = _question_id
  FOR UPDATE;

  IF COALESCE(_already_current, false) THEN
    UPDATE public.mock_classification_job_items
    SET status = 'skipped', attempts = attempts + 1,
        error_message = 'Already classified for the current hierarchy version',
        completed_at = now()
    WHERE id = _item_id;
  ELSE
    UPDATE public.mock_mistake_questions
    SET classification_id = COALESCE(classification_id, gen_random_uuid()),
        ai_subject = btrim(_ai_subject),
        ai_chapter = btrim(_ai_chapter),
        ai_topic = btrim(_ai_topic),
        ai_subtopic = NULLIF(btrim(COALESCE(_ai_subtopic, '')), ''),
        classification_status = 'classified',
        classification_version = _hierarchy_version,
        classified_at = now()
    WHERE id = _question_id;

    UPDATE public.mock_classification_job_items
    SET status = 'completed', attempts = attempts + 1,
        ai_subject = btrim(_ai_subject), ai_chapter = btrim(_ai_chapter),
        ai_topic = btrim(_ai_topic), ai_subtopic = NULLIF(btrim(COALESCE(_ai_subtopic, '')), ''),
        provider = _provider, error_message = NULL, completed_at = now()
    WHERE id = _item_id;
  END IF;

  UPDATE public.mock_classification_jobs j
  SET completed_questions = s.completed_count,
      failed_questions = s.failed_count,
      skipped_questions = s.skipped_count,
      current_question = s.completed_count + s.failed_count + s.skipped_count,
      current_question_id = _question_id,
      heartbeat_at = now(),
      lease_expires_at = now() + interval '90 seconds'
  FROM (
    SELECT count(*) FILTER (WHERE status = 'completed')::integer AS completed_count,
           count(*) FILTER (WHERE status = 'failed')::integer AS failed_count,
           count(*) FILTER (WHERE status = 'skipped')::integer AS skipped_count
    FROM public.mock_classification_job_items WHERE job_id = _job_id
  ) s
  WHERE j.id = _job_id AND j.lease_token = _lease_token;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_mock_classification_item(uuid, uuid, uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_mock_classification_item(uuid, uuid, uuid, text, text, text, text, text, text) TO service_role;