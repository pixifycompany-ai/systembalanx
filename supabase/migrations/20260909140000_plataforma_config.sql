-- Config global da plataforma (preço do plano único). Linha única, editável pelo superadmin.
create table if not exists public.plataforma_config (
  id boolean primary key default true check (id = true),
  preco_mensal numeric not null default 29.90,
  preco_anual_parcela numeric not null default 19.90,
  updated_at timestamptz not null default now()
);

insert into public.plataforma_config (id) values (true) on conflict (id) do nothing;

alter table public.plataforma_config enable row level security;

-- Preço é público (qualquer autenticado lê); só superadmin edita.
create policy pconfig_select on public.plataforma_config for select using (true);
create policy pconfig_update on public.plataforma_config for update using (public.is_platform_admin()) with check (public.is_platform_admin());
