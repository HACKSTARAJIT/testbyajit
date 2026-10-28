CREATE TABLE public.cgl_command_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, task_date date NOT NULL, title text NOT NULL, subject text, topic text, task_type text NOT NULL DEFAULT 'Study', start_minute integer, duration_minutes integer NOT NULL DEFAULT 30 CHECK(duration_minutes>0), priority text NOT NULL DEFAULT 'medium', status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','skipped','rescheduled')), locked boolean NOT NULL DEFAULT false, notes text, recommendation_key text, evidence text, related_path text, typing_wpm numeric, typing_accuracy numeric, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,task_date,recommendation_key));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cgl_command_tasks TO authenticated;
GRANT ALL ON public.cgl_command_tasks TO service_role;
ALTER TABLE public.cgl_command_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY cgl_tasks_owner ON public.cgl_command_tasks FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE INDEX cgl_tasks_owner_date ON public.cgl_command_tasks(user_id,task_date);
COMMENT ON COLUMN public.study_plan_tasks.command_details IS 'Reserved, unused: durable CGL tasks are isolated in cgl_command_tasks to survive legacy planner regeneration.';
CREATE OR REPLACE FUNCTION public.spaced_revision_question(_schedule_id uuid,_reveal boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.spaced_revision_schedules; w public.wrong_questions; m public.mock_mistake_questions; q public.questions; payload jsonb; original_name text;
BEGIN
 SELECT * INTO s FROM public.spaced_revision_schedules WHERE id=_schedule_id AND user_id=auth.uid();
 IF s.id IS NULL THEN RAISE EXCEPTION 'Revision not found'; END IF;
 IF s.wrong_question_id IS NOT NULL THEN
 SELECT * INTO w FROM public.wrong_questions WHERE id=s.wrong_question_id AND user_id=auth.uid();
 IF w.id IS NULL THEN RAISE EXCEPTION 'Original question unavailable'; END IF;
 IF w.question_id IS NOT NULL THEN SELECT * INTO q FROM public.questions WHERE id=w.question_id; END IF;
 payload:=jsonb_build_object('text',coalesce(w.question_text,q.question_text),'options',jsonb_build_object('A',q.option_a,'B',q.option_b,'C',q.option_c,'D',q.option_d),'previous',w.selected_option,'correct',CASE WHEN _reveal THEN coalesce(w.correct_option,q.correct_option) END,'explanation',CASE WHEN _reveal THEN coalesce(w.explanation,q.explanation) END,'has_answer',nullif(coalesce(w.correct_option,q.correct_option),'') IS NOT NULL,'topic',w.topic,'chapter',(SELECT name FROM public.chapters WHERE id=coalesce(w.chapter_id,q.chapter_id)),'subject',coalesce((SELECT name FROM public.subjects WHERE id=w.subject_id),'App Test'),'source',coalesce(w.test_name,'Wrong Questions'),'wrong_count',w.wrong_count);
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