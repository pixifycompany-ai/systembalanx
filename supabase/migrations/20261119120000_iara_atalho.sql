-- IARA pelo Atalho do iPhone (Tocar atrás → falar → IARA responde em voz).
--
-- iara_chaves: uma chave pessoal por usuário, guardada só como hash (SHA-256).
--   Só o servidor (service role) lê; o app mexe nela pela função iara-atalho.
-- iara_pendentes: ações que a IARA preparou pelo atalho e que a pessoa ainda
--   precisa confirmar no app (cards de cobrança, tarefa, lançamento…).

create table if not exists public.iara_chaves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hash text not null unique,
  prefixo text not null,
  created_at timestamptz not null default now(),
  ultimo_uso timestamptz
);
alter table public.iara_chaves enable row level security;
revoke all on public.iara_chaves from anon, authenticated;

create table if not exists public.iara_pendentes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pergunta text not null,
  resposta text not null,
  acoes jsonb,
  lancamentos jsonb,
  created_at timestamptz not null default now(),
  visto_em timestamptz
);
create index if not exists iara_pendentes_user_idx on public.iara_pendentes (user_id, created_at desc);
alter table public.iara_pendentes enable row level security;
drop policy if exists iara_pendentes_sel on public.iara_pendentes;
drop policy if exists iara_pendentes_upd on public.iara_pendentes;
drop policy if exists iara_pendentes_del on public.iara_pendentes;
create policy iara_pendentes_sel on public.iara_pendentes for select to authenticated using (user_id = auth.uid());
create policy iara_pendentes_upd on public.iara_pendentes for update to authenticated using (user_id = auth.uid());
create policy iara_pendentes_del on public.iara_pendentes for delete to authenticated using (user_id = auth.uid());
revoke all on public.iara_pendentes from anon, authenticated;
grant select, delete on public.iara_pendentes to authenticated;
grant update (visto_em) on public.iara_pendentes to authenticated;
