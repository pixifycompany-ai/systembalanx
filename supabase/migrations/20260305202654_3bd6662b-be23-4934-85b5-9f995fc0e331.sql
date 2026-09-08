CREATE TABLE public.contrato_aditivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  valor_anterior numeric NOT NULL,
  valor_novo numeric NOT NULL,
  data_vigencia date NOT NULL,
  motivo text,
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL
);

ALTER TABLE public.contrato_aditivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own aditivos" ON public.contrato_aditivos
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());