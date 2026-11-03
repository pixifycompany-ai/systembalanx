-- Até 10 notas fiscais por cobrança: lista [{path, nome}] em notas_fiscais.
-- nota_fiscal_path/nome continuam espelhando a 1ª nota (compatibilidade).
alter table public.cobrancas
  add column if not exists notas_fiscais jsonb not null default '[]'::jsonb;

update public.cobrancas
   set notas_fiscais = jsonb_build_array(jsonb_build_object(
         'path', nota_fiscal_path,
         'nome', coalesce(nota_fiscal_nome, 'nota-fiscal.pdf')))
 where nota_fiscal_path is not null
   and notas_fiscais = '[]'::jsonb;

alter table public.cobrancas drop constraint if exists cobrancas_notas_fiscais_max;
alter table public.cobrancas add constraint cobrancas_notas_fiscais_max
  check (jsonb_typeof(notas_fiscais) = 'array' and jsonb_array_length(notas_fiscais) <= 10);
