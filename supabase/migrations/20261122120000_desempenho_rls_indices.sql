-- Desempenho: as regras de acesso (RLS) chamavam uma função PARA CADA LINHA
-- (is_tenant_member / tenant_role / is_platform_admin / auth.uid()), o que faz toda
-- consulta varrer a tabela inteira (de todas as empresas) e cresce com o número de
-- usuários do sistema. Medido: 177 ms → ~1 ms com 1.141 despesas.
-- Aqui as MESMAS regras são reescritas no formato que o Postgres resolve UMA vez por
-- consulta e que usa o índice de tenant_id. Quem vê/edita o quê não muda.

create or replace function public.meus_tenants()
returns setof uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.tenant_members where user_id = auth.uid();
$$;

create or replace function public.meus_tenants_papel(papeis text[])
returns setof uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.tenant_members where user_id = auth.uid() and papel = any(papeis);
$$;

grant execute on function public.meus_tenants() to authenticated;
grant execute on function public.meus_tenants_papel(text[]) to authenticated;

alter policy "agenda_itens_del" on public.agenda_itens using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "agenda_itens_ins" on public.agenda_itens with check ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "agenda_itens_sel" on public.agenda_itens using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "agenda_itens_upd" on public.agenda_itens using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "anexos_lixeira_del" on public.anexos_lixeira using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "anexos_lixeira_sel" on public.anexos_lixeira using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "audit_log_select" on public.audit_log using ((SELECT public.is_platform_admin()));
alter policy "cartao_fatura_pagamentos_del" on public.cartao_fatura_pagamentos using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "cartao_fatura_pagamentos_ins" on public.cartao_fatura_pagamentos with check (((tenant_id IS NOT NULL) AND ((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))));
alter policy "cartao_fatura_pagamentos_sel" on public.cartao_fatura_pagamentos using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "cartao_fatura_pagamentos_upd" on public.cartao_fatura_pagamentos using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))) with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "cartao_faturas_del" on public.cartao_faturas using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "cartao_faturas_ins" on public.cartao_faturas with check (((tenant_id IS NOT NULL) AND ((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))));
alter policy "cartao_faturas_sel" on public.cartao_faturas using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "cartao_faturas_upd" on public.cartao_faturas using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))) with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "categorias_del" on public.categorias using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "categorias_ins" on public.categorias with check (((tenant_id IS NOT NULL) AND ((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))));
alter policy "categorias_sel" on public.categorias using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "categorias_upd" on public.categorias using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))) with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "clientes_del" on public.clientes using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "clientes_ins" on public.clientes with check (((tenant_id IS NOT NULL) AND ((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))));
alter policy "clientes_sel" on public.clientes using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "clientes_upd" on public.clientes using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))) with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "cobranca_config own" on public.cobranca_config using ((user_id = (SELECT auth.uid()))) with check ((user_id = (SELECT auth.uid())));
alter policy "cobrancas own" on public.cobrancas using ((user_id = (SELECT auth.uid()))) with check ((user_id = (SELECT auth.uid())));
alter policy "conferencias_saldo_del" on public.conferencias_saldo using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "conferencias_saldo_ins" on public.conferencias_saldo with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "conferencias_saldo_sel" on public.conferencias_saldo using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "contas_del" on public.contas using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "contas_ins" on public.contas with check (((tenant_id IS NOT NULL) AND ((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))));
alter policy "contas_sel" on public.contas using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "contas_upd" on public.contas using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))) with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "contrato_aditivos_del" on public.contrato_aditivos using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "contrato_aditivos_ins" on public.contrato_aditivos with check (((tenant_id IS NOT NULL) AND ((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))));
alter policy "contrato_aditivos_sel" on public.contrato_aditivos using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "contrato_aditivos_upd" on public.contrato_aditivos using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))) with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "contrato_parcelas_del" on public.contrato_parcelas using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "contrato_parcelas_ins" on public.contrato_parcelas with check (((tenant_id IS NOT NULL) AND ((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))));
alter policy "contrato_parcelas_sel" on public.contrato_parcelas using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "contrato_parcelas_upd" on public.contrato_parcelas using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))) with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "contratos_del" on public.contratos using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "contratos_ins" on public.contratos with check (((tenant_id IS NOT NULL) AND ((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))));
alter policy "contratos_sel" on public.contratos using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "contratos_upd" on public.contratos using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))) with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "despesas_del" on public.despesas using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "despesas_ins" on public.despesas with check (((tenant_id IS NOT NULL) AND ((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))));
alter policy "despesas_sel" on public.despesas using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "despesas_upd" on public.despesas using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))) with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "email_envios own" on public.email_envios using ((user_id = (SELECT auth.uid())));
alter policy "email_envios own update" on public.email_envios using ((user_id = (SELECT auth.uid()))) with check ((user_id = (SELECT auth.uid())));
alter policy "google_integracoes_sel" on public.google_integracoes using ((user_id = (SELECT auth.uid())));
alter policy "google_integracoes_upd" on public.google_integracoes using ((user_id = (SELECT auth.uid())));
alter policy "iara_memorias_proprias" on public.iara_memorias using ((user_id = (SELECT auth.uid()))) with check (((user_id = (SELECT auth.uid())) AND ((tenant_id IS NULL) OR (EXISTS ( SELECT 1
   FROM tenant_members m
  WHERE ((m.tenant_id = iara_memorias.tenant_id) AND (m.user_id = (SELECT auth.uid()))))))));
