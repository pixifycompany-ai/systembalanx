-- Create enum for client type
CREATE TYPE public.cliente_tipo AS ENUM ('PF', 'PJ');

-- Create enum for client status
CREATE TYPE public.cliente_status AS ENUM ('ativo', 'inativo');

-- Create enum for receita status
CREATE TYPE public.receita_status AS ENUM ('pendente', 'recebido', 'atrasado');

-- Create enum for despesa status  
CREATE TYPE public.despesa_status AS ENUM ('pendente', 'pago', 'atrasado');

-- Create enum for despesa tipo
CREATE TYPE public.despesa_tipo AS ENUM ('fixa', 'variavel');

-- Create enum for contrato status
CREATE TYPE public.contrato_status AS ENUM ('ativo', 'cancelado', 'encerrado');

-- Create enum for contrato recorrencia
CREATE TYPE public.contrato_recorrencia AS ENUM ('mensal', 'trimestral', 'semestral', 'anual', 'unico');

-- Create clientes table
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf_cnpj TEXT,
  tipo public.cliente_tipo NOT NULL DEFAULT 'PJ',
  status public.cliente_status NOT NULL DEFAULT 'ativo',
  endereco TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contratos table
CREATE TABLE public.contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  recorrencia public.contrato_recorrencia NOT NULL DEFAULT 'mensal',
  status public.contrato_status NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create receitas table
CREATE TABLE public.receitas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_competencia DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_recebimento DATE,
  status public.receita_status NOT NULL DEFAULT 'pendente',
  forma_pagamento TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create despesas table
CREATE TABLE public.despesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  fornecedor TEXT,
  descricao TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_competencia DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status public.despesa_status NOT NULL DEFAULT 'pendente',
  tipo public.despesa_tipo NOT NULL DEFAULT 'variavel',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clientes
CREATE POLICY "Users can view own clients" ON public.clientes
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own clients" ON public.clientes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own clients" ON public.clientes
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own clients" ON public.clientes
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for contratos
CREATE POLICY "Users can view own contracts" ON public.contratos
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own contracts" ON public.contratos
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own contracts" ON public.contratos
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own contracts" ON public.contratos
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for receitas
CREATE POLICY "Users can view own revenues" ON public.receitas
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own revenues" ON public.receitas
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own revenues" ON public.receitas
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own revenues" ON public.receitas
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for despesas
CREATE POLICY "Users can view own expenses" ON public.despesas
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own expenses" ON public.despesas
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own expenses" ON public.despesas
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own expenses" ON public.despesas
  FOR DELETE USING (user_id = auth.uid());

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER handle_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_contratos_updated_at
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_receitas_updated_at
  BEFORE UPDATE ON public.receitas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_despesas_updated_at
  BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();