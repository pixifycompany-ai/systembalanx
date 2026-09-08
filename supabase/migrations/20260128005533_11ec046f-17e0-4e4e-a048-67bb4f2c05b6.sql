-- Create enum for category type
CREATE TYPE public.categoria_tipo AS ENUM ('receita', 'despesa');

-- Create categorias table
CREATE TABLE public.categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo categoria_tipo NOT NULL,
  cor TEXT NOT NULL DEFAULT '#6B7280',
  is_padrao BOOLEAN NOT NULL DEFAULT false,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view default categories and their own
CREATE POLICY "Users can view categories"
ON public.categorias
FOR SELECT
USING (is_padrao = true OR user_id = auth.uid());

-- Policy: Users can create their own categories (non-default only)
CREATE POLICY "Users can create categories"
ON public.categorias
FOR INSERT
WITH CHECK (user_id = auth.uid() AND is_padrao = false);

-- Policy: Users can update their own categories (non-default only)
CREATE POLICY "Users can update own categories"
ON public.categorias
FOR UPDATE
USING (user_id = auth.uid() AND is_padrao = false);

-- Policy: Users can delete their own categories (non-default only)
CREATE POLICY "Users can delete own categories"
ON public.categorias
FOR DELETE
USING (user_id = auth.uid() AND is_padrao = false);

-- Insert default categories for Receitas
INSERT INTO public.categorias (nome, tipo, cor, is_padrao, user_id) VALUES
('Serviços Prestados', 'receita', '#10B981', true, NULL),
('Projetos', 'receita', '#3B82F6', true, NULL),
('Consultoria', 'receita', '#8B5CF6', true, NULL),
('Licenças/Assinaturas', 'receita', '#F59E0B', true, NULL),
('Comissões', 'receita', '#F97316', true, NULL),
('Outros', 'receita', '#6B7280', true, NULL);

-- Insert default categories for Despesas
INSERT INTO public.categorias (nome, tipo, cor, is_padrao, user_id) VALUES
('Ferramentas e Software', 'despesa', '#3B82F6', true, NULL),
('Marketing e Publicidade', 'despesa', '#EC4899', true, NULL),
('Infraestrutura', 'despesa', '#10B981', true, NULL),
('Pessoal/Salários', 'despesa', '#8B5CF6', true, NULL),
('Impostos', 'despesa', '#EF4444', true, NULL),
('Serviços Terceirizados', 'despesa', '#F97316', true, NULL),
('Materiais', 'despesa', '#F59E0B', true, NULL),
('Outros', 'despesa', '#6B7280', true, NULL);