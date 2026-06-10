-- App release (APK) metadata, single-row table
CREATE TABLE public.app_release (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL DEFAULT '1.0.0',
  file_path TEXT,
  file_size BIGINT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_release TO anon, authenticated;
GRANT ALL ON public.app_release TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.app_release TO authenticated;

ALTER TABLE public.app_release ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view app release" ON public.app_release
  FOR SELECT USING (true);
CREATE POLICY "Admins manage app release" ON public.app_release
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_app_release_updated_at BEFORE UPDATE ON public.app_release
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Subject enhancements: cover image + badges + ordering
ALTER TABLE public.subjects
  ADD COLUMN cover_image TEXT,
  ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_popular BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for app-releases bucket
CREATE POLICY "Authenticated read app releases" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'app-releases');
CREATE POLICY "Admins upload app releases" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'app-releases' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update app releases" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'app-releases' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete app releases" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'app-releases' AND public.has_role(auth.uid(), 'admin'));

-- Seed a default release row
INSERT INTO public.app_release (version) VALUES ('1.0.0');