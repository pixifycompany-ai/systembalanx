-- Permitir que usuários editem/deletem qualquer categoria, inclusive padrão
DROP POLICY IF EXISTS "Users can update own categories" ON public.categorias;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categorias;

CREATE POLICY "Users can update categories"
ON public.categorias
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR is_padrao = true)
WITH CHECK (user_id = auth.uid() OR is_padrao = true);

CREATE POLICY "Users can delete categories"
ON public.categorias
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR is_padrao = true);