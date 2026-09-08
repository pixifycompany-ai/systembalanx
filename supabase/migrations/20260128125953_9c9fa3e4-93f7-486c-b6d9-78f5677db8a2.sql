-- Add conta_pagamento column to receitas and despesas tables
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS conta_pagamento TEXT;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS conta_pagamento TEXT;

-- Add comment for documentation
COMMENT ON COLUMN receitas.conta_pagamento IS 'Bank/payment account identifier (e.g., XP Banking, Conta Simples)';
COMMENT ON COLUMN despesas.conta_pagamento IS 'Bank/payment account identifier (e.g., XP Banking, Conta Simples)';