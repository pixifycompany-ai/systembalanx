-- Regra de envio automático POR COBRANÇA (avulsa/parcelada), além da do contrato
-- e da padrão (Meu Perfil). Prioridade no disparo: cobrança > contrato > padrão.
--   auto_modo: null/'padrao' = herda (contrato, se houver; senão a padrão)
--              'off' = nunca dispara automático · 'custom' = usa os campos abaixo
-- grupo_id: junta as parcelas criadas juntas (para mudar a regra de todas de uma vez).

alter table public.cobrancas
  add column if not exists auto_modo text check (auto_modo in ('padrao', 'off', 'custom')),
  add column if not exists auto_antes_dias integer,
  add column if not exists auto_no_dia boolean,
  add column if not exists auto_atraso_diario boolean,
  add column if not exists grupo_id uuid;

create index if not exists cobrancas_grupo_idx on public.cobrancas (grupo_id) where grupo_id is not null;

-- Parcelas avulsas já existentes ("Descrição (1/4)" … "(4/4)" do mesmo cliente,
-- criadas no mesmo dia) ganham um grupo.
with p as (
  select id, user_id, cliente_id,
         btrim(regexp_replace(descricao, '\s*\(\s*\d+\s*/\s*\d+\s*\)\s*$', '')) as base,
         substring(descricao from '\(\s*\d+\s*/\s*(\d+)\s*\)\s*$') as n,
         created_at::date as dia
  from public.cobrancas
  where tipo = 'avulsa' and grupo_id is null and cliente_id is not null
    and descricao ~ '\(\s*\d+\s*/\s*\d+\s*\)\s*$'
), g as (
  select user_id, cliente_id, base, n, dia, gen_random_uuid() as gid
  from p group by user_id, cliente_id, base, n, dia having count(*) > 1
)
update public.cobrancas c set grupo_id = g.gid
from p join g using (user_id, cliente_id, base, n, dia)
where c.id = p.id;
