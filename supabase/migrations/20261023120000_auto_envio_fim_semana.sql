-- Toggle: permitir disparo automático de cobrança (WhatsApp/e-mail) no fim de semana.
-- true (padrão) = pode enviar sábado/domingo; false = segura e manda na segunda.
alter table public.cobranca_config
  add column if not exists auto_envio_fim_semana boolean not null default true;
