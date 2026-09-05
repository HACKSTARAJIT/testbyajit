CREATE TABLE public.study_time_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  normalized_key text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, normalized_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_time_subjects TO authenticated;
GRANT ALL ON public.study_time_subjects TO service_role;
ALTER TABLE public.study_time_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study subjects" ON public.study_time_subjects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_time_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  import_number integer NOT NULL DEFAULT 0,
  study_date date,
  entry_count integer NOT NULL DEFAULT 0,
  total_seconds integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'screenshot',
  source_reference text,
  status text NOT NULL DEFAULT 'saved',
  raw_extraction jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_time_imports TO authenticated;
GRANT ALL ON public.study_time_imports TO service_role;
ALTER TABLE public.study_time_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study imports" ON public.study_time_imports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  study_date date NOT NULL,
  subject_id uuid REFERENCES public.study_time_subjects(id) ON DELETE SET NULL,
  subject_name text NOT NULL,
  normalized_key text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  source text NOT NULL DEFAULT 'manual',
  source_reference text,
  needs_confirmation boolean NOT NULL DEFAULT false,
  notes text,
  import_batch_id uuid REFERENCES public.study_time_imports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_time_entries TO authenticated;
GRANT ALL ON public.study_time_entries TO service_role;
ALTER TABLE public.study_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study entries" ON public.study_time_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX study_time_entries_user_date_idx ON public.study_time_entries (user_id, study_date DESC);
CREATE INDEX study_time_entries_user_subject_idx ON public.study_time_entries (user_id, normalized_key);

CREATE TABLE public.study_time_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  daily_goal_seconds integer,
  weekly_goal_seconds integer,
  monthly_goal_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_time_goals TO authenticated;
GRANT ALL ON public.study_time_goals TO service_role;
ALTER TABLE public.study_time_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study goals" ON public.study_time_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_study_time_subjects_updated BEFORE UPDATE ON public.study_time_subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_study_time_entries_updated BEFORE UPDATE ON public.study_time_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_study_time_imports_updated BEFORE UPDATE ON public.study_time_imports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_study_time_goals_updated BEFORE UPDATE ON public.study_time_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();