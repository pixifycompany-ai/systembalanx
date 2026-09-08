-- 1) Enum empresa_fonte
DO $$ BEGIN
  CREATE TYPE public.empresa_fonte AS ENUM ('PIXIFY', 'REVVUE', 'CLARIO', 'TABELIO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Coluna em clientes (default PIXIFY)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS empresa_fonte public.empresa_fonte NOT NULL DEFAULT 'PIXIFY';

-- 3) Realtime: REPLICA IDENTITY FULL para receber payload completo
ALTER TABLE public.receitas REPLICA IDENTITY FULL;
ALTER TABLE public.despesas REPLICA IDENTITY FULL;
ALTER TABLE public.transferencias REPLICA IDENTITY FULL;
ALTER TABLE public.clientes REPLICA IDENTITY FULL;
ALTER TABLE public.contas REPLICA IDENTITY FULL;

-- 4) Adicionar tabelas à publication supabase_realtime (idempotente)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['receitas','despesas','transferencias','clientes','contas']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;