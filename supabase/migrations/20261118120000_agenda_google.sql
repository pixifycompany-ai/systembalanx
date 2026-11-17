-- Compromissos e tarefas + integração com Google Agenda e Google Tarefas.
--
-- agenda_itens: compromisso (data/hora, vira evento na agenda "BALANX" do Google)
--   ou tarefa (data limite opcional, vira tarefa na lista "BALANX" do Google Tasks).
-- google_integracoes: conexão de cada usuário (tokens só para o servidor).
-- google_eventos: lançamentos do financeiro enviados como eventos (para atualizar/apagar).

-- ============================================================================
-- Compromissos e tarefas
-- ============================================================================
create table if not exists public.agenda_itens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  tipo text not null check (tipo in ('compromisso', 'tarefa')),
  titulo text not null check (length(titulo) between 1 and 200),
  notas text,
  -- compromisso com hora: inicio/fim; dia inteiro ou tarefa: data
  inicio timestamptz,
  fim timestamptz,
  dia_inteiro boolean not null default false,
  data date,
  lembrete_min integer,
  cliente_id uuid references public.clientes(id) on delete set null,
  concluida boolean not null default false,
  concluida_em timestamptz,
  origem text not null default 'balanx' check (origem in ('balanx', 'google')),
  google_event_id text,
  google_task_id text,
  google_sync_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tipo = 'tarefa' or inicio is not null or data is not null)
);
create index if not exists agenda_itens_tenant_idx on public.agenda_itens (tenant_id, tipo, data, inicio);
create index if not exists agenda_itens_gevent_idx on public.agenda_itens (google_event_id) where google_event_id is not null;
create index if not exists agenda_itens_gtask_idx on public.agenda_itens (google_task_id) where google_task_id is not null;

alter table public.agenda_itens enable row level security;
drop policy if exists agenda_itens_sel on public.agenda_itens;
drop policy if exists agenda_itens_ins on public.agenda_itens;
drop policy if exists agenda_itens_upd on public.agenda_itens;
drop policy if exists agenda_itens_del on public.agenda_itens;
create policy agenda_itens_sel on public.agenda_itens for select to authenticated using (public.is_tenant_member(tenant_id));
create policy agenda_itens_ins on public.agenda_itens for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy agenda_itens_upd on public.agenda_itens for update to authenticated using (public.is_tenant_member(tenant_id));
create policy agenda_itens_del on public.agenda_itens for delete to authenticated using (public.is_tenant_member(tenant_id));

drop trigger if exists trg_set_tenant on public.agenda_itens;
create trigger trg_set_tenant before insert on public.agenda_itens
  for each row execute function public.set_tenant_id();

-- updated_at só muda quando o CONTEÚDO muda (gravar ids/hora de sincronização
-- não conta) — senão cada sincronização geraria outra, sem fim.
create or replace function public.agenda_itens_touch()
returns trigger language plpgsql as $$
begin
  if (new.tipo, new.titulo, new.notas, new.inicio, new.fim, new.dia_inteiro, new.data, new.lembrete_min,
      new.cliente_id, new.concluida)
     is distinct from
     (old.tipo, old.titulo, old.notas, old.inicio, old.fim, old.dia_inteiro, old.data, old.lembrete_min,
      old.cliente_id, old.concluida) then
    new.updated_at := now();
    if new.concluida and not old.concluida then new.concluida_em := now(); end if;
    if not new.concluida then new.concluida_em := null; end if;
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end $$;
drop trigger if exists trg_agenda_itens_touch on public.agenda_itens;
create trigger trg_agenda_itens_touch before update on public.agenda_itens
  for each row execute function public.agenda_itens_touch();

-- Itens apagados no BALANX que ainda existem no Google (a sincronização apaga lá e limpa aqui).
create table if not exists public.agenda_apagados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  google_event_id text,
  google_task_id text,
  created_at timestamptz not null default now()
);
alter table public.agenda_apagados enable row level security;

create or replace function public.agenda_itens_apagado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.google_event_id is not null or old.google_task_id is not null then
    insert into public.agenda_apagados (user_id, google_event_id, google_task_id)
    values (old.user_id, old.google_event_id, old.google_task_id);
  end if;
  return old;
end $$;
drop trigger if exists trg_agenda_itens_apagado on public.agenda_itens;
create trigger trg_agenda_itens_apagado after delete on public.agenda_itens
  for each row execute function public.agenda_itens_apagado();

-- ============================================================================
-- Conexão com o Google (uma por usuário)
-- ============================================================================
create table if not exists public.google_integracoes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  email text,
  refresh_token text,
  access_token text,
  token_expira timestamptz,
  escopos text,
  calendar_id text,
  tasklist_id text,
  opcoes jsonb not null default '{"pagar": true, "receber": true, "compromissos": true, "fatura": false, "tarefas": true, "pessoal": false}'::jsonb,
  sync_token text,
  tasks_sync_em timestamptz,
  ultima_sync timestamptz,
  ultimo_erro text,
  created_at timestamptz not null default now()
);
alter table public.google_integracoes enable row level security;
drop policy if exists google_integracoes_sel on public.google_integracoes;
drop policy if exists google_integracoes_upd on public.google_integracoes;
create policy google_integracoes_sel on public.google_integracoes for select to authenticated using (user_id = auth.uid());
create policy google_integracoes_upd on public.google_integracoes for update to authenticated using (user_id = auth.uid());
-- Tokens nunca chegam ao navegador: só colunas sem segredo; e só as opções podem ser mudadas.
revoke all on public.google_integracoes from anon, authenticated;
grant select (user_id, email, escopos, calendar_id, tasklist_id, opcoes, ultima_sync, ultimo_erro, created_at)
  on public.google_integracoes to authenticated;
grant update (opcoes) on public.google_integracoes to authenticated;

-- Lançamentos do financeiro (a pagar / a receber / fatura) enviados como eventos.
create table if not exists public.google_eventos (
  user_id uuid not null references auth.users(id) on delete cascade,
  origem text not null,
  origem_id uuid not null,
  event_id text not null,
  hash text not null,
  primary key (user_id, origem, origem_id)
);
alter table public.google_eventos enable row level security;

-- ============================================================================
-- Sincronização automática a cada 10 minutos (mesma chave do cron de cobranças)
-- ============================================================================
select cron.unschedule('google-sync') where exists (select 1 from cron.job where jobname = 'google-sync');
select cron.schedule('google-sync', '*/10 * * * *',
  (select replace(command, 'cobranca-auto-disparar', 'google-sync') from cron.job where jobname = 'cobranca-auto-disparar'));
