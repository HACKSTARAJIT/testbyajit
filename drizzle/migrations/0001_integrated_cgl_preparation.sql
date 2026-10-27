CREATE TABLE public.cgl_study_settings (user_id uuid PRIMARY KEY, settings jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cgl_study_settings TO authenticated;
GRANT ALL ON public.cgl_study_settings TO service_role;
ALTER TABLE public.cgl_study_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY cgl_settings_owner ON public.cgl_study_settings FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
ALTER TABLE public.imported_mock_reports ADD COLUMN entry_kind text NOT NULL DEFAULT 'ai_import', ADD COLUMN manual_details jsonb, ADD COLUMN maximum_marks numeric;
COMMENT ON COLUMN public.imported_mock_reports.manual_details IS 'Reviewed manual external mock statistics and configurable sections; independent of internal tests.';
CREATE INDEX imported_mock_manual_owner_date ON public.imported_mock_reports(user_id,created_at DESC) WHERE entry_kind='manual_external';
ALTER TABLE public.study_plan_tasks ADD COLUMN command_details jsonb;
CREATE UNIQUE INDEX command_task_recommendation ON public.study_plan_tasks(user_id,task_date,(command_details->>'recommendation_key')) WHERE command_details->>'recommendation_key' IS NOT NULL;
ALTER TABLE public.daily_reviews ADD COLUMN command_review jsonb;
CREATE TABLE public.spaced_revision_schedules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, wrong_question_id uuid REFERENCES public.wrong_questions(id) ON DELETE SET NULL, mock_question_id uuid REFERENCES public.mock_mistake_questions(id) ON DELETE SET NULL, source_key text NOT NULL, stage integer NOT NULL DEFAULT 0 CHECK(stage>=0), due_date date NOT NULL, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','mastered','unavailable')), failures integer NOT NULL DEFAULT 0, successes integer NOT NULL DEFAULT 0, streak integer NOT NULL DEFAULT 0, version integer NOT NULL DEFAULT 0, last_attempt_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,source_key), UNIQUE(id,user_id));
GRANT SELECT ON public.spaced_revision_schedules TO authenticated;
GRANT ALL ON public.spaced_revision_schedules TO service_role;
ALTER TABLE public.spaced_revision_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY spaced_schedule_owner ON public.spaced_revision_schedules FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE INDEX spaced_revision_owner_due ON public.spaced_revision_schedules(user_id,status,due_date);
CREATE TABLE public.spaced_revision_attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, schedule_id uuid NOT NULL, request_id uuid NOT NULL UNIQUE, result text NOT NULL, selected_answer text, confidence text, revealed boolean NOT NULL DEFAULT false, stage_before integer NOT NULL, due_after date NOT NULL, time_seconds integer NOT NULL DEFAULT 0 CHECK(time_seconds>=0), notes text, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(schedule_id,user_id) REFERENCES public.spaced_revision_schedules(id,user_id) ON DELETE CASCADE);
GRANT SELECT ON public.spaced_revision_attempts TO authenticated;
GRANT ALL ON public.spaced_revision_attempts TO service_role;
ALTER TABLE public.spaced_revision_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY spaced_attempt_owner ON public.spaced_revision_attempts FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE INDEX spaced_attempt_owner_date ON public.spaced_revision_attempts(user_id,created_at DESC);
CREATE FUNCTION public.add_spaced_revision(_source text,_question_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); event_time timestamptz; result_id uuid; config jsonb; zone text; interval_days integer;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT settings INTO config FROM public.cgl_study_settings WHERE user_id=uid;
 zone:=coalesce(config->>'timezone','Asia/Kolkata');
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=zone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
 interval_days:=coalesce((config->'revisionIntervals'->>0)::integer,1);
 IF interval_days<1 OR interval_days>365 THEN RAISE EXCEPTION 'Invalid revision interval'; END IF;
 IF _source='wrong' THEN SELECT coalesce(last_wrong_at,first_wrong_at,created_at) INTO event_time FROM public.wrong_questions WHERE id=_question_id AND user_id=uid AND (question_text IS NOT NULL OR question_id IS NOT NULL);
 ELSIF _source='mock' THEN SELECT created_at INTO event_time FROM public.mock_mistake_questions WHERE id=_question_id AND user_id=uid AND length(trim(question_text))>0;
 ELSE RAISE EXCEPTION 'Unsupported question source'; END IF;
 IF event_time IS NULL THEN RAISE EXCEPTION 'Question unavailable or not owned by you'; END IF;
 INSERT INTO public.spaced_revision_schedules(user_id,wrong_question_id,mock_question_id,source_key,due_date) VALUES(uid,CASE WHEN _source='wrong' THEN _question_id END,CASE WHEN _source='mock' THEN _question_id END,_source||':'||_question_id,(event_time AT TIME ZONE zone)::date+interval_days) ON CONFLICT(user_id,source_key) DO UPDATE SET source_key=excluded.source_key RETURNING id INTO result_id;
 RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.add_spaced_revision(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_spaced_revision(text,uuid) TO authenticated;
CREATE FUNCTION public.spaced_revision_question(_schedule_id uuid,_reveal boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.spaced_revision_schedules; w public.wrong_questions; m public.mock_mistake_questions; q public.questions; payload jsonb; original_name text;
BEGIN
 SELECT * INTO s FROM public.spaced_revision_schedules WHERE id=_schedule_id AND user_id=auth.uid();
 IF s.id IS NULL THEN RAISE EXCEPTION 'Revision not found'; END IF;
 IF s.wrong_question_id IS NOT NULL THEN
 SELECT * INTO w FROM public.wrong_questions WHERE id=s.wrong_question_id AND user_id=auth.uid();
 IF w.id IS NULL THEN RAISE EXCEPTION 'Original question unavailable'; END IF;
 IF w.question_id IS NOT NULL THEN SELECT * INTO q FROM public.questions WHERE id=w.question_id; END IF;
 payload:=jsonb_build_object('text',coalesce(w.question_text,q.question_text),'options',jsonb_build_object('A',q.option_a,'B',q.option_b,'C',q.option_c,'D',q.option_d),'previous',w.selected_option,'correct',CASE WHEN _reveal THEN coalesce(w.correct_option,q.correct_option) END,'explanation',CASE WHEN _reveal THEN coalesce(w.explanation,q.explanation) END,'has_answer',coalesce(w.correct_option,q.correct_option) IS NOT NULL,'topic',w.topic,'chapter',q.chapter,'subject',coalesce((SELECT name FROM public.subjects WHERE id=w.subject_id),'App Test'),'source',coalesce(w.test_name,'Wrong Questions'),'wrong_count',w.wrong_count);
 ELSE
 SELECT * INTO m FROM public.mock_mistake_questions WHERE id=s.mock_question_id AND user_id=auth.uid();
 IF m.id IS NULL THEN RAISE EXCEPTION 'Original question unavailable'; END IF;
 SELECT name INTO original_name FROM public.mock_mistake_mocks WHERE id=m.mock_id AND user_id=auth.uid();
 payload:=jsonb_build_object('text',m.question_text,'options',jsonb_build_object('A',m.option_a,'B',m.option_b,'C',m.option_c,'D',m.option_d),'previous',m.user_answer,'correct',CASE WHEN _reveal THEN nullif(m.correct_answer,'') END,'explanation',CASE WHEN _reveal THEN m.explanation END,'has_answer',nullif(m.correct_answer,'') IS NOT NULL,'topic',coalesce(m.ai_topic,m.topic),'chapter',coalesce(m.ai_chapter,m.chapter),'subject',coalesce(m.ai_subject,(SELECT subject FROM public.mock_mistake_mocks WHERE id=m.mock_id)),'source',original_name,'wrong_count',m.wrong_count);
 END IF;
 RETURN payload;
END $$;
REVOKE ALL ON FUNCTION public.spaced_revision_question(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.spaced_revision_question(uuid,boolean) TO authenticated;
CREATE FUNCTION public.submit_spaced_revision(_schedule_id uuid,_request_id uuid,_version integer,_selected text,_outcome text,_confidence text DEFAULT NULL,_revealed boolean DEFAULT false,_seconds integer DEFAULT 0,_notes text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.spaced_revision_schedules; config jsonb; intervals jsonb; zone text; today date; answer text; result text; next_stage integer; next_due date; success boolean; prior public.spaced_revision_attempts; data jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO prior FROM public.spaced_revision_attempts WHERE request_id=_request_id;
 IF prior.id IS NOT NULL THEN IF prior.user_id<>auth.uid() OR prior.schedule_id<>_schedule_id THEN RAISE EXCEPTION 'Invalid request'; END IF; RETURN to_jsonb(prior); END IF;
 SELECT * INTO s FROM public.spaced_revision_schedules WHERE id=_schedule_id AND user_id=auth.uid() FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Revision not found'; END IF;
 SELECT * INTO prior FROM public.spaced_revision_attempts WHERE request_id=_request_id;
 IF prior.id IS NOT NULL THEN RETURN to_jsonb(prior); END IF;
 IF s.version<>_version THEN RAISE EXCEPTION 'Revision changed in another session. Refresh before retrying.'; END IF;
 IF s.status<>'active' THEN RAISE EXCEPTION 'Revision is not active'; END IF;
 IF _outcome NOT IN ('correct','guessed','incorrect','skipped','could_not_solve','concept_not_understood') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
 IF _confidence IS NOT NULL AND _confidence NOT IN ('low','medium','high') THEN RAISE EXCEPTION 'Invalid confidence'; END IF;
 data:=public.spaced_revision_question(_schedule_id,true); answer:=nullif(data->>'correct','');
 result:=_outcome;
 IF _outcome IN ('correct','guessed','incorrect') AND answer IS NOT NULL AND NOT _revealed THEN
 IF nullif(_selected,'') IS NULL THEN RAISE EXCEPTION 'Select an answer first'; END IF;
 IF upper(trim(_selected))<>upper(trim(answer)) THEN result:='incorrect'; ELSIF _outcome<>'guessed' THEN result:='correct'; END IF;
 END IF;
 SELECT settings INTO config FROM public.cgl_study_settings WHERE user_id=auth.uid();
 zone:=coalesce(config->>'timezone','Asia/Kolkata'); intervals:=coalesce(config->'revisionIntervals','[1,3,7,14,30]'::jsonb);
 IF jsonb_array_length(intervals)<1 THEN RAISE EXCEPTION 'Configure revision intervals'; END IF;
 today:=(now() AT TIME ZONE zone)::date;
 success:=result='correct' AND NOT _revealed;
 next_stage:=CASE WHEN success THEN s.stage+1 ELSE 0 END;
 next_due:=today+CASE WHEN success THEN coalesce((intervals->>least(next_stage,jsonb_array_length(intervals)-1))::integer,30) ELSE coalesce((config->>'retryDays')::integer,1) END;
 INSERT INTO public.spaced_revision_attempts(user_id,schedule_id,request_id,result,selected_answer,confidence,revealed,stage_before,due_after,time_seconds,notes) VALUES(auth.uid(),s.id,_request_id,result,_selected,_confidence,_revealed,s.stage,next_due,greatest(_seconds,0),_notes) RETURNING * INTO prior;
 UPDATE public.spaced_revision_schedules SET stage=next_stage,due_date=next_due,status=CASE WHEN success AND next_stage>=jsonb_array_length(intervals) AND s.streak+1>=coalesce((config->>'masterySuccesses')::integer,5) THEN 'mastered' ELSE 'active' END,failures=failures+CASE WHEN success THEN 0 ELSE 1 END,successes=successes+CASE WHEN success THEN 1 ELSE 0 END,streak=CASE WHEN success THEN streak+1 ELSE 0 END,version=version+1,last_attempt_at=now(),updated_at=now() WHERE id=s.id;
 RETURN to_jsonb(prior);
END $$;
REVOKE ALL ON FUNCTION public.submit_spaced_revision(uuid,uuid,integer,text,text,text,boolean,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_spaced_revision(uuid,uuid,integer,text,text,text,boolean,integer,text) TO authenticated;
CREATE FUNCTION public.save_cgl_day_review(_date date,_review jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 INSERT INTO public.daily_reviews(user_id,review_date,command_review) VALUES(auth.uid(),_date,_review) ON CONFLICT(user_id,review_date) DO UPDATE SET command_review=excluded.command_review,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.save_cgl_day_review(date,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_cgl_day_review(date,jsonb) TO authenticated;