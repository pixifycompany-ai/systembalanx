ALTER TABLE contratos ADD COLUMN asaas_subscription_id text;
CREATE UNIQUE INDEX idx_contratos_asaas_sub_user 
  ON contratos(user_id, asaas_subscription_id) 
  WHERE asaas_subscription_id IS NOT NULL;