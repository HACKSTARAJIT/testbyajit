CREATE TABLE IF NOT EXISTS public.ai_provider_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  retry_count INTEGER NOT NULL DEFAULT 0,
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error_code TEXT,
  model TEXT,
  feature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_provider_logs TO authenticated;
GRANT ALL ON public.ai_provider_logs TO service_role;
ALTER TABLE public.ai_provider_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can read AI provider logs"
  ON public.ai_provider_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_ai_provider_logs_created_at ON public.ai_provider_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_provider_logs_feature ON public.ai_provider_logs (feature, created_at DESC);