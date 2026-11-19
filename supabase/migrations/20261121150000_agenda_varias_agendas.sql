-- Compromissos em qualquer agenda do Google (não só a "BALANX").
-- agenda_itens.google_calendar_id: agenda escolhida (vazio = agenda BALANX).
-- agenda_itens.google_calendar_sync: agenda onde o evento está hoje no Google (para mover quando a escolha mudar).
alter table public.agenda_itens add column if not exists google_calendar_id text;
alter table public.agenda_itens add column if not exists google_calendar_sync text;

-- Compromissos já sincronizados estão na agenda BALANX.
update public.agenda_itens a set google_calendar_sync = g.calendar_id
  from public.google_integracoes g
 where g.user_id = a.user_id and a.tipo = 'compromisso' and a.google_event_id is not null and a.google_calendar_sync is null;

-- Trocar o compromisso de agenda também conta como mudança (para ir para a agenda nova no Google).
create or replace function public.agenda_itens_touch()
returns trigger language plpgsql as $$
begin
  if (new.tipo, new.titulo, new.notas, new.inicio, new.fim, new.dia_inteiro, new.data, new.lembrete_min,
      new.cliente_id, new.concluida, new.google_tasklist_id, new.google_calendar_id)
     is distinct from
     (old.tipo, old.titulo, old.notas, old.inicio, old.fim, old.dia_inteiro, old.data, old.lembrete_min,
      old.cliente_id, old.concluida, old.google_tasklist_id, old.google_calendar_id) then
    new.updated_at := now();
    if new.concluida and not old.concluida then new.concluida_em := now(); end if;
    if not new.concluida then new.concluida_em := null; end if;
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end $$;

-- Compromisso apagado no BALANX: guardar a agenda para apagar no lugar certo no Google.
alter table public.agenda_apagados add column if not exists google_calendar_id text;
create or replace function public.agenda_itens_apagado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.google_event_id is not null or old.google_task_id is not null then
    insert into public.agenda_apagados (user_id, google_event_id, google_task_id, google_tasklist_id, google_calendar_id)
    values (old.user_id, old.google_event_id, old.google_task_id,
            coalesce(old.google_tasklist_sync, old.google_tasklist_id),
            coalesce(old.google_calendar_sync, old.google_calendar_id));
  end if;
  return old;
end $$;
