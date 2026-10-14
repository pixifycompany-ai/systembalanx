-- Identidade do cliente no Asaas para cobranças que vieram sem vínculo no BALANX
-- (ex.: assinaturas de outra plataforma no mesmo Asaas). Permite ver DE QUEM é a
-- cobrança e vinculá-la / identificar duplicatas.
alter table public.cobrancas
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_customer_nome text;
