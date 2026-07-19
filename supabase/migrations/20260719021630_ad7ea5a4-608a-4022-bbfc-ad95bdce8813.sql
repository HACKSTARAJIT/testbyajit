
CREATE TABLE public.mock_generated_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id uuid NOT NULL REFERENCES public.ai_mock_reports(id) ON DELETE CASCADE,
  q_no integer,
  question_text text NOT NULL,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option text,
  marked_option text,
  original_status text,
  subject text,
  chapter text,
  topic text,
  explanation text,
  has_options boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_generated_questions TO authenticated;
GRANT ALL ON public.mock_generated_questions TO service_role;

ALTER TABLE public.mock_generated_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mock generated questions"
  ON public.mock_generated_questions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all mock generated questions"
  ON public.mock_generated_questions
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_mock_gen_q_user_report ON public.mock_generated_questions(user_id, report_id);
