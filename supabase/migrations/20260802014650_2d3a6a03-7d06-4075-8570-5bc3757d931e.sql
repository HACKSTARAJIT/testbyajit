
CREATE TABLE public.app_intro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path text,
  media_kind text NOT NULL DEFAULT 'video',
  mime_type text,
  enabled boolean NOT NULL DEFAULT true,
  duration_seconds numeric NOT NULL DEFAULT 4,
  skip_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_intro TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_intro TO authenticated;
GRANT ALL ON public.app_intro TO service_role;
ALTER TABLE public.app_intro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_intro readable by everyone" ON public.app_intro FOR SELECT USING (true);
CREATE POLICY "app_intro admin manage" ON public.app_intro FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER app_intro_updated BEFORE UPDATE ON public.app_intro FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.feedback_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_enabled boolean NOT NULL DEFAULT true,
  animation_enabled boolean NOT NULL DEFAULT true,
  volume numeric NOT NULL DEFAULT 0.8,
  animation_duration_ms integer NOT NULL DEFAULT 2000,
  random_playback boolean NOT NULL DEFAULT true,
  category_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feedback_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_settings TO authenticated;
GRANT ALL ON public.feedback_settings TO service_role;
ALTER TABLE public.feedback_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_settings readable by everyone" ON public.feedback_settings FOR SELECT USING (true);
CREATE POLICY "feedback_settings admin manage" ON public.feedback_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER feedback_settings_updated BEFORE UPDATE ON public.feedback_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.feedback_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  media_type text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  label text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feedback_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_media TO authenticated;
GRANT ALL ON public.feedback_media TO service_role;
ALTER TABLE public.feedback_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_media readable by everyone" ON public.feedback_media FOR SELECT USING (true);
CREATE POLICY "feedback_media admin manage" ON public.feedback_media FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX feedback_media_cat_idx ON public.feedback_media (category, media_type);
