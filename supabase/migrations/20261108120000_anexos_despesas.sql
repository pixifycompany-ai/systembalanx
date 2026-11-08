-- Anexos (boletos, notas…) nas despesas a pagar. Arquivos no bucket privado
-- "anexos-despesas", caminho {tenant_id}/{despesa_id}/{arquivo}.
-- Ao virar "pago" (por qualquer caminho: tela, lote, conciliação, fatura…) a lista
-- é esvaziada e os caminhos vão para anexos_lixeira; o app apaga os arquivos do
-- Storage depois (o banco não pode apagar arquivo do Storage direto).
alter table public.despesas
  add column if not exists anexos jsonb not null default '[]'::jsonb;
alter table public.despesas drop constraint if exists despesas_anexos_max;
alter table public.despesas add constraint despesas_anexos_max
  check (jsonb_typeof(anexos) = 'array' and jsonb_array_length(anexos) <= 5);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos-despesas', 'anexos-despesas', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Leitura: qualquer membro do tenant. Escrita: owner/admin/financeiro (igual às despesas).
drop policy if exists "anexos despesas select" on storage.objects;
create policy "anexos despesas select" on storage.objects for select to authenticated
  using (bucket_id = 'anexos-despesas' and (
    (storage.foldername(name))[1] in (select tenant_id::text from public.tenant_members where user_id = auth.uid())
    or public.is_platform_admin()));

drop policy if exists "anexos despesas insert" on storage.objects;
create policy "anexos despesas insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos-despesas' and (
    (storage.foldername(name))[1] in (select tenant_id::text from public.tenant_members
                                       where user_id = auth.uid() and papel in ('owner', 'admin', 'financeiro'))
    or public.is_platform_admin()));

drop policy if exists "anexos despesas update" on storage.objects;
create policy "anexos despesas update" on storage.objects for update to authenticated
  using (bucket_id = 'anexos-despesas' and (
    (storage.foldername(name))[1] in (select tenant_id::text from public.tenant_members
                                       where user_id = auth.uid() and papel in ('owner', 'admin', 'financeiro'))
    or public.is_platform_admin()));

drop policy if exists "anexos despesas delete" on storage.objects;
create policy "anexos despesas delete" on storage.objects for delete to authenticated
  using (bucket_id = 'anexos-despesas' and (
    (storage.foldername(name))[1] in (select tenant_id::text from public.tenant_members
                                       where user_id = auth.uid() and papel in ('owner', 'admin', 'financeiro'))
    or public.is_platform_admin()));

-- Arquivos a apagar do Storage (despesa paga ou excluída).
create table if not exists public.anexos_lixeira (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);
alter table public.anexos_lixeira enable row level security;
drop policy if exists anexos_lixeira_sel on public.anexos_lixeira;
create policy anexos_lixeira_sel on public.anexos_lixeira for select
  using (public.tenant_role(tenant_id) in ('owner', 'admin', 'financeiro') or public.is_platform_admin());
drop policy if exists anexos_lixeira_del on public.anexos_lixeira;
create policy anexos_lixeira_del on public.anexos_lixeira for delete
  using (public.tenant_role(tenant_id) in ('owner', 'admin', 'financeiro') or public.is_platform_admin());
create index if not exists idx_anexos_lixeira_tenant on public.anexos_lixeira(tenant_id);

create or replace function public.despesas_anexos_para_lixeira()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.tenant_id is not null and jsonb_array_length(coalesce(old.anexos, '[]'::jsonb)) > 0 then
      insert into public.anexos_lixeira (tenant_id, path)
      select old.tenant_id, a->>'path' from jsonb_array_elements(old.anexos) a where a->>'path' is not null;
    end if;
    return old;
  end if;

  if new.status = 'pago' and old.status is distinct from 'pago'
     and new.tenant_id is not null
     and jsonb_array_length(coalesce(new.anexos, '[]'::jsonb)) > 0 then
    insert into public.anexos_lixeira (tenant_id, path)
    select new.tenant_id, a->>'path' from jsonb_array_elements(new.anexos) a where a->>'path' is not null;
    new.anexos := '[]'::jsonb;
  end if;
  return new;
end $$;

drop trigger if exists trg_despesas_anexos_pago on public.despesas;
create trigger trg_despesas_anexos_pago before update of status on public.despesas
  for each row execute function public.despesas_anexos_para_lixeira();
drop trigger if exists trg_despesas_anexos_del on public.despesas;
create trigger trg_despesas_anexos_del after delete on public.despesas
  for each row execute function public.despesas_anexos_para_lixeira();