alter policy "iara_pendentes_del" on public.iara_pendentes using ((user_id = (SELECT auth.uid())));
alter policy "iara_pendentes_sel" on public.iara_pendentes using ((user_id = (SELECT auth.uid())));
alter policy "iara_pendentes_upd" on public.iara_pendentes using ((user_id = (SELECT auth.uid())));
alter policy "iara_uso_sel" on public.iara_uso_diario using (((SELECT auth.uid()) = user_id));
alter policy "metas_del" on public.metas using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "metas_ins" on public.metas with check (((tenant_id IS NOT NULL) AND ((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))));
alter policy "metas_sel" on public.metas using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "metas_upd" on public.metas using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))) with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "pendencias_ignoradas_del" on public.pendencias_ignoradas using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "pendencias_ignoradas_ins" on public.pendencias_ignoradas with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "pendencias_ignoradas_sel" on public.pendencias_ignoradas using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "pconfig_update" on public.plataforma_config using ((SELECT public.is_platform_admin())) with check ((SELECT public.is_platform_admin()));
alter policy "padmins_select" on public.platform_admins using ((SELECT public.is_platform_admin()));
alter policy "Users delete own profile" on public.profiles using ((user_id = (SELECT auth.uid())));
alter policy "Users insert own profile" on public.profiles with check ((user_id = (SELECT auth.uid())));
alter policy "Users update own profile" on public.profiles using ((user_id = (SELECT auth.uid()))) with check ((user_id = (SELECT auth.uid())));
alter policy "Users view own profile" on public.profiles using ((user_id = (SELECT auth.uid())));
alter policy "Users delete own subs" on public.push_subscriptions using ((user_id = (SELECT auth.uid())));
alter policy "Users insert own subs" on public.push_subscriptions with check ((user_id = (SELECT auth.uid())));
alter policy "Users update own subs" on public.push_subscriptions using ((user_id = (SELECT auth.uid()))) with check ((user_id = (SELECT auth.uid())));
alter policy "Users view own subs" on public.push_subscriptions using ((user_id = (SELECT auth.uid())));
alter policy "receitas_del" on public.receitas using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "receitas_ins" on public.receitas with check (((tenant_id IS NOT NULL) AND ((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))));
alter policy "receitas_sel" on public.receitas using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "receitas_upd" on public.receitas using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))) with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "tinvites_all" on public.tenant_invites using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin']))) OR (SELECT public.is_platform_admin()))) with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin']))) OR (SELECT public.is_platform_admin())));
alter policy "tmembers_delete" on public.tenant_members using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin']))) OR (SELECT public.is_platform_admin())));
alter policy "tmembers_insert" on public.tenant_members with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin']))) OR (SELECT public.is_platform_admin())));
alter policy "tmembers_select" on public.tenant_members using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "tmembers_update" on public.tenant_members using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin']))) OR (SELECT public.is_platform_admin())));
alter policy "tenants_delete" on public.tenants using ((SELECT public.is_platform_admin()));
alter policy "tenants_insert" on public.tenants with check (((created_by = (SELECT auth.uid())) OR (SELECT public.is_platform_admin())));
alter policy "tenants_select" on public.tenants using ((id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "tenants_update" on public.tenants using (((id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin']))) OR (SELECT public.is_platform_admin())));
alter policy "transferencias_del" on public.transferencias using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "transferencias_ins" on public.transferencias with check (((tenant_id IS NOT NULL) AND ((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))));
alter policy "transferencias_sel" on public.transferencias using ((tenant_id IN (SELECT public.meus_tenants()) OR (SELECT public.is_platform_admin())));
alter policy "transferencias_upd" on public.transferencias using (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin()))) with check (((tenant_id IN (SELECT public.meus_tenants_papel(ARRAY['owner', 'admin', 'financeiro']))) OR (SELECT public.is_platform_admin())));
alter policy "whatsapp_conexoes le a propria" on public.whatsapp_conexoes using ((user_id = (SELECT auth.uid())));
alter policy "whatsapp_envios le os proprios" on public.whatsapp_envios using ((user_id = (SELECT auth.uid())));

-- Índices: chaves estrangeiras sem índice e as datas mais usadas nas telas.
create index if not exists idx_despesas_tenant_venc on public.despesas (tenant_id, data_vencimento);
create index if not exists idx_despesas_tenant_comp on public.despesas (tenant_id, data_competencia);
create index if not exists idx_despesas_tenant_pag on public.despesas (tenant_id, data_pagamento) where data_pagamento is not null;
create index if not exists idx_despesas_conta on public.despesas (conta_id);
create index if not exists idx_despesas_categoria on public.despesas (categoria_id);
create index if not exists idx_despesas_cliente on public.despesas (cliente_id) where cliente_id is not null;
create index if not exists idx_despesas_user on public.despesas (user_id);
create index if not exists idx_receitas_tenant_venc on public.receitas (tenant_id, data_vencimento);
create index if not exists idx_receitas_tenant_comp on public.receitas (tenant_id, data_competencia);
create index if not exists idx_receitas_tenant_rec on public.receitas (tenant_id, data_recebimento) where data_recebimento is not null;
create index if not exists idx_receitas_conta on public.receitas (conta_id);
create index if not exists idx_receitas_categoria on public.receitas (categoria_id);
create index if not exists idx_receitas_cliente on public.receitas (cliente_id);
create index if not exists idx_receitas_contrato on public.receitas (contrato_id) where contrato_id is not null;
create index if not exists idx_receitas_user on public.receitas (user_id);
create index if not exists idx_cobrancas_receita on public.cobrancas (receita_id) where receita_id is not null;
create index if not exists idx_cobrancas_cliente on public.cobrancas (cliente_id);
create index if not exists idx_cobrancas_contrato on public.cobrancas (contrato_id) where contrato_id is not null;
create index if not exists idx_cobrancas_conta on public.cobrancas (conta_id) where conta_id is not null;
create index if not exists idx_cobrancas_user_status on public.cobrancas (user_id, status, vencimento);
create index if not exists idx_transferencias_origem on public.transferencias (conta_origem_id);
create index if not exists idx_transferencias_destino on public.transferencias (conta_destino_id);
create index if not exists idx_contrato_aditivos_contrato on public.contrato_aditivos (contrato_id);
create index if not exists idx_contratos_cliente on public.contratos (cliente_id);
create index if not exists idx_agenda_itens_cliente on public.agenda_itens (cliente_id) where cliente_id is not null;
create index if not exists idx_agenda_itens_inicio on public.agenda_itens (inicio) where tipo = 'compromisso' and inicio is not null;
create index if not exists idx_conferencias_saldo_tenant on public.conferencias_saldo (tenant_id);
create index if not exists idx_categorias_user on public.categorias (user_id);
create index if not exists idx_clientes_user on public.clientes (user_id);
create index if not exists idx_contratos_user on public.contratos (user_id);
create index if not exists idx_iara_memorias_tenant on public.iara_memorias (tenant_id) where tenant_id is not null;
create index if not exists idx_google_integracoes_tenant on public.google_integracoes (tenant_id);
create index if not exists idx_profiles_tenant on public.profiles (current_tenant_id);
create index if not exists idx_tenants_principal on public.tenants (conta_principal_id) where conta_principal_id is not null;
create index if not exists idx_tenants_created_by on public.tenants (created_by);
create index if not exists idx_tenant_invites_invited_by on public.tenant_invites (invited_by);

analyze public.despesas, public.receitas, public.cobrancas, public.transferencias, public.agenda_itens;
