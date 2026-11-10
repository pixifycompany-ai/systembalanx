-- Tela de Pendências: itens marcados como "Não é problema" não voltam a aparecer.
-- Vale para a equipe toda (por empresa). chave = "<tipo>:<id(s)>".
create table if not exists public.pendencias_ignoradas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chave text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (tenant_id, chave)
);
alter table public.pendencias_ignoradas enable row level security;

drop policy if exists pendencias_ignoradas_sel on public.pendencias_ignoradas;
create policy pendencias_ignoradas_sel on public.pendencias_ignoradas for select
  using (public.is_tenant_member(tenant_id));
drop policy if exists pendencias_ignoradas_ins on public.pendencias_ignoradas;
create policy pendencias_ignoradas_ins on public.pendencias_ignoradas for insert
  with check (public.tenant_role(tenant_id) in ('owner', 'admin', 'financeiro') or public.is_platform_admin());
drop policy if exists pendencias_ignoradas_del on public.pendencias_ignoradas;
create policy pendencias_ignoradas_del on public.pendencias_ignoradas for delete
  using (public.tenant_role(tenant_id) in ('owner', 'admin', 'financeiro') or public.is_platform_admin());

drop trigger if exists trg_set_tenant on public.pendencias_ignoradas;
create trigger trg_set_tenant before insert on public.pendencias_ignoradas
  for each row execute function public.set_tenant_id();
