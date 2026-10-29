-- ============================================================================
-- HARDENING DE SEGURANÇA (recomendações da auditoria superadmin)
--   1. Guarda do current_tenant_id no perfil (defesa em profundidade)
--   2. Tabela de auditoria (audit_log)
--   3. Base do MFA obrigatório p/ super admin (flag + aal2 em is_platform_admin)
-- Tudo compatível: com a flag desligada, is_platform_admin se comporta igual a hoje.
-- ============================================================================

-- ---------- 1) Guarda: perfil só aponta para tenant do qual o usuário é membro ----------
create or replace function public.guard_profile_tenant_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- só age quando current_tenant_id MUDA para um valor não nulo
  if new.current_tenant_id is not distinct from (case when tg_op = 'UPDATE' then old.current_tenant_id else null end) then
    return new;
  end if;
  if new.current_tenant_id is null then return new; end if;
  if auth.uid() is null then return new; end if;              -- service role / funções do servidor
  if public.is_platform_admin() then return new; end if;
  if exists (
    select 1 from public.tenant_members m
    where m.user_id = new.user_id and m.tenant_id = new.current_tenant_id
  ) then
    return new;
  end if;
  raise exception 'Perfil só pode apontar para um tenant do qual você é membro.' using errcode = '42501';
end; $$;

drop trigger if exists trg_guard_profile_tenant on public.profiles;
create trigger trg_guard_profile_tenant
  before insert or update of current_tenant_id on public.profiles
  for each row execute function public.guard_profile_tenant_change();

-- ---------- 2) Auditoria de ações sensíveis ----------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid,            -- quem fez (null = sistema/webhook)
  actor_email text,
  action text not null,          -- 'account.deleted', 'asaas.connected', 'plano.sync'...
  entity_type text,
  entity_id text,
  tenant_id uuid,
  ip text,
  metadata jsonb,
  result text                    -- 'ok' | 'forbidden' | 'error'
);
alter table public.audit_log enable row level security;
-- Só super admin LÊ. Escrita apenas por service role (sem policy de insert = negado ao cliente).
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select using (public.is_platform_admin());
create index if not exists idx_audit_log_created on public.audit_log(created_at desc);
create index if not exists idx_audit_log_actor on public.audit_log(actor_user_id);

-- ---------- 3) MFA obrigatório p/ super admin (flag + aal2) ----------
alter table public.plataforma_config
  add column if not exists require_mfa_admins boolean not null default false;

-- is_platform_admin passa a exigir aal2 (sessão com 2FA) QUANDO a flag estiver ligada.
-- Com a flag desligada (padrão), o comportamento é idêntico ao atual.
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
     and (
       not coalesce((select require_mfa_admins from public.plataforma_config limit 1), false)
       or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     );
$$;
