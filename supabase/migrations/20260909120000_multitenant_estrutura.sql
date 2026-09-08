-- ============================================================================
-- MULTITENANT — ETAPA 1: estrutura (NÃO altera a RLS existente, não quebra nada)
-- Cria tenants / tenant_members / tenant_invites / platform_admins,
-- adiciona tenant_id (nullable) nas tabelas de dados e funções auxiliares.
-- A troca da RLS (user_id -> tenant) vem na Etapa 3, depois do backfill.
-- ============================================================================

-- ---------- TENANTS ----------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'agencia' check (tipo in ('pessoal','agencia')),
  plano text not null default 'free',
  status_assinatura text not null default 'trial'
    check (status_assinatura in ('trial','ativa','inadimplente','cancelada','cortesia')),
  cortesia boolean not null default false,            -- superadmin liberou de graça
  acesso_liberado_ate date,                            -- null = sem limite (cortesia/plano manual)
  trial_ends_at timestamptz,
  asaas_customer_id text,
  asaas_subscription_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- MEMBROS (papéis) ----------
create table if not exists public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('owner','admin','financeiro','membro')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index if not exists idx_tenant_members_user on public.tenant_members(user_id);
create index if not exists idx_tenant_members_tenant on public.tenant_members(tenant_id);

-- ---------- CONVITES ----------
create table if not exists public.tenant_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  papel text not null default 'membro' check (papel in ('admin','financeiro','membro')),
  token uuid not null default gen_random_uuid(),
  status text not null default 'pendente' check (status in ('pendente','aceito','expirado','cancelado')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);
create index if not exists idx_tenant_invites_tenant on public.tenant_invites(tenant_id);
create index if not exists idx_tenant_invites_email on public.tenant_invites(lower(email));

-- ---------- SUPERADMINS DA PLATAFORMA ----------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- profiles: conta ativa ----------
alter table public.profiles add column if not exists current_tenant_id uuid references public.tenants(id) on delete set null;

-- ---------- tenant_id (nullable) nas tabelas de dados ----------
do $$
declare t text;
begin
  foreach t in array array[
    'receitas','despesas','contas','contratos','clientes','categorias','metas',
    'transferencias','cartao_faturas','cartao_fatura_pagamentos','contrato_aditivos','contrato_parcelas'
  ] loop
    execute format('alter table public.%I add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;', t);
    execute format('create index if not exists idx_%s_tenant on public.%I(tenant_id);', t, t);
  end loop;
end $$;

-- ============================================================================
-- FUNÇÕES AUXILIARES (SECURITY DEFINER — evitam recursão de RLS)
-- ============================================================================
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.user_tenant_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.tenant_members where user_id = auth.uid();
$$;

create or replace function public.is_tenant_member(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tenant_members where user_id = auth.uid() and tenant_id = tid)
      or public.is_platform_admin();
$$;

create or replace function public.tenant_role(tid uuid)
returns text language sql stable security definer set search_path = public as $$
  select papel from public.tenant_members where user_id = auth.uid() and tenant_id = tid limit 1;
$$;

-- Cria um tenant e já coloca quem chamou como owner (usado no onboarding; evita chicken-egg de RLS)
create or replace function public.create_tenant_with_owner(p_nome text, p_tipo text default 'agencia')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  insert into public.tenants (nome, tipo, created_by, trial_ends_at, status_assinatura)
  values (coalesce(nullif(trim(p_nome), ''), 'Minha conta'),
          case when p_tipo in ('pessoal','agencia') then p_tipo else 'agencia' end,
          auth.uid(), now() + interval '14 days', 'trial')
  returning id into v_id;
  insert into public.tenant_members (tenant_id, user_id, papel) values (v_id, auth.uid(), 'owner');
  update public.profiles set current_tenant_id = v_id where user_id = auth.uid();
  return v_id;
end $$;

-- ============================================================================
-- RLS das tabelas novas
-- ============================================================================
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_invites enable row level security;
alter table public.platform_admins enable row level security;

-- tenants
create policy tenants_select on public.tenants for select
  using (public.is_tenant_member(id));
create policy tenants_insert on public.tenants for insert
  with check (created_by = auth.uid() or public.is_platform_admin());
create policy tenants_update on public.tenants for update
  using (public.tenant_role(id) in ('owner','admin') or public.is_platform_admin());
create policy tenants_delete on public.tenants for delete
  using (public.is_platform_admin());

-- tenant_members
create policy tmembers_select on public.tenant_members for select
  using (public.is_tenant_member(tenant_id));
create policy tmembers_insert on public.tenant_members for insert
  with check (public.tenant_role(tenant_id) in ('owner','admin') or public.is_platform_admin());
create policy tmembers_update on public.tenant_members for update
  using (public.tenant_role(tenant_id) in ('owner','admin') or public.is_platform_admin());
create policy tmembers_delete on public.tenant_members for delete
  using (public.tenant_role(tenant_id) in ('owner','admin') or public.is_platform_admin());

-- tenant_invites
create policy tinvites_all on public.tenant_invites for all
  using (public.tenant_role(tenant_id) in ('owner','admin') or public.is_platform_admin())
  with check (public.tenant_role(tenant_id) in ('owner','admin') or public.is_platform_admin());

-- platform_admins: só superadmin enxerga; escrita apenas via SQL/service role (sem policy = negado)
create policy padmins_select on public.platform_admins for select
  using (public.is_platform_admin());
