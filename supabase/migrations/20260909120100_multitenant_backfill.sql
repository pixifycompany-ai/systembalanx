-- ============================================================================
-- MULTITENANT — ETAPA 2: backfill dos dados já existentes para o tenant "Pixify"
-- Cria o tenant Pixify (Agência, cortesia/liberado), define o usuário atual como
-- owner + superadmin e carimba tenant_id em todos os registros existentes.
-- Idempotente.
-- ============================================================================
do $$
declare
  v_user uuid;
  v_tenant uuid;
begin
  -- Dono dos dados migrados (o único usuário existente hoje)
  select user_id into v_user from public.profiles order by created_at asc limit 1;
  if v_user is null then
    select user_id into v_user from public.receitas where user_id is not null limit 1;
  end if;
  if v_user is null then
    raise notice 'Nenhum usuário encontrado — nada a fazer.';
    return;
  end if;

  -- Tenant Pixify (Agência), liberado por cortesia do superadmin
  select id into v_tenant from public.tenants where nome = 'Pixify' limit 1;
  if v_tenant is null then
    insert into public.tenants (nome, tipo, plano, status_assinatura, cortesia, created_by)
    values ('Pixify', 'agencia', 'business', 'cortesia', true, v_user)
    returning id into v_tenant;
  end if;

  -- Owner
  insert into public.tenant_members (tenant_id, user_id, papel)
  values (v_tenant, v_user, 'owner')
  on conflict (tenant_id, user_id) do update set papel = 'owner';

  -- Superadmin da plataforma
  insert into public.platform_admins (user_id) values (v_user) on conflict do nothing;

  -- Conta ativa no profile
  update public.profiles set current_tenant_id = v_tenant where user_id = v_user;

  -- Carimba tenant_id (tabelas com user_id)
  update public.receitas                set tenant_id = v_tenant where user_id = v_user and tenant_id is null;
  update public.despesas                set tenant_id = v_tenant where user_id = v_user and tenant_id is null;
  update public.contas                  set tenant_id = v_tenant where user_id = v_user and tenant_id is null;
  update public.contratos               set tenant_id = v_tenant where user_id = v_user and tenant_id is null;
  update public.clientes                set tenant_id = v_tenant where user_id = v_user and tenant_id is null;
  update public.categorias              set tenant_id = v_tenant where user_id = v_user and tenant_id is null;
  update public.metas                   set tenant_id = v_tenant where user_id = v_user and tenant_id is null;
  update public.transferencias          set tenant_id = v_tenant where user_id = v_user and tenant_id is null;
  update public.cartao_faturas          set tenant_id = v_tenant where user_id = v_user and tenant_id is null;
  update public.cartao_fatura_pagamentos set tenant_id = v_tenant where user_id = v_user and tenant_id is null;
  update public.contrato_aditivos       set tenant_id = v_tenant where user_id = v_user and tenant_id is null;

  -- contrato_parcelas não tem user_id — herda do contrato
  update public.contrato_parcelas cp
    set tenant_id = c.tenant_id
    from public.contratos c
    where cp.contrato_id = c.id and cp.tenant_id is null and c.tenant_id is not null;

  raise notice 'Backfill concluído para tenant % (usuário %).', v_tenant, v_user;
end $$;
