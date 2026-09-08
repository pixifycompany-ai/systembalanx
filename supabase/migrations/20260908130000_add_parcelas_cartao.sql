-- Parcelamento de compras no cartão de crédito
-- Cada parcela é uma linha em `despesas`, vinculada à fatura do seu mês.
-- As parcelas de uma mesma compra são agrupadas por `parcela_grupo_id`.

ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS parcela_num integer,
  ADD COLUMN IF NOT EXISTS parcela_total integer,
  ADD COLUMN IF NOT EXISTS parcela_grupo_id uuid;

CREATE INDEX IF NOT EXISTS idx_despesas_parcela_grupo
  ON public.despesas (parcela_grupo_id);

COMMENT ON COLUMN public.despesas.parcela_num IS 'Número da parcela (1..N) numa compra parcelada de cartão';
COMMENT ON COLUMN public.despesas.parcela_total IS 'Total de parcelas (N) da compra';
COMMENT ON COLUMN public.despesas.parcela_grupo_id IS 'Agrupa todas as parcelas de uma mesma compra';
