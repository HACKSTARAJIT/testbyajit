
CREATE TABLE public.syllabus_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  linked_subject_id UUID,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_subjects TO authenticated;
GRANT ALL ON public.syllabus_subjects TO service_role;
ALTER TABLE public.syllabus_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own syllabus_subjects" ON public.syllabus_subjects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_syllabus_subjects_user ON public.syllabus_subjects(user_id);

CREATE TABLE public.syllabus_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.syllabus_subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_chapters TO authenticated;
GRANT ALL ON public.syllabus_chapters TO service_role;
ALTER TABLE public.syllabus_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own syllabus_chapters" ON public.syllabus_chapters FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_syllabus_chapters_subject ON public.syllabus_chapters(subject_id);

CREATE TABLE public.syllabus_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.syllabus_subjects(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.syllabus_chapters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT,
  target_date DATE,
  estimated_hours NUMERIC,
  estimated_classes INT,
  estimated_pages INT,
  estimated_revisions INT,
  revision_count INT NOT NULL DEFAULT 0,
  resources JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_topics TO authenticated;
GRANT ALL ON public.syllabus_topics TO service_role;
ALTER TABLE public.syllabus_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own syllabus_topics" ON public.syllabus_topics FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_syllabus_topics_chapter ON public.syllabus_topics(chapter_id);
CREATE INDEX idx_syllabus_topics_user_status ON public.syllabus_topics(user_id, status);

CREATE TABLE public.syllabus_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  topic_id UUID REFERENCES public.syllabus_topics(id) ON DELETE CASCADE,
  subject_id UUID,
  chapter_id UUID,
  event_type TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_timeline TO authenticated;
GRANT ALL ON public.syllabus_timeline TO service_role;
ALTER TABLE public.syllabus_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own syllabus_timeline" ON public.syllabus_timeline FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_syllabus_timeline_user ON public.syllabus_timeline(user_id, created_at DESC);

CREATE TRIGGER trg_syllabus_subjects_updated BEFORE UPDATE ON public.syllabus_subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_syllabus_chapters_updated BEFORE UPDATE ON public.syllabus_chapters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_syllabus_topics_updated BEFORE UPDATE ON public.syllabus_topics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
