-- Preferência de canal de cobrança por cliente + flag anti-duplicidade do e-mail.
-- Permite disparar a cobrança por WhatsApp, por e-mail, ou ambos (o cliente escolhe).

-- Canal preferido do cliente: whatsapp (padrão) | email | ambos
alter table public.clientes
  add column if not exists canal_cobranca text not null default 'whatsapp';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_canal_cobranca_chk') then
    alter table public.clientes
      add constraint clientes_canal_cobranca_chk
      check (canal_cobranca in ('whatsapp', 'email', 'ambos'));
  end if;
end $$;

-- Marca o dia do último envio automático POR E-MAIL (espelha auto_wpp_ultimo_dia),
-- para que "ambos" não bloqueie um canal por causa do outro.
alter table public.cobrancas
  add column if not exists auto_email_ultimo_dia date;
