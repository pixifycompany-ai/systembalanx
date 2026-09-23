-- Marca que a NF já foi entregue por WhatsApp (o arquivo é apagado do Storage
-- após o envio confirmado, então o path fica nulo mas registramos o envio).
alter table public.cobrancas
  add column if not exists nota_fiscal_enviada boolean not null default false;
