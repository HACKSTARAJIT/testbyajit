
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz,
  ADD COLUMN IF NOT EXISTS embedding_model text;

CREATE INDEX IF NOT EXISTS questions_content_hash_idx ON public.questions(content_hash);
CREATE INDEX IF NOT EXISTS questions_embedding_idx ON public.questions USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS public.question_similarity_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL UNIQUE REFERENCES public.questions(id) ON DELETE CASCADE,
  test_id uuid,
  top_match_score numeric NOT NULL DEFAULT 0,
  top_match_status text NOT NULL DEFAULT 'original',
  variant_type text,
  matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_recommendation text,
  admin_status text NOT NULL DEFAULT 'pending',
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_similarity_reports TO authenticated;
GRANT ALL ON public.question_similarity_reports TO service_role;
ALTER TABLE public.question_similarity_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read similarity reports" ON public.question_similarity_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write similarity reports" ON public.question_similarity_reports
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update similarity reports" ON public.question_similarity_reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete similarity reports" ON public.question_similarity_reports
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS qsr_test_idx ON public.question_similarity_reports(test_id);
CREATE INDEX IF NOT EXISTS qsr_status_idx ON public.question_similarity_reports(top_match_status);
CREATE TRIGGER trg_qsr_updated BEFORE UPDATE ON public.question_similarity_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.match_questions(
  query_embedding vector(1536),
  match_count int DEFAULT 8,
  exclude_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  test_id uuid,
  question_text text,
  correct_option text,
  topic text,
  concept text,
  exam_level text,
  difficulty text,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT q.id, q.test_id, q.question_text, q.correct_option, q.topic, q.concept, q.exam_level, q.difficulty, q.created_at,
    (1 - (q.embedding <=> query_embedding))::float AS similarity
  FROM public.questions q
  WHERE q.embedding IS NOT NULL
    AND (exclude_ids IS NULL OR NOT (q.id = ANY(exclude_ids)))
  ORDER BY q.embedding <=> query_embedding
  LIMIT match_count;
$$;
GRANT EXECUTE ON FUNCTION public.match_questions(vector, int, uuid[]) TO authenticated, service_role;
