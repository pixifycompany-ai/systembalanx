-- As colunas novas de cobranca_config (adicionadas depois do grant por coluna
-- de 20261001130000) ficaram sem SELECT para `authenticated`, então o cliente
-- salvava mas não conseguia LER o valor de volta (toggle voltava ao padrão).
-- Concede SELECT dessas colunas (asaas_api_key continua escondida).
grant select (email_assunto, email_corpo, auto_envio_fim_semana)
  on public.cobranca_config to authenticated;
