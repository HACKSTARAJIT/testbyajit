
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
ALTER EXTENSION vector SET SCHEMA extensions;

-- Recreate match_questions so the vector type resolves in the extensions schema
DROP FUNCTION IF EXISTS public.match_questions(extensions.vector, int, uuid[]);
DROP FUNCTION IF EXISTS public.match_questions(vector, int, uuid[]);

CREATE OR REPLACE FUNCTION public.match_questions(
  query_embedding extensions.vector,
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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
  SELECT q.id, q.test_id, q.question_text, q.correct_option, q.topic, q.concept, q.exam_level, q.difficulty, q.created_at,
    (1 - (q.embedding <=> query_embedding))::float AS similarity
  FROM public.questions q
  WHERE q.embedding IS NOT NULL
    AND (exclude_ids IS NULL OR NOT (q.id = ANY(exclude_ids)))
  ORDER BY q.embedding <=> query_embedding
  LIMIT match_count;
$$;
REVOKE EXECUTE ON FUNCTION public.match_questions(extensions.vector, int, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_questions(extensions.vector, int, uuid[]) TO service_role;
