CREATE TABLE public.performance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE,
  title text,
  text_content text,
  image_path text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance TO authenticated;
GRANT ALL ON public.performance TO service_role;

ALTER TABLE public.performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view performance" ON public.performance
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage performance" ON public.performance
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_performance_updated_at
  BEFORE UPDATE ON public.performance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();