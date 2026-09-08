-- Mover origem da marca (empresa_fonte) de clientes para categorias + lançamentos.
-- clientes.empresa_fonte fica preservado, mas para de ser usado nos agregadores.

ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS empresa_fonte public.empresa_fonte NULL;

ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS empresa_fonte public.empresa_fonte NULL;

ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS empresa_fonte public.empresa_fonte NULL;

COMMENT ON COLUMN public.categorias.empresa_fonte IS 'Marca padrão da categoria. NULL = Geral (sem marca).';
COMMENT ON COLUMN public.receitas.empresa_fonte IS 'Override manual de marca. Quando NULL, herda da categoria.';
COMMENT ON COLUMN public.despesas.empresa_fonte IS 'Override manual de marca. Quando NULL, herda da categoria.';