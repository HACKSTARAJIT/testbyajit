
CREATE TABLE public.chapter_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_views TO authenticated;
GRANT ALL ON public.chapter_views TO service_role;
ALTER TABLE public.chapter_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own chapter views" ON public.chapter_views FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own chapter views" ON public.chapter_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own chapter views" ON public.chapter_views FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own chapter views" ON public.chapter_views FOR DELETE TO authenticated USING (auth.uid() = user_id);
