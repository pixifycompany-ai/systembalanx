-- Ciclo de cobrança do tenant (mensal/anual) para o ASAAS. Schema-only, não-quebra.
alter table public.tenants add column if not exists ciclo text
  check (ciclo is null or ciclo in ('mensal', 'anual'));
