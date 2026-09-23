-- ============================================================================
-- Envio automático por WhatsApp + Nota Fiscal (PDF) nas cobranças
-- ============================================================================

-- Regras GLOBAIS de auto-envio (por tenant)
alter table public.cobranca_config
  add column if not exists auto_wpp_enabled boolean not null default false,
  add column if not exists auto_wpp_antes_dias int not null default 0,      -- 0 = não envia antes
  add column if not exists auto_wpp_no_dia boolean not null default false,
  add column if not exists auto_wpp_atraso_diario boolean not null default false,
  add column if not exists auto_wpp_atraso_max_dias int not null default 0; -- 0 = sem limite

-- Exceção por CONTRATO + exigência de NF padrão do contrato
alter table public.contratos
  add column if not exists cobranca_auto_modo text not null default 'padrao', -- padrao | off | custom
  add column if not exists cobranca_auto_antes_dias int,
  add column if not exists cobranca_auto_no_dia boolean,
  add column if not exists cobranca_auto_atraso_diario boolean,
  add column if not exists exigir_nf boolean not null default false;

-- Cobrança: NF anexada + exigência + controle do disparo diário
alter table public.cobrancas
  add column if not exists nota_fiscal_path text,
  add column if not exists nota_fiscal_nome text,
  add column if not exists exigir_nf boolean not null default false,
  add column if not exists auto_wpp_ultimo_dia date;

-- Bucket privado para as notas fiscais (PDF)
insert into storage.buckets (id, name, public)
values ('notas-fiscais', 'notas-fiscais', false)
on conflict (id) do nothing;

-- Cada usuário gerencia apenas os arquivos sob o prefixo do próprio user_id
drop policy if exists "nf select own" on storage.objects;
create policy "nf select own" on storage.objects for select to authenticated
  using (bucket_id = 'notas-fiscais' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "nf insert own" on storage.objects;
create policy "nf insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'notas-fiscais' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "nf update own" on storage.objects;
create policy "nf update own" on storage.objects for update to authenticated
  using (bucket_id = 'notas-fiscais' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "nf delete own" on storage.objects;
create policy "nf delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'notas-fiscais' and auth.uid()::text = (storage.foldername(name))[1]);
