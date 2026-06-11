CREATE TABLE public.wrong_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id uuid REFERENCES public.tests(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  image_path text NOT NULL,
  note text,
  explanation text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wrong_questions TO authenticated;
GRANT ALL ON public.wrong_questions TO service_role;

ALTER TABLE public.wrong_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wrong questions"
ON public.wrong_questions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_wrong_questions_updated_at
BEFORE UPDATE ON public.wrong_questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_wrong_questions_user ON public.wrong_questions(user_id);
CREATE INDEX idx_wrong_questions_test ON public.wrong_questions(test_id);

CREATE POLICY "Users can upload own wrong question images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'study-materials' AND (storage.foldername(name))[1] = 'wrong-questions');

CREATE POLICY "Users can read wrong question images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'study-materials' AND (storage.foldername(name))[1] = 'wrong-questions');