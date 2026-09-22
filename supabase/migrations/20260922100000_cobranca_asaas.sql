-- Cobrança recorrente/avulsa via Asaas (conta do próprio tenant) — Fase 1: schema
-- Modelo: dados escopados por user_id (igual clientes/receitas).

-- 1) Vínculo do cliente com o Asaas (customer id na conta Asaas do usuário)
alter table public.clientes add column if not exists asaas_customer_id text;

-- 2) Config de cobrança Asaas por usuário (chave própria + ambiente)
create table if not exists public.cobranca_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  asaas_api_key text,
  asaas_env text not null default 'production',       -- 'production' | 'sandbox'
  asaas_account_name text,                            -- nome da conta (retorno do /myAccount)
  webhook_token text,                                 -- token pra validar o webhook
  updated_at timestamptz not null default now()
);
alter table public.cobranca_config enable row level security;
drop policy if exists "cobranca_config own" on public.cobranca_config;
create policy "cobranca_config own" on public.cobranca_config
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3) Cobranças (recorrentes e avulsas)
create table if not exists public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  contrato_id uuid references public.contratos(id) on delete set null,
  receita_id uuid references public.receitas(id) on delete set null,
  tipo text not null default 'avulsa',                -- 'avulsa' | 'recorrente'
  asaas_payment_id text,                              -- cobrança individual no Asaas
  asaas_subscription_id text,                         -- assinatura (recorrente) no Asaas
  descricao text,
  valor numeric not null,
  vencimento date not null,
  forma_pagamento text not null default 'UNDEFINED', -- PIX | BOLETO | CREDIT_CARD | UNDEFINED
  status text not null default 'pendente',           -- pendente | pago | vencido | estornado | cancelado
  invoice_url text,                                   -- link de pagamento
  data_pagamento date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cobrancas enable row level security;
drop policy if exists "cobrancas own" on public.cobrancas;
create policy "cobrancas own" on public.cobrancas
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists cobrancas_user_idx on public.cobrancas(user_id);
create index if not exists cobrancas_cliente_idx on public.cobrancas(cliente_id);
create index if not exists cobrancas_payment_idx on public.cobrancas(asaas_payment_id);
create index if not exists cobrancas_sub_idx on public.cobrancas(asaas_subscription_id);
