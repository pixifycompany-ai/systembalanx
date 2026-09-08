-- Enum para tipo de conta
create type public.conta_tipo as enum ('corrente', 'poupanca', 'investimento');

-- Tabela de contas bancárias
create table public.contas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text not null,
  banco text,
  tipo conta_tipo not null default 'corrente',
  saldo_inicial numeric not null default 0,
  cor text not null default '#3B82F6',
  ativa boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- RLS para contas
alter table public.contas enable row level security;

create policy "Users can view own accounts" on public.contas
  for select to authenticated using (user_id = auth.uid());

create policy "Users can create own accounts" on public.contas
  for insert to authenticated with check (user_id = auth.uid());

create policy "Users can update own accounts" on public.contas
  for update to authenticated using (user_id = auth.uid());

create policy "Users can delete own accounts" on public.contas
  for delete to authenticated using (user_id = auth.uid());

-- Trigger para updated_at em contas
create trigger handle_contas_updated_at
  before update on public.contas
  for each row execute function public.handle_updated_at();

-- Tabela de transferências entre contas
create table public.transferencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  conta_origem_id uuid not null references public.contas(id) on delete cascade,
  conta_destino_id uuid not null references public.contas(id) on delete cascade,
  valor numeric not null,
  descricao text,
  data_transferencia date not null,
  created_at timestamp with time zone not null default now(),
  constraint transferencia_contas_diferentes check (conta_origem_id != conta_destino_id),
  constraint transferencia_valor_positivo check (valor > 0)
);

-- RLS para transferências
alter table public.transferencias enable row level security;

create policy "Users can view own transfers" on public.transferencias
  for select to authenticated using (user_id = auth.uid());

create policy "Users can create own transfers" on public.transferencias
  for insert to authenticated with check (user_id = auth.uid());

create policy "Users can update own transfers" on public.transferencias
  for update to authenticated using (user_id = auth.uid());

create policy "Users can delete own transfers" on public.transferencias
  for delete to authenticated using (user_id = auth.uid());

-- Adicionar conta_id às tabelas existentes
alter table public.receitas 
  add column if not exists conta_id uuid references public.contas(id);

alter table public.despesas 
  add column if not exists conta_id uuid references public.contas(id);