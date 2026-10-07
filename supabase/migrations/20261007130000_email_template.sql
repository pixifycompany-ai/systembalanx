-- Template do e-mail de cobrança (assunto + corpo), editável no Meu Perfil.
-- Aceita placeholders {cliente} {descricao} {valor} {vencimento} {link} {pix} {titular}.
alter table public.cobranca_config
  add column if not exists email_assunto text,
  add column if not exists email_corpo text;
