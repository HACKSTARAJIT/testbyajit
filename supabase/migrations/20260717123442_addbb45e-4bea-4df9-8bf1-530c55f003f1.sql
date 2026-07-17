
REVOKE EXECUTE ON FUNCTION public.match_questions(vector, int, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_questions(vector, int, uuid[]) TO service_role;
