-- Empresas extras de uma mesma conta não ganham teste grátis próprio.
-- A 1ª empresa que a pessoa cria é a "principal" (14 dias de teste, assinatura própria).
-- As seguintes nascem ligadas a ela (conta_principal_id) e seguem o acesso dela:
-- se a principal está em teste, o mesmo prazo; se está ativa ou em cortesia, ficam liberadas.
--
-- Também fecha uma brecha: o INSERT direto na tabela (fora do cadastro) deixava a
-- pessoa escolher status/cortesia/plano. Agora os campos de cobrança são definidos aqui.

alter table public.tenants add column if not exists conta_principal_id uuid references public.tenants(id) on delete set null;

create or replace function public.tenants_novo_billing()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_principal public.tenants%rowtype;
begin
  -- Webhooks/edge (service_role) e superadmin definem o que quiserem.
  if (auth.role() = 'service_role') or public.is_platform_admin() then
    return new;
  end if;

  new.created_by := auth.uid();
  new.asaas_customer_id := null;
  new.asaas_subscription_id := null;

  select * into v_principal from public.tenants t
   where t.created_by = auth.uid() and t.conta_principal_id is null
   order by t.created_at asc
   limit 1;

  if v_principal.id is null then
    -- Primeira empresa da conta: teste de 14 dias.
    new.conta_principal_id := null;
    new.status_assinatura := 'trial';
    new.trial_ends_at := now() + interval '14 days';
    new.cortesia := false;
    new.acesso_liberado_ate := null;
    new.plano := null;
    new.ciclo := null;
  else
    -- Empresa extra: cópia do estado da principal (o acesso de verdade é lido da principal).
    new.conta_principal_id := v_principal.id;
    new.status_assinatura := v_principal.status_assinatura;
    new.trial_ends_at := v_principal.trial_ends_at;
    new.cortesia := v_principal.cortesia;
    new.acesso_liberado_ate := v_principal.acesso_liberado_ate;
    new.plano := v_principal.plano;
    new.ciclo := v_principal.ciclo;
  end if;
  return new;
end $$;

drop trigger if exists trg_tenants_novo_billing on public.tenants;
create trigger trg_tenants_novo_billing before insert on public.tenants
  for each row execute function public.tenants_novo_billing();

-- O vínculo com a principal também é campo de cobrança: usuário comum não muda.
create or replace function public.tenants_protege_billing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- service_role (webhooks/edge) e superadmin podem tudo.
  if (auth.role() = 'service_role') or public.is_platform_admin() then
    return new;
  end if;

  -- Usuário comum: colunas de cobrança/assinatura são imutáveis.
  if  new.status_assinatura   is distinct from old.status_assinatura
   or new.cortesia            is distinct from old.cortesia
   or new.acesso_liberado_ate is distinct from old.acesso_liberado_ate
   or new.plano               is distinct from old.plano
   or new.trial_ends_at       is distinct from old.trial_ends_at
   or new.asaas_customer_id   is distinct from old.asaas_customer_id
   or new.asaas_subscription_id is distinct from old.asaas_subscription_id
   or new.conta_principal_id  is distinct from old.conta_principal_id
  then
    raise exception 'Alteração de cobrança/assinatura não permitida (somente plataforma).'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
