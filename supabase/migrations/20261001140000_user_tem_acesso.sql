-- Fonte da verdade do ACESSO (server-side), espelhando a regra do TenantContext.
-- Usada pelas edge functions pra barrar ações premium quando a assinatura está
-- inativa — em vez de confiar só no gate do navegador.
-- Fail-open: usuário sem tenant nenhum NÃO é bloqueado (evita travar por dado inconsistente).
create or replace function public.user_tem_acesso(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.tenant_members m
      join public.tenants t on t.id = m.tenant_id
      where m.user_id = uid
        and (
          t.cortesia
          or t.status_assinatura = 'ativa'
          or (t.acesso_liberado_ate is not null and t.acesso_liberado_ate >= current_date)
          or (t.status_assinatura = 'trial' and (t.trial_ends_at is null or t.trial_ends_at > now()))
        )
    )
    or not exists (select 1 from public.tenant_members where user_id = uid);
$$;
