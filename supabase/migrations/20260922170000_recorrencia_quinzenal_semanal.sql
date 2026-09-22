-- Novas recorrências: semanal (WEEKLY) e quinzenal (BIWEEKLY) — pra assinaturas Asaas sub-mensais.
alter type public.contrato_recorrencia add value if not exists 'semanal';
alter type public.contrato_recorrencia add value if not exists 'quinzenal';
