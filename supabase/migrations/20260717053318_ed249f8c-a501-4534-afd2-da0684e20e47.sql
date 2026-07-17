
-- study_plan_tasks
CREATE TABLE public.study_plan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.ai_mock_reports(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'today', -- today|tomorrow|week|month
  task_date date,
  day_index int,
  week_index int,
  title text NOT NULL,
  description text,
  subject text,
  chapter text,
  topic text,
  estimated_minutes int NOT NULL DEFAULT 30,
  practice_questions int NOT NULL DEFAULT 0,
  revision_minutes int NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'medium', -- critical|high|medium|strong
  status text NOT NULL DEFAULT 'pending', -- pending|done|skipped
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plan_tasks TO authenticated;
GRANT ALL ON public.study_plan_tasks TO service_role;
ALTER TABLE public.study_plan_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own study tasks" ON public.study_plan_tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_study_plan_tasks_user_date ON public.study_plan_tasks(user_id, task_date);
CREATE INDEX idx_study_plan_tasks_report ON public.study_plan_tasks(report_id);
CREATE TRIGGER trg_study_plan_tasks_updated BEFORE UPDATE ON public.study_plan_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- smart_goals
CREATE TABLE public.smart_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.ai_mock_reports(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  target_value numeric,
  current_value numeric NOT NULL DEFAULT 0,
  unit text,
  deadline date,
  status text NOT NULL DEFAULT 'active', -- active|achieved|expired
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_goals TO authenticated;
GRANT ALL ON public.smart_goals TO service_role;
ALTER TABLE public.smart_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own smart goals" ON public.smart_goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_smart_goals_user ON public.smart_goals(user_id, status);
CREATE TRIGGER trg_smart_goals_updated BEFORE UPDATE ON public.smart_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ai_coach_snapshots (one per report)
CREATE TABLE public.ai_coach_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id uuid UNIQUE REFERENCES public.ai_mock_reports(id) ON DELETE CASCADE,
  focus text,
  biggest_mistake text,
  target_score text,
  motivation text,
  revision_goal text,
  recommendations jsonb NOT NULL DEFAULT '{}'::jsonb, -- {tests:[], pdfs:[], chapters:[], topics:[], revision_sets:[]}
  sync_summary jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {matched:n, priority_bumped:n, added:n}
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_coach_snapshots TO authenticated;
GRANT ALL ON public.ai_coach_snapshots TO service_role;
ALTER TABLE public.ai_coach_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own coach snapshots" ON public.ai_coach_snapshots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_ai_coach_snapshots_user ON public.ai_coach_snapshots(user_id, created_at DESC);
CREATE TRIGGER trg_ai_coach_snapshots_updated BEFORE UPDATE ON public.ai_coach_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add source_report_id + topic to wrong_questions so mock-generated wrongs can be traced back
ALTER TABLE public.wrong_questions
  ADD COLUMN IF NOT EXISTS source_report_id uuid REFERENCES public.ai_mock_reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS topic text;
CREATE INDEX IF NOT EXISTS idx_wrong_questions_source_report ON public.wrong_questions(source_report_id);
