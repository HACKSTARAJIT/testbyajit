-- Restore Data API access: grant table privileges that RLS policies expect
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_release, public.bookmarks, public.chapter_views, public.chapters, public.notes, public.pdf_progress, public.pdfs, public.performance, public.profiles, public.questions, public.results, public.revision_items, public.study_activity, public.subjects, public.test_attempts, public.tests, public.user_roles, public.wrong_questions TO authenticated;

GRANT ALL ON public.app_release, public.bookmarks, public.chapter_views, public.chapters, public.notes, public.pdf_progress, public.pdfs, public.performance, public.profiles, public.questions, public.results, public.revision_items, public.study_activity, public.subjects, public.test_attempts, public.tests, public.user_roles, public.wrong_questions TO service_role;

-- Guest (anon) read access to public study content only
GRANT SELECT ON public.subjects, public.chapters, public.pdfs, public.tests, public.questions, public.app_release TO anon;

-- Missing anon read policies so guests can browse subjects, chapters and PDFs
CREATE POLICY "Anyone can view subjects" ON public.subjects FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can view chapters" ON public.chapters FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can view pdfs" ON public.pdfs FOR SELECT TO anon USING (true);