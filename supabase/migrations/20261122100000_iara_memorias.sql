-- Memória da IARA: o que a pessoa contou e quer que a IARA lembre nas próximas conversas
-- ("meu contador é o João", "luz eu pago pelo Itaú", "prefiro respostas curtas").
-- tenant_id vazio = sobre a pessoa (vale em todas as empresas dela);
-- preenchido = sobre aquela empresa (só vale nela). Só a própria pessoa vê e mexe.
create table if not exists public.iara_memorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  texto text not null check (char_length(texto) between 3 and 300),
  origem text not null default 'iara' check (origem in ('iara', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists iara_memorias_user_idx on public.iara_memorias (user_id, created_at desc);

alter table public.iara_memorias enable row level security;

drop policy if exists "iara_memorias_proprias" on public.iara_memorias;
create policy "iara_memorias_proprias" on public.iara_memorias
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (tenant_id is null or exists (
      select 1 from public.tenant_members m where m.tenant_id = iara_memorias.tenant_id and m.user_id = auth.uid()
    ))
  );

-- Limite: até 150 memórias por pessoa (protege o prompt e o banco).
create or replace function public.iara_memorias_limite()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.iara_memorias where user_id = new.user_id) >= 150 then
    raise exception 'A IARA já guarda 150 lembranças. Apague algumas em Meu Perfil → Memória da IARA.';
  end if;
  return new;
end $$;
drop trigger if exists trg_iara_memorias_limite on public.iara_memorias;
create trigger trg_iara_memorias_limite before insert on public.iara_memorias
  for each row execute function public.iara_memorias_limite();

create or replace function public.iara_memorias_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_iara_memorias_touch on public.iara_memorias;
create trigger trg_iara_memorias_touch before update on public.iara_memorias
  for each row execute function public.iara_memorias_touch();
