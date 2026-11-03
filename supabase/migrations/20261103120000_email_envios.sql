-- Rastreio dos e-mails de cobrança enviados pelo Resend.
-- Cada envio (manual ou automático) grava uma linha com o id do Resend; o webhook
-- do Resend (função resend-webhook) atualiza o status: entregue, atrasado,
-- devolvido (bounce), spam, falhou. Assim a falha aparece no app em Cobranças.
create table if not exists public.email_envios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  cobranca_id uuid references public.cobrancas(id) on delete set null,
  resend_id text unique,
  para text not null,
  assunto text,
  origem text not null default 'manual' check (origem in ('manual', 'auto')),
  status text not null default 'enviado'
    check (status in ('enviado', 'entregue', 'atrasado', 'devolvido', 'spam', 'falhou')),
  erro text,
  visto boolean not null default false, -- aviso de falha dispensado pela pessoa
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_envios enable row level security;
drop policy if exists "email_envios own" on public.email_envios;
-- Leitura e "dispensar aviso" pela própria pessoa; gravação vem das edge functions (service role).
create policy "email_envios own" on public.email_envios
  for select using (user_id = auth.uid());
drop policy if exists "email_envios own update" on public.email_envios;
create policy "email_envios own update" on public.email_envios
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists email_envios_user_idx on public.email_envios(user_id, created_at desc);
create index if not exists email_envios_cobranca_idx on public.email_envios(cobranca_id);
