
-- =============================================
-- DESPESAS: Drop public policies, recreate as authenticated
-- =============================================
DROP POLICY "Users can create own expenses" ON public.despesas;
DROP POLICY "Users can delete own expenses" ON public.despesas;
DROP POLICY "Users can update own expenses" ON public.despesas;
DROP POLICY "Users can view own expenses" ON public.despesas;

CREATE POLICY "Users can create own expenses" ON public.despesas FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own expenses" ON public.despesas FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own expenses" ON public.despesas FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can view own expenses" ON public.despesas FOR SELECT TO authenticated USING (user_id = auth.uid());

-- =============================================
-- CONTRATOS
-- =============================================
DROP POLICY "Users can create own contracts" ON public.contratos;
DROP POLICY "Users can delete own contracts" ON public.contratos;
DROP POLICY "Users can update own contracts" ON public.contratos;
DROP POLICY "Users can view own contracts" ON public.contratos;

CREATE POLICY "Users can create own contracts" ON public.contratos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own contracts" ON public.contratos FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own contracts" ON public.contratos FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can view own contracts" ON public.contratos FOR SELECT TO authenticated USING (user_id = auth.uid());

-- =============================================
-- CLIENTES
-- =============================================
DROP POLICY "Users can create own clients" ON public.clientes;
DROP POLICY "Users can delete own clients" ON public.clientes;
DROP POLICY "Users can update own clients" ON public.clientes;
DROP POLICY "Users can view own clients" ON public.clientes;

CREATE POLICY "Users can create own clients" ON public.clientes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own clients" ON public.clientes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own clients" ON public.clientes FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can view own clients" ON public.clientes FOR SELECT TO authenticated USING (user_id = auth.uid());

-- =============================================
-- RECEITAS
-- =============================================
DROP POLICY "Users can create own revenues" ON public.receitas;
DROP POLICY "Users can delete own revenues" ON public.receitas;
DROP POLICY "Users can update own revenues" ON public.receitas;
DROP POLICY "Users can view own revenues" ON public.receitas;

CREATE POLICY "Users can create own revenues" ON public.receitas FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own revenues" ON public.receitas FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own revenues" ON public.receitas FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can view own revenues" ON public.receitas FOR SELECT TO authenticated USING (user_id = auth.uid());

-- =============================================
-- METAS
-- =============================================
DROP POLICY "Users can create own metas" ON public.metas;
DROP POLICY "Users can delete own metas" ON public.metas;
DROP POLICY "Users can update own metas" ON public.metas;
DROP POLICY "Users can view own metas" ON public.metas;

CREATE POLICY "Users can create own metas" ON public.metas FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own metas" ON public.metas FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own metas" ON public.metas FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can view own metas" ON public.metas FOR SELECT TO authenticated USING (user_id = auth.uid());

-- =============================================
-- CATEGORIAS
-- =============================================
DROP POLICY "Users can create categories" ON public.categorias;
DROP POLICY "Users can delete own categories" ON public.categorias;
DROP POLICY "Users can update own categories" ON public.categorias;
DROP POLICY "Users can view categories" ON public.categorias;

CREATE POLICY "Users can create categories" ON public.categorias FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()) AND (is_padrao = false));
CREATE POLICY "Users can delete own categories" ON public.categorias FOR DELETE TO authenticated USING ((user_id = auth.uid()) AND (is_padrao = false));
CREATE POLICY "Users can update own categories" ON public.categorias FOR UPDATE TO authenticated USING ((user_id = auth.uid()) AND (is_padrao = false));
CREATE POLICY "Users can view categories" ON public.categorias FOR SELECT TO authenticated USING ((is_padrao = true) OR (user_id = auth.uid()));

-- =============================================
-- CONTRATO_PARCELAS
-- =============================================
DROP POLICY "Users can create own contract installments" ON public.contrato_parcelas;
DROP POLICY "Users can delete own contract installments" ON public.contrato_parcelas;
DROP POLICY "Users can update own contract installments" ON public.contrato_parcelas;
DROP POLICY "Users can view own contract installments" ON public.contrato_parcelas;

CREATE POLICY "Users can create own contract installments" ON public.contrato_parcelas FOR INSERT TO authenticated WITH CHECK (contrato_id IN (SELECT contratos.id FROM contratos WHERE contratos.user_id = auth.uid()));
CREATE POLICY "Users can delete own contract installments" ON public.contrato_parcelas FOR DELETE TO authenticated USING (contrato_id IN (SELECT contratos.id FROM contratos WHERE contratos.user_id = auth.uid()));
CREATE POLICY "Users can update own contract installments" ON public.contrato_parcelas FOR UPDATE TO authenticated USING (contrato_id IN (SELECT contratos.id FROM contratos WHERE contratos.user_id = auth.uid()));
CREATE POLICY "Users can view own contract installments" ON public.contrato_parcelas FOR SELECT TO authenticated USING (contrato_id IN (SELECT contratos.id FROM contratos WHERE contratos.user_id = auth.uid()));
