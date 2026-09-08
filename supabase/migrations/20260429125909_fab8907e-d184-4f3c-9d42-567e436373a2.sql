-- 1. Add cartao_credito to conta_tipo enum
ALTER TYPE conta_tipo ADD VALUE IF NOT EXISTS 'cartao_credito';

-- 2. Add new columns to contas
ALTER TABLE public.contas
  ADD COLUMN IF NOT EXISTS limite numeric,
  ADD COLUMN IF NOT EXISTS dia_fechamento integer,
  ADD COLUMN IF NOT EXISTS dia_vencimento integer,
  ADD COLUMN IF NOT EXISTS bandeira text,
  ADD COLUMN IF NOT EXISTS conta_pagamento_padrao_id uuid;

-- 3. Create fatura status enum
DO $$ BEGIN
  CREATE TYPE cartao_fatura_status AS ENUM ('aberta','fechada','paga','parcialmente_paga');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Create cartao_faturas
CREATE TABLE IF NOT EXISTS public.cartao_faturas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  cartao_id uuid NOT NULL,
  competencia date NOT NULL,
  data_fechamento date NOT NULL,
  data_vencimento date NOT NULL,
  status cartao_fatura_status NOT NULL DEFAULT 'aberta',
  despesa_id uuid,
  valor_total numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cartao_id, competencia)
);

ALTER TABLE public.cartao_faturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own faturas" ON public.cartao_faturas
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create own faturas" ON public.cartao_faturas
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own faturas" ON public.cartao_faturas
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own faturas" ON public.cartao_faturas
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER faturas_updated_at
  BEFORE UPDATE ON public.cartao_faturas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Create cartao_fatura_pagamentos
CREATE TABLE IF NOT EXISTS public.cartao_fatura_pagamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  fatura_id uuid NOT NULL REFERENCES public.cartao_faturas(id) ON DELETE CASCADE,
  conta_id uuid NOT NULL,
  valor numeric NOT NULL,
  data_pagamento date NOT NULL,
  despesa_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cartao_fatura_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fatura pagamentos" ON public.cartao_fatura_pagamentos
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create own fatura pagamentos" ON public.cartao_fatura_pagamentos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own fatura pagamentos" ON public.cartao_fatura_pagamentos
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own fatura pagamentos" ON public.cartao_fatura_pagamentos
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 6. Add fatura_id to despesas
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS fatura_id uuid;

CREATE INDEX IF NOT EXISTS idx_despesas_fatura_id ON public.despesas(fatura_id);
CREATE INDEX IF NOT EXISTS idx_faturas_cartao ON public.cartao_faturas(cartao_id);
CREATE INDEX IF NOT EXISTS idx_fatura_pagamentos_fatura ON public.cartao_fatura_pagamentos(fatura_id);