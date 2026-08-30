CREATE TABLE public.practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL,
  source_key text NOT NULL,
  title text NOT NULL DEFAULT '',
  subject text,
  chapter text,
  question_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  option_order jsonb NOT NULL DEFAULT '{}'::jsonb,
  shuffle_mode boolean NOT NULL DEFAULT false,
  current_index integer NOT NULL DEFAULT 0,
  current_question_id text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  marked jsonb NOT NULL DEFAULT '[]'::jsonb,
  skipped jsonb NOT NULL DEFAULT '[]'::jsonb,
  elapsed_seconds integer NOT NULL DEFAULT 0,
  remaining_seconds integer,
  status text NOT NULL DEFAULT 'active',
  last_saved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_sessions TO authenticated;
GRANT ALL ON public.practice_sessions TO service_role;

ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own practice sessions"
ON public.practice_sessions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX practice_sessions_live_unique
ON public.practice_sessions (user_id, source, source_key)
WHERE status IN ('active', 'paused');

CREATE INDEX practice_sessions_user_status_idx
ON public.practice_sessions (user_id, status, last_saved_at DESC);

CREATE TRIGGER trg_practice_sessions_updated
BEFORE UPDATE ON public.practice_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();