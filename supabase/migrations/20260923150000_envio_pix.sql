-- Envio por WhatsApp usando a CHAVE PIX do tenant (em vez do link da fatura Asaas)
-- para cobranças escolhidas. Chave e modelo de mensagem PIX ficam em cobranca_config.
alter table public.cobranca_config
  add column if not exists pix_chave text,
  add column if not exists pix_titular text,
  add column if not exists whatsapp_template_pix text;

-- Padrão de envio por contrato (herda para as cobranças geradas) + por cobrança.
alter table public.contratos
  add column if not exists envio_pix boolean not null default false;
alter table public.cobrancas
  add column if not exists envio_pix boolean not null default false;
