
ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS origem_receita_id UUID REFERENCES public.receitas(id) ON DELETE SET NULL;
ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS origem_despesa_id UUID REFERENCES public.despesas(id) ON DELETE SET NULL;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS origem_receita_id UUID REFERENCES public.receitas(id) ON DELETE SET NULL;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS origem_despesa_id UUID REFERENCES public.despesas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_receitas_origem_receita ON public.receitas(origem_receita_id);
CREATE INDEX IF NOT EXISTS idx_receitas_origem_despesa ON public.receitas(origem_despesa_id);
CREATE INDEX IF NOT EXISTS idx_despesas_origem_receita ON public.despesas(origem_receita_id);
CREATE INDEX IF NOT EXISTS idx_despesas_origem_despesa ON public.despesas(origem_despesa_id);
