
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS exam_level text,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS subtopic text,
  ADD COLUMN IF NOT EXISTS concept text,
  ADD COLUMN IF NOT EXISTS bloom_level text,
  ADD COLUMN IF NOT EXISTS importance text,
  ADD COLUMN IF NOT EXISTS expected_time_seconds integer,
  ADD COLUMN IF NOT EXISTS complexity_score integer,
  ADD COLUMN IF NOT EXISTS quality_score integer,
  ADD COLUMN IF NOT EXISTS ai_confidence integer,
  ADD COLUMN IF NOT EXISTS ai_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb,
  ADD COLUMN IF NOT EXISTS ai_analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_reviewed boolean NOT NULL DEFAULT false;

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS ai_analysis_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ai_analysis_summary jsonb,
  ADD COLUMN IF NOT EXISTS ai_analyzed_at timestamptz;

-- Allow admins to update questions (existing student policies keep read-only access)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questions' AND policyname='Admins can update questions') THEN
    CREATE POLICY "Admins can update questions" ON public.questions
      FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
