-- SEGURANÇA: impede um usuário (mesmo o owner) de alterar as colunas de
-- cobrança/assinatura do próprio tenant via update direto — o que permitiria
-- liberar o acesso de graça (bypass de pagamento).
-- Só o service_role (webhooks/edge functions do Asaas) e o superadmin
-- (platform_admin) podem mexer nessas colunas.

create or replace function public.tenants_protege_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  then
    raise exception 'Alteração de cobrança/assinatura não permitida (somente plataforma).'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tenants_protege_billing on public.tenants;
create trigger trg_tenants_protege_billing
  before update on public.tenants
  for each row execute function public.tenants_protege_billing();
