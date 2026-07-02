
-- BOOKMARKS
CREATE TABLE public.bookmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('pdf','chapter','test')),
  item_id UUID NOT NULL,
  subject_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bookmarks" ON public.bookmarks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- NOTES
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL,
  subject_id UUID,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes" ON public.notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- REVISION ITEMS
CREATE TABLE public.revision_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('chapter','test')),
  item_id UUID NOT NULL,
  subject_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revision_items TO authenticated;
GRANT ALL ON public.revision_items TO service_role;
ALTER TABLE public.revision_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own revision items" ON public.revision_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PDF PROGRESS
CREATE TABLE public.pdf_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pdf_id UUID NOT NULL,
  subject_id UUID,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','reading','completed')),
  last_page INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pdf_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_progress TO authenticated;
GRANT ALL ON public.pdf_progress TO service_role;
ALTER TABLE public.pdf_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pdf progress" ON public.pdf_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- STUDY ACTIVITY
CREATE TABLE public.study_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('subject','chapter','pdf','test')),
  item_id UUID NOT NULL,
  subject_id UUID,
  title TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_activity TO authenticated;
GRANT ALL ON public.study_activity TO service_role;
ALTER TABLE public.study_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own study activity" ON public.study_activity FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pdf_progress_updated_at BEFORE UPDATE ON public.pdf_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
