-- Add dia_vencimento column to contratos table
ALTER TABLE contratos
ADD COLUMN dia_vencimento INTEGER;

-- Add constraint for valid day range (1-31)
ALTER TABLE contratos
ADD CONSTRAINT contratos_dia_vencimento_check 
CHECK (dia_vencimento IS NULL OR (dia_vencimento >= 1 AND dia_vencimento <= 31));

-- Create enum for installment status
CREATE TYPE contrato_parcela_status AS ENUM ('pendente', 'recebido', 'atrasado');

-- Create contrato_parcelas table for one-time contract installments
CREATE TABLE contrato_parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor NUMERIC NOT NULL,
  data_vencimento DATE NOT NULL,
  status contrato_parcela_status DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT contrato_parcelas_numero_positive CHECK (numero_parcela > 0),
  CONSTRAINT contrato_parcelas_valor_positive CHECK (valor > 0)
);

-- Enable Row Level Security on contrato_parcelas
ALTER TABLE contrato_parcelas ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for contrato_parcelas
-- Users can manage installments for their own contracts
CREATE POLICY "Users can view own contract installments"
ON contrato_parcelas FOR SELECT
USING (
  contrato_id IN (SELECT id FROM contratos WHERE user_id = auth.uid())
);

CREATE POLICY "Users can create own contract installments"
ON contrato_parcelas FOR INSERT
WITH CHECK (
  contrato_id IN (SELECT id FROM contratos WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update own contract installments"
ON contrato_parcelas FOR UPDATE
USING (
  contrato_id IN (SELECT id FROM contratos WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete own contract installments"
ON contrato_parcelas FOR DELETE
USING (
  contrato_id IN (SELECT id FROM contratos WHERE user_id = auth.uid())
);

-- Create index for faster lookups by contract
CREATE INDEX idx_contrato_parcelas_contrato_id ON contrato_parcelas(contrato_id);