CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.get_test_accuracy_leaderboard(_test_id uuid, _viewer_id uuid)
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
         (b.user_id = _viewer_id) AS is_me
  FROM best b
  LEFT JOIN public.profiles p ON p.id = b.user_id
  ORDER BY rank ASC, display_name ASC
$$;
REVOKE ALL ON FUNCTION private.get_test_accuracy_leaderboard(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_test_accuracy_leaderboard(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_test_accuracy_leaderboard(_test_id uuid)
RETURNS TABLE(user_id uuid, display_name text, accuracy numeric, rank bigint, is_me boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT * FROM private.get_test_accuracy_leaderboard(_test_id, auth.uid())
  WHERE auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.get_test_accuracy_leaderboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_test_accuracy_leaderboard(uuid) TO authenticated;