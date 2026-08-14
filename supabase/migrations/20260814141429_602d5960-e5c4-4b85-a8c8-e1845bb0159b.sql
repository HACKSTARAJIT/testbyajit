CREATE OR REPLACE FUNCTION public.get_test_accuracy_leaderboard(_test_id uuid)
RETURNS TABLE(user_id uuid, display_name text, accuracy numeric, rank bigint, is_me boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH best AS (
    SELECT ta.user_id, MAX(ta.accuracy) AS accuracy
    FROM public.test_attempts ta
    WHERE ta.test_id = _test_id AND ta.status = 'completed'
    GROUP BY ta.user_id
  )
  SELECT b.user_id,
         COALESCE(NULLIF(p.display_name, ''), 'Student') AS display_name,
         ROUND(b.accuracy)::numeric AS accuracy,
         RANK() OVER (ORDER BY ROUND(b.accuracy) DESC) AS rank,
         (b.user_id = auth.uid()) AS is_me
  FROM best b
  LEFT JOIN public.profiles p ON p.id = b.user_id
  ORDER BY rank ASC, display_name ASC
$$;

REVOKE ALL ON FUNCTION public.get_test_accuracy_leaderboard(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_test_accuracy_leaderboard(uuid) TO authenticated;