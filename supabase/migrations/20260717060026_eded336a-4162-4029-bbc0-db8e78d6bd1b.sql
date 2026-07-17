
-- === Finding: questions_answer_key_exposed ===
-- Remove anon privileges (defense in depth) and tighten SELECT so users
-- can only read questions of tests they've actually started/completed or
-- questions saved in their own wrong-question bank; admins keep full access.
REVOKE ALL ON public.questions FROM anon;

DROP POLICY IF EXISTS "Authenticated view questions" ON public.questions;
CREATE POLICY "View questions with attempt or admin"
  ON public.questions
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.test_attempts ta
      WHERE ta.test_id = public.questions.test_id
        AND ta.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.wrong_questions wq
      WHERE wq.question_id = public.questions.id
        AND wq.user_id = auth.uid()
    )
  );

-- === Finding: wrong_questions_storage_folder_only_check ===
-- Require an actual owned wrong_questions row referencing the file path
-- for read/delete on wrong-question images; insert stays folder-scoped
-- because the DB row is created after upload.
DROP POLICY IF EXISTS "Users read own wrong question images" ON storage.objects;
CREATE POLICY "Users read own wrong question images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'study-materials'
    AND (storage.foldername(name))[1] = 'wrong-questions'
    AND (storage.foldername(name))[2] = (auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM public.wrong_questions wq
      WHERE wq.image_path = storage.objects.name
        AND wq.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users delete own wrong question images" ON storage.objects;
CREATE POLICY "Users delete own wrong question images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'study-materials'
    AND (storage.foldername(name))[1] = 'wrong-questions'
    AND (storage.foldername(name))[2] = (auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM public.wrong_questions wq
      WHERE wq.image_path = storage.objects.name
        AND wq.user_id = auth.uid()
    )
  );

-- === Finding: SUPA_authenticated_security_definer_function_executable ===
-- Revoke EXECUTE from signed-in users; only server-side (service role)
-- callers, e.g. an admin edge function, may invoke it.
REVOKE EXECUTE ON FUNCTION public.admin_get_user_emails(uuid[]) FROM PUBLIC, anon, authenticated;
