
CREATE TABLE public.daily_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  title TEXT NOT NULL,
  category TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_targets TO authenticated;
GRANT ALL ON public.daily_targets TO service_role;
ALTER TABLE public.daily_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_daily_targets" ON public.daily_targets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_daily_targets_user_date ON public.daily_targets(user_id, target_date DESC);
CREATE TRIGGER trg_daily_targets_updated BEFORE UPDATE ON public.daily_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.daily_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  targets_total INT NOT NULL DEFAULT 0,
  targets_completed INT NOT NULL DEFAULT 0,
  consistency_score INT NOT NULL DEFAULT 0,
  consistency_label TEXT,
  seriousness_level TEXT,
  seriousness_reasons JSONB DEFAULT '[]'::jsonb,
  analysis TEXT,
  mentor_message TEXT,
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, review_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reviews TO authenticated;
GRANT ALL ON public.daily_reviews TO service_role;
ALTER TABLE public.daily_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_daily_reviews" ON public.daily_reviews FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_daily_reviews_user_date ON public.daily_reviews(user_id, review_date DESC);
CREATE TRIGGER trg_daily_reviews_updated BEFORE UPDATE ON public.daily_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
