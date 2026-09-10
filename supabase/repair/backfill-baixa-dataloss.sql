-- ============================================================================
-- REPARO — perda de dados no "dar baixa" (categoria/conta/cliente/contrato zerados)
-- Rodar no SQL Editor do Supabase (projeto hvwuuxvsoyovkvedifco).
--
-- Causa (já corrigida no código): updateReceita/updateDespesa do useFluxoCaixa
-- faziam UPDATE completo, então "dar baixa" (que só manda status+data) gravava
-- categoria_id/conta_id/cliente_id/contrato_id = NULL.
--
-- Estratégia de recuperação: copiar os campos dos "irmãos" da mesma recorrência
-- (recurrence_group_id) que ainda têm o dado. Só preenche NULLs, nunca sobrescreve.
-- Lançamentos avulsos (sem recorrência) que foram zerados NÃO têm de onde
-- recuperar — precisarão de reajuste manual.
--
-- SEGURO: rode primeiro os SELECTs de diagnóstico. Os UPDATEs estão numa
-- transação — confira o resultado e faça COMMIT (ou ROLLBACK para desfazer).
-- ============================================================================

-- 1) DIAGNÓSTICO — quantos registros estão sem categoria/conta e podem ser recuperados
select 'receitas sem categoria' as met, count(*) from receitas where categoria_id is null
union all select 'receitas sem conta', count(*) from receitas where conta_id is null
union all select 'despesas sem categoria', count(*) from despesas where categoria_id is null
union all select 'despesas sem conta', count(*) from despesas where conta_id is null;

-- ============================================================================
begin;

-- 2) RECEITAS — backfill a partir dos irmãos da recorrência (só NULLs)
with fonte as (
  select
    recurrence_group_id,
    (array_agg(categoria_id) filter (where categoria_id is not null))[1] as categoria_id,
    (array_agg(conta_id)     filter (where conta_id is not null))[1]     as conta_id,
    (array_agg(cliente_id)   filter (where cliente_id is not null))[1]   as cliente_id,
    (array_agg(contrato_id)  filter (where contrato_id is not null))[1]  as contrato_id
  from receitas
  where recurrence_group_id is not null
  group by recurrence_group_id
)
update receitas r
set
  categoria_id = coalesce(r.categoria_id, f.categoria_id),
  conta_id     = coalesce(r.conta_id,     f.conta_id),
  cliente_id   = coalesce(r.cliente_id,   f.cliente_id),
  contrato_id  = coalesce(r.contrato_id,  f.contrato_id)
from fonte f
where r.recurrence_group_id = f.recurrence_group_id
  and (r.categoria_id is null or r.conta_id is null or r.cliente_id is null or r.contrato_id is null);

-- 3) RECEITAS — recupera cliente a partir do contrato (quando o contrato_id foi restaurado)
update receitas r
set cliente_id = c.cliente_id
from contratos c
where r.contrato_id = c.id
  and r.cliente_id is null
  and c.cliente_id is not null;

-- 4) DESPESAS — backfill a partir dos irmãos da recorrência (só NULLs/vazios)
with fonte as (
  select
    recurrence_group_id,
    (array_agg(categoria_id) filter (where categoria_id is not null))[1] as categoria_id,
    (array_agg(conta_id)     filter (where conta_id is not null))[1]     as conta_id,
    (array_agg(cliente_id)   filter (where cliente_id is not null))[1]   as cliente_id,
    (array_agg(fornecedor)   filter (where fornecedor is not null and fornecedor <> ''))[1] as fornecedor
  from despesas
  where recurrence_group_id is not null
  group by recurrence_group_id
)
update despesas d
set
  categoria_id = coalesce(d.categoria_id, f.categoria_id),
  conta_id     = coalesce(d.conta_id,     f.conta_id),
  cliente_id   = coalesce(d.cliente_id,   f.cliente_id),
  fornecedor   = coalesce(nullif(d.fornecedor, ''), f.fornecedor)
from fonte f
where d.recurrence_group_id = f.recurrence_group_id
  and (d.categoria_id is null or d.conta_id is null or d.cliente_id is null or coalesce(d.fornecedor, '') = '');

-- 5) CONFERÊNCIA pós-reparo (rode antes de decidir commit/rollback)
select 'receitas sem categoria (depois)' as met, count(*) from receitas where categoria_id is null
union all select 'receitas sem conta (depois)', count(*) from receitas where conta_id is null
union all select 'despesas sem categoria (depois)', count(*) from despesas where categoria_id is null
union all select 'despesas sem conta (depois)', count(*) from despesas where conta_id is null;

-- Se os números caíram e está tudo certo:
commit;
-- Se algo pareceu errado, troque o commit acima por:
-- rollback;
