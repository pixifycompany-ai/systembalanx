-- 1) Pausa de contrato: deixa de gerar receitas (e, com assinatura no Asaas,
--    de cobrar) entre pausado_desde e pausado_ate. pausado_ate nulo = até reativar.
--    asaas_pausado marca que a assinatura foi suspensa no Asaas (INACTIVE) e
--    precisa voltar a ACTIVE na reativação (feito pelas edge functions).
-- 2) Conferência de saldo com o extrato do banco (histórico por conta).

alter table public.contratos
  add column if not exists pausado_desde date,
  add column if not exists pausado_ate date,
  add column if not exists asaas_pausado boolean not null default false;

alter table public.contratos drop constraint if exists contratos_pausa_ck;
alter table public.contratos add constraint contratos_pausa_ck
  check (pausado_ate is null or (pausado_desde is not null and pausado_ate >= pausado_desde));

-- Gerador da janela de 12 meses: igual ao anterior, pulando as datas em pausa.
create or replace function public.gerar_receitas_contratos(p_contrato uuid default null, p_simular boolean default false)
returns table (contrato uuid, cliente text, vencimento date, valor numeric, descricao text)
language plpgsql security definer set search_path = public as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  limite date := ((now() at time zone 'America/Sao_Paulo')::date + interval '12 months')::date;
  g record; u record; m record; c0 record;
  combinado boolean;
  meses int; dias int; k int; occ date; fim date; ini date;
  tol int; existe boolean; v_conta uuid; v_desc text;
  tem_modelo boolean; v_categoria uuid; v_forma text;
begin
  for g in
    select coalesce(ct.asaas_subscription_id, ct.id::text) as chave,
           array_agg(ct.id order by ct.valor desc) as ids, sum(ct.valor) as soma, count(*) as qtd,
           min(ct.cliente_id::text)::uuid as cliente_id
    from contratos ct
    where ct.status = 'ativo' and ct.data_inativacao is null and ct.gerar_receitas
      and ct.recorrencia::text <> 'unico' and ct.cliente_id is not null
      and (p_contrato is null or coalesce(ct.asaas_subscription_id, ct.id::text) =
           (select coalesce(x.asaas_subscription_id, x.id::text) from contratos x where x.id = p_contrato))
    group by 1
  loop
    combinado := false;
    if g.qtd > 1 then
      select r.valor into m from receitas r
      where r.cliente_id = g.cliente_id
        and (r.contrato_id = any(g.ids)
             or r.id in (select cb.receita_id from cobrancas cb where cb.contrato_id = any(g.ids) and cb.receita_id is not null))
      order by r.data_vencimento desc limit 1;
      combinado := found and abs(m.valor - g.soma) < 0.01;
    end if;

    for u in
      select case when combinado then g.ids else array[x.id] end as ids,
             case when combinado then g.soma else x.valor end as valor,
             x.id as base_id
      from contratos x
      where x.id = any(case when combinado then array[g.ids[1]] else g.ids end)
    loop
      select * into c0 from contratos where id = u.base_id;
      fim := least(coalesce(c0.data_fim, limite), limite);
      ini := c0.data_inicio;
      meses := case c0.recorrencia::text when 'mensal' then 1 when 'bimestral' then 2 when 'trimestral' then 3
                                   when 'semestral' then 6 when 'anual' then 12 else 0 end;
      dias := case c0.recorrencia::text when 'semanal' then 7 when 'quinzenal' then 15 else 0 end;
      if meses = 0 and dias = 0 then continue; end if;
      tol := case when dias > 0 then dias / 2 else 0 end;

      select r.* into m from receitas r
      where r.cliente_id = c0.cliente_id
        and (r.contrato_id = any(u.ids)
             or r.id in (select cb.receita_id from cobrancas cb where cb.contrato_id = any(u.ids) and cb.receita_id is not null)
             or (r.contrato_id is null and abs(r.valor - u.valor) < 0.01))
      order by r.data_vencimento desc limit 1;
      tem_modelo := found;
      if tem_modelo then
        v_desc := btrim(regexp_replace(m.descricao, '\s*\(\s*\d+\s*/\s*\d+\s*\)', '', 'g'));
        v_conta := m.conta_id;
        v_categoria := m.categoria_id;
        v_forma := m.forma_pagamento;
      else
        v_categoria := null;
        v_forma := null;
        v_desc := (select string_agg(x.descricao, ' + ' order by x.valor desc) from contratos x where x.id = any(u.ids));
        v_conta := (select r.conta_id from receitas r where r.tenant_id = c0.tenant_id and r.conta_id is not null
                    group by r.conta_id order by count(*) desc limit 1);
      end if;

      k := 0;
      loop
        if meses > 0 then
          occ := (date_trunc('month', ini) + make_interval(months => k * meses))::date;
          occ := occ + (least(coalesce(c0.dia_vencimento, extract(day from ini)::int),
                              extract(day from (occ + interval '1 month - 1 day'))::int) - 1);
        else
          occ := ini + k * dias;
        end if;
        exit when occ > fim;
        k := k + 1;
        continue when occ < hoje or occ < ini;
        -- Em pausa: não lança.
        continue when c0.pausado_desde is not null and occ >= c0.pausado_desde
                      and (c0.pausado_ate is null or occ <= c0.pausado_ate);

        select exists (
          select 1 from receitas r
          where r.cliente_id = c0.cliente_id
            and (r.contrato_id = any(u.ids)
                 or r.id in (select cb.receita_id from cobrancas cb where cb.contrato_id = any(u.ids) and cb.receita_id is not null)
                 or (r.contrato_id is null and abs(r.valor - u.valor) < 0.01))
            and (case when meses > 0
                      then date_trunc('month', r.data_vencimento) = date_trunc('month', occ)
                      else r.data_vencimento between occ - tol and occ + tol end)
        ) into existe;
        continue when existe;

        contrato := u.base_id;
        cliente := (select nome from clientes where id = c0.cliente_id);
        vencimento := occ;
        valor := u.valor;
        descricao := v_desc;
        if not p_simular then
          insert into receitas (user_id, tenant_id, cliente_id, contrato_id, categoria_id, conta_id, forma_pagamento,
                                status, valor, descricao, data_vencimento, data_competencia)
          values (c0.user_id, c0.tenant_id, c0.cliente_id, case when combinado then null else c0.id end,
                  v_categoria, v_conta, coalesce(v_forma, 'pix'),
                  'pendente', u.valor, v_desc, occ, occ);
        end if;
        return next;
      end loop;
    end loop;
  end loop;
