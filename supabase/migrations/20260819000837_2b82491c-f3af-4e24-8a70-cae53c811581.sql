ALTER TABLE public.mock_mistake_questions
  ADD COLUMN IF NOT EXISTS classification_version text;

CREATE TABLE public.mock_classification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('mock', 'subject')),
  scope_key text NOT NULL,
  mock_id uuid REFERENCES public.mock_mistake_mocks(id) ON DELETE CASCADE,
  subject text NOT NULL,
  hierarchy_version text NOT NULL,
  total_questions integer NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
  completed_questions integer NOT NULL DEFAULT 0 CHECK (completed_questions >= 0),
  failed_questions integer NOT NULL DEFAULT 0 CHECK (failed_questions >= 0),
  skipped_questions integer NOT NULL DEFAULT 0 CHECK (skipped_questions >= 0),
  current_question integer NOT NULL DEFAULT 0 CHECK (current_question >= 0),
  current_question_id uuid REFERENCES public.mock_mistake_questions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'partial', 'failed', 'stalled', 'cancelled')),
  started_at timestamptz,
  heartbeat_at timestamptz,
  lease_expires_at timestamptz,
  lease_token uuid,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mock_classification_jobs TO authenticated;
GRANT ALL ON public.mock_classification_jobs TO service_role;
ALTER TABLE public.mock_classification_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own classification jobs"
  ON public.mock_classification_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX mock_classification_one_active_scope
  ON public.mock_classification_jobs (user_id, scope_type, scope_key, hierarchy_version)
  WHERE status IN ('pending', 'processing', 'stalled');
CREATE INDEX mock_classification_jobs_owner_status
  ON public.mock_classification_jobs (user_id, status, updated_at DESC);
CREATE INDEX mock_classification_jobs_scope
  ON public.mock_classification_jobs (user_id, subject, scope_type, created_at DESC);

CREATE TABLE public.mock_classification_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.mock_classification_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question_id uuid NOT NULL REFERENCES public.mock_mistake_questions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  ai_subject text,
  ai_chapter text,
  ai_topic text,
  ai_subtopic text,
  provider text,
  error_message text,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, question_id)
);
GRANT SELECT ON public.mock_classification_job_items TO authenticated;
GRANT ALL ON public.mock_classification_job_items TO service_role;
ALTER TABLE public.mock_classification_job_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own classification job items"
  ON public.mock_classification_job_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX mock_classification_items_pending
  ON public.mock_classification_job_items (job_id, status, created_at);
CREATE INDEX mock_classification_items_question_version
  ON public.mock_classification_job_items (question_id, job_id);

CREATE TRIGGER trg_mock_classification_jobs_updated
  BEFORE UPDATE ON public.mock_classification_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mock_classification_items_updated
  BEFORE UPDATE ON public.mock_classification_job_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_mock_classification_job(
  _job_id uuid,
  _lease_token uuid,
  _lease_seconds integer DEFAULT 90
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _claimed boolean;
BEGIN
  UPDATE public.mock_classification_jobs
  SET status = 'processing',
      started_at = COALESCE(started_at, now()),
      heartbeat_at = now(),
      lease_token = _lease_token,
      lease_expires_at = now() + make_interval(secs => LEAST(GREATEST(_lease_seconds, 15), 300)),
      error_message = NULL
  WHERE id = _job_id
    AND status IN ('pending', 'processing', 'stalled', 'partial', 'failed')
    AND (lease_expires_at IS NULL OR lease_expires_at < now() OR lease_token = _lease_token);
  GET DIAGNOSTICS _claimed = ROW_COUNT;
  RETURN _claimed;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_mock_classification_job(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mock_classification_job(uuid, uuid, integer) TO service_role;

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

CREATE OR REPLACE FUNCTION public.fail_mock_classification_item(
  _job_id uuid,
  _item_id uuid,
  _lease_token uuid,
  _error_message text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mock_classification_job_items i
  SET status = 'failed', attempts = attempts + 1,
      error_message = left(COALESCE(_error_message, 'Unknown classification error'), 1000),
      completed_at = now()
  FROM public.mock_classification_jobs j
  WHERE i.id = _item_id AND i.job_id = _job_id AND j.id = i.job_id
    AND i.status = 'processing' AND j.lease_token = _lease_token;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.mock_classification_jobs j
  SET completed_questions = s.completed_count,
      failed_questions = s.failed_count,
      skipped_questions = s.skipped_count,
      current_question = s.completed_count + s.failed_count + s.skipped_count,
      heartbeat_at = now(),
      lease_expires_at = now() + interval '90 seconds',
      retry_count = retry_count + 1,
      error_message = left(COALESCE(_error_message, 'Question failed'), 1000)
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
REVOKE ALL ON FUNCTION public.fail_mock_classification_item(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_mock_classification_item(uuid, uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_mock_classification_job(
  _job_id uuid,
  _lease_token uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pending integer;
  _completed integer;
  _failed integer;
  _skipped integer;
  _status text;
BEGIN
  SELECT count(*) FILTER (WHERE status IN ('pending', 'processing')),
         count(*) FILTER (WHERE status = 'completed'),
         count(*) FILTER (WHERE status = 'failed'),
         count(*) FILTER (WHERE status = 'skipped')
  INTO _pending, _completed, _failed, _skipped
  FROM public.mock_classification_job_items WHERE job_id = _job_id;

  _status := CASE
    WHEN _pending > 0 THEN 'processing'
    WHEN _failed > 0 AND _completed > 0 THEN 'partial'
    WHEN _failed > 0 THEN 'failed'
    ELSE 'completed'
  END;

  UPDATE public.mock_classification_jobs
  SET status = _status,
      completed_questions = _completed,
      failed_questions = _failed,
      skipped_questions = _skipped,
      current_question = _completed + _failed + _skipped,
      current_question_id = CASE WHEN _pending = 0 THEN NULL ELSE current_question_id END,
      heartbeat_at = now(), lease_token = NULL, lease_expires_at = NULL,
      completed_at = CASE WHEN _pending = 0 THEN now() ELSE NULL END
  WHERE id = _job_id AND lease_token = _lease_token;
  RETURN _status;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_mock_classification_job(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_mock_classification_job(uuid, uuid) TO service_role;