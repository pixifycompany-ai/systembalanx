
ALTER TABLE public.receitas ADD COLUMN recurrence_group_id uuid DEFAULT NULL;
ALTER TABLE public.despesas ADD COLUMN recurrence_group_id uuid DEFAULT NULL;
ALTER TABLE public.contratos ADD COLUMN data_inativacao date DEFAULT NULL;
