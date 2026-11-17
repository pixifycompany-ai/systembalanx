-- Tarefas em várias listas do Google Tarefas (não só a "BALANX").
-- agenda_itens.google_tasklist_id: lista da tarefa (vazio = lista padrão).
-- google_integracoes.tasks_sync: última leitura de cada lista {lista_id: iso}.
-- opcoes.listas (ids sincronizados), opcoes.lista_padrao, opcoes.listas_nomes {id: título}.
alter table public.agenda_itens add column if not exists google_tasklist_id text;
-- Lista onde a tarefa está hoje no Google (para mover quando a escolhida mudar).
alter table public.agenda_itens add column if not exists google_tasklist_sync text;
alter table public.google_integracoes add column if not exists tasks_sync jsonb not null default '{}'::jsonb;

-- Tarefas já sincronizadas estavam na lista BALANX.
update public.agenda_itens a set google_tasklist_id = g.tasklist_id, google_tasklist_sync = g.tasklist_id
  from public.google_integracoes g
 where g.user_id = a.user_id and a.tipo = 'tarefa' and a.google_task_id is not null and a.google_tasklist_id is null;

-- Trocar a tarefa de lista também conta como mudança (para ir para a lista nova no Google).
create or replace function public.agenda_itens_touch()
returns trigger language plpgsql as $$
begin
  if (new.tipo, new.titulo, new.notas, new.inicio, new.fim, new.dia_inteiro, new.data, new.lembrete_min,
      new.cliente_id, new.concluida, new.google_tasklist_id)
     is distinct from
     (old.tipo, old.titulo, old.notas, old.inicio, old.fim, old.dia_inteiro, old.data, old.lembrete_min,
      old.cliente_id, old.concluida, old.google_tasklist_id) then
    new.updated_at := now();
    if new.concluida and not old.concluida then new.concluida_em := now(); end if;
    if not new.concluida then new.concluida_em := null; end if;
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end $$;

-- Tarefa apagada no BALANX: guardar a lista para apagar no lugar certo no Google.
alter table public.agenda_apagados add column if not exists google_tasklist_id text;
create or replace function public.agenda_itens_apagado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.google_event_id is not null or old.google_task_id is not null then
    insert into public.agenda_apagados (user_id, google_event_id, google_task_id, google_tasklist_id)
    values (old.user_id, old.google_event_id, old.google_task_id, coalesce(old.google_tasklist_sync, old.google_tasklist_id));
  end if;
  return old;
end $$;
