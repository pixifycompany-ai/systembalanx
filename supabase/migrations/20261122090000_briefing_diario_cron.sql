-- Briefing do dia: todo dia às 08:00 (BRT) = 11:00 UTC, chama a função notify-due-expenses.
-- Usa a MESMA URL e o MESMO x-cron-secret do agendamento de cobranças (copia do job
-- 'cobranca-auto-disparar'), então não é preciso colar o segredo aqui.
do $$
declare
  cmd text;
begin
  select replace(command, 'cobranca-auto-disparar', 'notify-due-expenses') into cmd
    from cron.job where jobname = 'cobranca-auto-disparar';
  if cmd is null then
    raise exception 'Agendamento cobranca-auto-disparar não encontrado (dele vem a URL e o segredo).';
  end if;
  if exists (select 1 from cron.job where jobname = 'briefing-diario') then
    perform cron.unschedule('briefing-diario');
  end if;
  perform cron.schedule('briefing-diario', '0 11 * * *', cmd);
end $$;

-- Conferir: select jobname, schedule from cron.job where jobname = 'briefing-diario';
