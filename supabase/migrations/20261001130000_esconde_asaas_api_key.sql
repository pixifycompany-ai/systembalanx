-- SEGURANÇA: a chave de API do Asaas é um segredo. Mesmo sendo do próprio dono,
-- o navegador não deve conseguir lê-la (defesa contra XSS/exfiltração).
-- As edge functions usam service_role (não afetado por grants de coluna).
revoke select on public.cobranca_config from authenticated;
revoke select on public.cobranca_config from anon;

-- Reconcede SELECT em TODAS as colunas, menos asaas_api_key.
grant select (
  user_id, asaas_env, asaas_account_name, webhook_token, updated_at,
  whatsapp_template, whatsapp_template_pix, pix_chave, pix_titular,
  auto_wpp_enabled, auto_wpp_antes_dias, auto_wpp_no_dia,
  auto_wpp_atraso_diario, auto_wpp_atraso_max_dias
) on public.cobranca_config to authenticated;
