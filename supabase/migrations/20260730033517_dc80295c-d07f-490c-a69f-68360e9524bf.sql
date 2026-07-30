CREATE TABLE public.mock_mistake_mocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_mistake_mocks TO authenticated;
GRANT ALL ON public.mock_mistake_mocks TO service_role;
ALTER TABLE public.mock_mistake_mocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own mock mistake mocks"
ON public.mock_mistake_mocks FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all mock mistake mocks"
ON public.mock_mistake_mocks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.mock_mistake_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_id uuid NOT NULL REFERENCES public.mock_mistake_mocks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question_text text NOT NULL,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_answer text,
  user_answer text,
  chapter text,
  topic text,
  explanation text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_mistake_questions TO authenticated;
GRANT ALL ON public.mock_mistake_questions TO service_role;
ALTER TABLE public.mock_mistake_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own mock mistake questions"
ON public.mock_mistake_questions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all mock mistake questions"
ON public.mock_mistake_questions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_mmm_user ON public.mock_mistake_mocks(user_id, subject);
CREATE INDEX idx_mmq_mock ON public.mock_mistake_questions(mock_id, sort_order);

CREATE TRIGGER update_mock_mistake_mocks_updated_at BEFORE UPDATE ON public.mock_mistake_mocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mock_mistake_questions_updated_at BEFORE UPDATE ON public.mock_mistake_questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();