-- Histórico dos envios de cobrança por WhatsApp (o número da própria empresa).
-- Cada tentativa (manual pelo app ou automática pelo disparo diário) grava uma linha,
-- com sucesso ou falha. Assim o detalhe da cobrança mostra quando o cliente foi lembrado.
-- Mesmo padrão de email_envios: a pessoa só LÊ as próprias linhas; quem grava são as
-- edge functions (whatsapp-enviar e cobranca-auto-disparar) com a service role.
create table if not exists public.whatsapp_envios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  cobranca_id uuid references public.cobrancas(id) on delete set null,
  telefone text not null,
  origem text not null default 'manual' check (origem in ('manual', 'auto')),
  status text not null default 'enviado' check (status in ('enviado', 'falhou')),
  erro text,
  documentos integer not null default 0, -- PDFs (notas fiscais) que foram junto
  created_at timestamptz not null default now()
);

alter table public.whatsapp_envios enable row level security;
revoke all on public.whatsapp_envios from anon, authenticated;
grant select on public.whatsapp_envios to authenticated;
drop policy if exists "whatsapp_envios le os proprios" on public.whatsapp_envios;
create policy "whatsapp_envios le os proprios" on public.whatsapp_envios
  for select using (user_id = auth.uid());

create index if not exists whatsapp_envios_user_idx on public.whatsapp_envios(user_id, created_at desc);
create index if not exists whatsapp_envios_cobranca_idx on public.whatsapp_envios(cobranca_id);
