CREATE TABLE public.mock_mistake_action_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'idle',
  plan jsonb,
  evidence jsonb,
  error text,
  questions_analyzed integer NOT NULL DEFAULT 0,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_mistake_action_plans TO authenticated;
GRANT ALL ON public.mock_mistake_action_plans TO service_role;
ALTER TABLE public.mock_mistake_action_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own action plan" ON public.mock_mistake_action_plans FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_mm_action_plans_updated BEFORE UPDATE ON public.mock_mistake_action_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mock_mistake_action_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  title text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, action_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_mistake_action_completions TO authenticated;
GRANT ALL ON public.mock_mistake_action_completions TO service_role;
ALTER TABLE public.mock_mistake_action_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own action completions" ON public.mock_mistake_action_completions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);