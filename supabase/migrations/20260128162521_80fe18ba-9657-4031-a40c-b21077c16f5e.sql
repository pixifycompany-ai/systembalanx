-- Create metas table for configurable goals
CREATE TABLE public.metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('faturamento', 'lucro', 'mrr')),
  periodo VARCHAR(7) NOT NULL, -- '2026-01' format
  valor_meta NUMERIC NOT NULL DEFAULT 15000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, tipo, periodo)
);

-- Enable RLS
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own metas"
ON public.metas FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create own metas"
ON public.metas FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own metas"
ON public.metas FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own metas"
ON public.metas FOR DELETE
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_metas_updated_at
BEFORE UPDATE ON public.metas
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();