end $$;

revoke all on function public.gerar_receitas_contratos(uuid, boolean) from public, anon, authenticated;

-- Contrato criado/ativado/alterado: apaga as receitas em aberto que caíram na
-- pausa (só as que não têm cobrança viva) e completa a janela.
create or replace function public.contratos_gerar_receitas_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if new.pausado_desde is not null
     and (tg_op = 'INSERT' or new.pausado_desde is distinct from old.pausado_desde
          or new.pausado_ate is distinct from old.pausado_ate) then
    delete from receitas r
     where r.contrato_id = new.id and r.status = 'pendente'
       and r.data_vencimento >= greatest(new.pausado_desde, hoje)
       and (new.pausado_ate is null or r.data_vencimento <= new.pausado_ate)
       and not exists (select 1 from cobrancas cb where cb.receita_id = r.id
                       and cb.status not in ('cancelado', 'estornado'));
  end if;
  if new.status = 'ativo' and new.gerar_receitas then
    perform public.gerar_receitas_contratos(new.id, false);
  end if;
  return new;
end $$;

drop trigger if exists trg_contratos_gerar_receitas on public.contratos;
create trigger trg_contratos_gerar_receitas
  after insert or update of status, data_inicio, data_fim, dia_vencimento, recorrencia, gerar_receitas, pausado_desde, pausado_ate
  on public.contratos for each row execute function public.contratos_gerar_receitas_trg();

-- ============================================================================
-- Conferência de saldo com o banco
-- ============================================================================
create table if not exists public.conferencias_saldo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  data date not null,
  saldo_banco numeric(14,2) not null,
  saldo_sistema numeric(14,2) not null,
  diferenca numeric(14,2) generated always as (saldo_banco - saldo_sistema) stored,
  created_at timestamptz not null default now()
);
create index if not exists conferencias_saldo_conta_idx on public.conferencias_saldo (conta_id, created_at desc);

alter table public.conferencias_saldo enable row level security;
drop policy if exists conferencias_saldo_sel on public.conferencias_saldo;
drop policy if exists conferencias_saldo_ins on public.conferencias_saldo;
drop policy if exists conferencias_saldo_del on public.conferencias_saldo;
create policy conferencias_saldo_sel on public.conferencias_saldo for select to authenticated
  using (public.is_tenant_member(tenant_id));
create policy conferencias_saldo_ins on public.conferencias_saldo for insert to authenticated
  with check (public.tenant_role(tenant_id) in ('owner', 'admin', 'financeiro') or public.is_platform_admin());
create policy conferencias_saldo_del on public.conferencias_saldo for delete to authenticated
  using (public.tenant_role(tenant_id) in ('owner', 'admin', 'financeiro') or public.is_platform_admin());

drop trigger if exists trg_set_tenant on public.conferencias_saldo;
create trigger trg_set_tenant before insert on public.conferencias_saldo
  for each row execute function public.set_tenant_id();

-- ============================================================================
-- 3) Data de fechamento das faturas de cartão: era gravada um mês antes (início
--    do ciclo). Competência 11/2026 com fechamento 26 = compras de 26/10 a 25/11,
--    fecha em 26/11. Vencimentos não mudam.
-- ============================================================================
update public.cartao_faturas f
   set data_fechamento = (date_trunc('month', f.competencia)
         + (least(c.dia_fechamento, extract(day from (date_trunc('month', f.competencia) + interval '1 month - 1 day'))::int) - 1)
           * interval '1 day')::date
  from public.contas c
 where c.id = f.cartao_id and c.dia_fechamento is not null;
