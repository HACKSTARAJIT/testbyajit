REVOKE SELECT ON public.questions FROM authenticated;
REVOKE SELECT ON public.questions FROM anon;
GRANT SELECT (id, test_id, question_text, option_a, option_b, option_c, option_d, marks, sort_order, created_at) ON public.questions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;