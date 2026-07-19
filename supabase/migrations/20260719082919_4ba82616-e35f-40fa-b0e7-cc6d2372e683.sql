
-- Remove anon read access from catalog tables
DROP POLICY IF EXISTS "Anyone can view pdfs" ON public.pdfs;
DROP POLICY IF EXISTS "Anyone can view chapters" ON public.chapters;
DROP POLICY IF EXISTS "Anyone can view subjects" ON public.subjects;
REVOKE SELECT ON public.pdfs FROM anon;
REVOKE SELECT ON public.chapters FROM anon;
REVOKE SELECT ON public.subjects FROM anon;

-- Hide unpublished tests from anon + non-admin authenticated users
DROP POLICY IF EXISTS "Anyone can view tests" ON public.tests;
DROP POLICY IF EXISTS "Authenticated view tests" ON public.tests;
REVOKE SELECT ON public.tests FROM anon;

CREATE POLICY "Authenticated view published tests"
ON public.tests
FOR SELECT
TO authenticated
USING (is_published = true OR has_role(auth.uid(), 'admin'::app_role));
