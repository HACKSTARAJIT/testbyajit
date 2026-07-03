-- Add explanation to questions for AI-generated MCQs
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS explanation text;

-- Add fields to tests for internal (online) AI-generated tests
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS test_part text;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS total_marks integer;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS total_questions integer;
