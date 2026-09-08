-- ============================================================================
-- MULTITENANT — ETAPA 3: trigger de tenant_id + troca da RLS (user_id -> tenant)
-- Roda DEPOIS do backfill. Papéis: owner/admin/financeiro escrevem; membro só lê.
-- Superadmin (platform_admin) enxerga/gerencia tudo.
-- A coluna user_id é MANTIDA (rollback e auditoria).
-- ============================================================================

-- Preenche tenant_id automaticamente no insert (conta ativa do perfil)
create or replace function public.set_tenant_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null then
    new.tenant_id := (select current_tenant_id from public.profiles where user_id = auth.uid());
  end if;
  return new;
end $$;

do $$
declare
  t text;
  tabelas text[] := array[
    'receitas','despesas','contas','contratos','clientes','categorias','metas',
    'transferencias','cartao_faturas','cartao_fatura_pagamentos','contrato_aditivos','contrato_parcelas'
  ];
  pol record;
begin
  -- 1) Trigger BEFORE INSERT em todas as tabelas de dados
  foreach t in array tabelas loop
    execute format('drop trigger if exists trg_set_tenant on public.%I;', t);
    execute format('create trigger trg_set_tenant before insert on public.%I for each row execute function public.set_tenant_id();', t);
  end loop;

  -- 2) Remove TODAS as policies antigas dessas tabelas
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename = any(tabelas)
  loop
    execute format('drop policy if exists %I on public.%I;', pol.policyname, pol.tablename);
  end loop;

  -- 3) Garante RLS ligada e cria as novas policies por tenant + papel
  foreach t in array tabelas loop
    execute format('alter table public.%I enable row level security;', t);

    -- SELECT: qualquer membro do tenant (ou superadmin)
    execute format($f$create policy %I on public.%I for select using (public.is_tenant_member(tenant_id));$f$, t || '_sel', t);

    -- INSERT: owner/admin/financeiro (ou superadmin); membro NÃO escreve
    execute format($f$create policy %I on public.%I for insert with check (
      tenant_id is not null and (public.tenant_role(tenant_id) in ('owner','admin','financeiro') or public.is_platform_admin())
    );$f$, t || '_ins', t);

    -- UPDATE
    execute format($f$create policy %I on public.%I for update
      using (public.tenant_role(tenant_id) in ('owner','admin','financeiro') or public.is_platform_admin())
      with check (public.tenant_role(tenant_id) in ('owner','admin','financeiro') or public.is_platform_admin());$f$, t || '_upd', t);

    -- DELETE
    execute format($f$create policy %I on public.%I for delete
      using (public.tenant_role(tenant_id) in ('owner','admin','financeiro') or public.is_platform_admin());$f$, t || '_del', t);
  end loop;
end $$;
