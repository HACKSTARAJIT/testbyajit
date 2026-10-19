CREATE TABLE public.personal_task_lists (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), name text NOT NULL CHECK (length(btrim(name)) > 0), description text, category text, icon text NOT NULL DEFAULT 'checklist', color text NOT NULL DEFAULT 'primary', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_task_lists TO authenticated;
GRANT ALL ON public.personal_task_lists TO service_role;
ALTER TABLE public.personal_task_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY personal_task_lists_owner ON public.personal_task_lists FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TABLE public.personal_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), list_id uuid NOT NULL, user_id uuid NOT NULL DEFAULT auth.uid(), title text NOT NULL CHECK(length(btrim(title)) > 0), description text, task_type text NOT NULL DEFAULT 'Other', status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','IN_PROGRESS','COMPLETED')), priority text NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low','Medium','High')), due_date date, marks_obtained numeric, maximum_marks numeric, test_date date, attempt_number integer CHECK(attempt_number > 0), notes text, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(list_id,user_id) REFERENCES public.personal_task_lists(id,user_id) ON DELETE CASCADE, CHECK((marks_obtained IS NULL AND maximum_marks IS NULL) OR (marks_obtained IS NOT NULL AND maximum_marks > 0 AND marks_obtained >= 0 AND marks_obtained <= maximum_marks))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_tasks TO authenticated;
GRANT ALL ON public.personal_tasks TO service_role;
ALTER TABLE public.personal_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY personal_tasks_owner ON public.personal_tasks FOR ALL TO authenticated USING(user_id = auth.uid()) WITH CHECK(user_id = auth.uid());
CREATE UNIQUE INDEX personal_tasks_unique_title ON public.personal_tasks(list_id, lower(btrim(title)));
CREATE INDEX personal_task_lists_user ON public.personal_task_lists(user_id);
CREATE INDEX personal_tasks_user_list ON public.personal_tasks(user_id,list_id);
CREATE TABLE public.personal_task_status_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.personal_tasks(id) ON DELETE CASCADE, user_id uuid NOT NULL, previous_status text, status text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.personal_task_status_history TO authenticated;
GRANT ALL ON public.personal_task_status_history TO service_role;
ALTER TABLE public.personal_task_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY personal_task_history_owner ON public.personal_task_status_history FOR SELECT TO authenticated USING(user_id = auth.uid());
CREATE FUNCTION public.record_personal_task_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  INSERT INTO public.personal_task_status_history(task_id,user_id,previous_status,status) VALUES(NEW.id,NEW.user_id,NULL,NEW.status);
 ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
  INSERT INTO public.personal_task_status_history(task_id,user_id,previous_status,status) VALUES(NEW.id,NEW.user_id,OLD.status,NEW.status);
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_personal_task_status() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.set_personal_task_completed_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.status = 'COMPLETED' THEN
  IF TG_OP = 'INSERT' THEN NEW.completed_at := now();
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN NEW.completed_at := now();
  ELSE NEW.completed_at := OLD.completed_at; END IF;
 ELSE NEW.completed_at := NULL;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_personal_task_completed_at() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER personal_tasks_completed_at BEFORE INSERT OR UPDATE ON public.personal_tasks FOR EACH ROW EXECUTE FUNCTION public.set_personal_task_completed_at();
CREATE TRIGGER personal_tasks_status_history AFTER INSERT OR UPDATE ON public.personal_tasks FOR EACH ROW EXECUTE FUNCTION public.record_personal_task_status();
CREATE TRIGGER personal_tasks_updated BEFORE UPDATE ON public.personal_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER personal_task_lists_updated BEFORE UPDATE ON public.personal_task_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();