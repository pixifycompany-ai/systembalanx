-- Conta bancária escolhida para a cobrança (onde o dinheiro é reconciliado ao receber)
alter table public.cobrancas add column if not exists conta_id uuid references public.contas(id) on delete set null;
