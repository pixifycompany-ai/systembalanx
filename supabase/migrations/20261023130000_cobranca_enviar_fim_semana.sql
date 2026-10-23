-- Envio em fim de semana POR COBRANÇA (sobrepõe o padrão em cobranca_config).
-- null = herda o padrão (cobranca_config.auto_envio_fim_semana);
-- true = pode enviar sáb/dom; false = segura e manda na segunda.
alter table public.cobrancas
  add column if not exists enviar_fim_semana boolean;
