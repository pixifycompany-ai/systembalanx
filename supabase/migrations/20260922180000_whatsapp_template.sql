-- Mensagem padrão (editável) pra enviar a cobrança por WhatsApp.
-- Placeholders: {cliente} {descricao} {valor} {vencimento} {link}
alter table public.cobranca_config add column if not exists whatsapp_template text;
