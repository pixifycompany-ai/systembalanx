-- 1) ORÇAMENTO POR CATEGORIA: valor mensal (vazio = sem orçamento). Vale para todo mês.
alter table public.categorias add column if not exists orcamento_mensal numeric(12,2);
alter table public.categorias drop constraint if exists categorias_orcamento_positivo;
alter table public.categorias add constraint categorias_orcamento_positivo
  check (orcamento_mensal is null or orcamento_mensal > 0);

-- 2) LEMBRETE NA HORA: guarda para qual horário o aviso já saiu (se o compromisso
--    for remarcado, o horário muda e o aviso sai de novo).
alter table public.agenda_itens add column if not exists lembrete_enviado_para timestamptz;

-- 3) DOCUMENTOS: contratos, comprovantes, notas… guardados pela IARA ou à mão,
--    com um resumo para achar depois. Arquivos no bucket privado "documentos",
--    caminho {tenant_id}/{id}.{ext}. Qualquer membro da empresa vê e guarda.
create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 200),
  resumo text check (resumo is null or char_length(resumo) <= 2000),
  path text not null,
  mime text,
  tamanho integer,
  cliente_id uuid references public.clientes(id) on delete set null,
  tags text[] not null default '{}',
  origem text not null default 'manual' check (origem in ('iara', 'manual')),
  created_at timestamptz not null default now()
);
create index if not exists documentos_tenant_idx on public.documentos (tenant_id, created_at desc);

drop trigger if exists trg_set_tenant on public.documentos;
create trigger trg_set_tenant before insert on public.documentos
  for each row execute function public.set_tenant_id();

alter table public.documentos enable row level security;
drop policy if exists documentos_membros on public.documentos;
create policy documentos_membros on public.documentos for all to authenticated
  using (public.tenant_role(tenant_id) is not null or public.is_platform_admin())
  with check (public.tenant_role(tenant_id) is not null or public.is_platform_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 15728640, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
  'text/csv', 'text/plain'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "documentos select" on storage.objects;
create policy "documentos select" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (
    (storage.foldername(name))[1] in (select tenant_id::text from public.tenant_members where user_id = auth.uid())
    or public.is_platform_admin()));
drop policy if exists "documentos insert" on storage.objects;
create policy "documentos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and
    (storage.foldername(name))[1] in (select tenant_id::text from public.tenant_members where user_id = auth.uid()));
drop policy if exists "documentos delete" on storage.objects;
create policy "documentos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and (
    (storage.foldername(name))[1] in (select tenant_id::text from public.tenant_members where user_id = auth.uid())
    or public.is_platform_admin()));

-- 4) AGENDAMENTO do lembrete na hora: a cada 5 minutos chama a função lembretes-agenda.
--    Copia a URL e o x-cron-secret do job de cobranças (não precisa colar o segredo).
do $$
declare cmd text;
begin
  select replace(command, 'cobranca-auto-disparar', 'lembretes-agenda') into cmd
    from cron.job where jobname = 'cobranca-auto-disparar';
  if cmd is null then raise exception 'Agendamento cobranca-auto-disparar não encontrado.'; end if;
  if exists (select 1 from cron.job where jobname = 'lembretes-agenda') then
    perform cron.unschedule('lembretes-agenda');
  end if;
  perform cron.schedule('lembretes-agenda', '*/5 * * * *', cmd);
end $$;
