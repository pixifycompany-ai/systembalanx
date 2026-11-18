-- Memória curta da conversa por voz (Atalho do iPhone): cada fala e resposta.
-- A função iara-atalho manda à IARA os turnos dos últimos minutos, então dá para
-- continuar o assunto ("e da semana que vem?"). Só a função (service role) lê/escreve.
create table if not exists public.iara_atalho_turnos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null check (papel in ('user', 'assistant')),
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index if not exists iara_atalho_turnos_user_idx on public.iara_atalho_turnos (user_id, created_at desc);

alter table public.iara_atalho_turnos enable row level security;
revoke all on public.iara_atalho_turnos from anon, authenticated;
