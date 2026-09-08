
INSERT INTO public.categorias (nome, tipo, cor, is_padrao, user_id)
SELECT 'Juros/Multa', 'receita', '#F59E0B', true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorias WHERE nome = 'Juros/Multa' AND tipo = 'receita' AND is_padrao = true
);

INSERT INTO public.categorias (nome, tipo, cor, is_padrao, user_id)
SELECT 'Juros/Multa', 'despesa', '#F59E0B', true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorias WHERE nome = 'Juros/Multa' AND tipo = 'despesa' AND is_padrao = true
);

INSERT INTO public.categorias (nome, tipo, cor, is_padrao, user_id)
SELECT 'Tarifa Bancária', 'despesa', '#EF4444', true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorias WHERE nome = 'Tarifa Bancária' AND tipo = 'despesa' AND is_padrao = true
);
