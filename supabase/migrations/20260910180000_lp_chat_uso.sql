-- Rate-limit por IP da IARA da Landing Page (endpoint público). Só a edge function
-- (service role) escreve/lê; RLS ligada sem policies = ninguém mais acessa.
create table if not exists public.lp_chat_uso (
  ip text not null,
  dia date not null default current_date,
  qtd int not null default 0,
  primary key (ip, dia)
);
alter table public.lp_chat_uso enable row level security;
