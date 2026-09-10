-- ============================================================================
-- Fair-use da IARA: conta perguntas por usuário/dia (anti-abuso). Uso normal
-- nunca encosta no teto. A edge function chama iara_registrar_uso a cada pergunta.
-- ============================================================================

create table if not exists public.iara_uso_diario (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null default current_date,
  qtd int not null default 0,
  primary key (user_id, dia)
);

alter table public.iara_uso_diario enable row level security;

-- cada usuário só enxerga o próprio uso
drop policy if exists iara_uso_sel on public.iara_uso_diario;
create policy iara_uso_sel on public.iara_uso_diario for select using (auth.uid() = user_id);

-- Incrementa o contador do dia e diz se passou do limite. security definer p/
-- escrever apesar da RLS, mas sempre escopado ao auth.uid() (o próprio usuário).
create or replace function public.iara_registrar_uso(p_limite int default 120)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_qtd int;
begin
  if auth.uid() is null then
    return jsonb_build_object('qtd', 0, 'limite', p_limite, 'bloqueado', false);
  end if;
  insert into public.iara_uso_diario (user_id, dia, qtd)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, dia) do update set qtd = public.iara_uso_diario.qtd + 1
  returning qtd into v_qtd;
  return jsonb_build_object('qtd', v_qtd, 'limite', p_limite, 'bloqueado', v_qtd > p_limite);
end $$;

grant execute on function public.iara_registrar_uso(int) to authenticated;
