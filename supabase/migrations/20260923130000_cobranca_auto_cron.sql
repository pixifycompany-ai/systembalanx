-- Agenda o disparo automático diário (pg_cron chama a Edge Function).
-- Substitua __CRON_SECRET__ pelo valor do secret CRON_SECRET antes de rodar.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior, se existir
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cobranca-auto-disparar') then
    perform cron.unschedule('cobranca-auto-disparar');
  end if;
end $$;

-- Roda todo dia às 09:00 BRT (12:00 UTC)
select cron.schedule('cobranca-auto-disparar', '0 12 * * *', $$
  select net.http_post(
    url := 'https://hvwuuxvsoyovkvedifco.supabase.co/functions/v1/cobranca-auto-disparar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '__CRON_SECRET__'),
    body := '{}'::jsonb
  );
$$);
