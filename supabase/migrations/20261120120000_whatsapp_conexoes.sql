-- WhatsApp PRÓPRIO de cada empresa (sessão na AstraCalls). As cobranças e lembretes
-- saem do número conectado aqui — não mais de um número único do BALANX.
-- Só a função whatsapp-conexao (service role) grava: o usuário só LÊ a própria linha,
-- para ninguém apontar o envio para a sessão de outra empresa.
create table if not exists public.whatsapp_conexoes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sid text not null unique,
  numero text,
  estado text,
  conectado_em timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_conexoes enable row level security;
revoke all on public.whatsapp_conexoes from anon, authenticated;
grant select on public.whatsapp_conexoes to authenticated;
drop policy if exists "whatsapp_conexoes le a propria" on public.whatsapp_conexoes;
create policy "whatsapp_conexoes le a propria" on public.whatsapp_conexoes
  for select using (user_id = auth.uid());

-- A conta da Pixify já usa a sessão "WhatsApp" (final 0102): fica vinculada a ela.
insert into public.whatsapp_conexoes (user_id, sid, numero, estado, conectado_em)
select 'ca7a4de2-ee21-4892-aa42-c4dc06e76ffe', '90d5bea1c485ebc40a7bbb5ba33ab2db', '556599020102', 'open', now()
where exists (select 1 from auth.users where id = 'ca7a4de2-ee21-4892-aa42-c4dc06e76ffe')
on conflict (user_id) do nothing;
