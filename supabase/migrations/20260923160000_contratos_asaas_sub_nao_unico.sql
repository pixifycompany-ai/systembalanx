-- Agrupamento: vários contratos do mesmo cliente podem compartilhar a MESMA
-- assinatura Asaas (um boleto). O índice ÚNICO antigo impedia isso — troca por
-- um índice comum (só para busca).
drop index if exists public.idx_contratos_asaas_sub_user;
create index if not exists idx_contratos_asaas_sub on public.contratos (asaas_subscription_id) where asaas_subscription_id is not null;
