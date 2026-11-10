-- Receitas dos contratos ativos sempre lançadas para os próximos 12 meses
-- ("janela móvel"). Roda todo dia (pg_cron) e quando um contrato é criado/ativado.
-- - Contrato com data_fim: para nela (ou nos 12 meses, o que vier antes).
-- - Só cria o que falta: uma receita já existente no período (ligada ao contrato,
--   a uma cobrança dele, ou do mesmo cliente sem contrato e mesmo valor) conta.
-- - Contratos de uma mesma assinatura do Asaas cobrados numa receita só (ex.:
--   OMNEO + Krono = 979) seguem combinados; senão, uma receita por contrato.
-- - Descrição, categoria, conta e forma vêm da última receita da série.
-- - Contrato marcado com gerar_receitas = false fica de fora.

alter table public.contratos add column if not exists gerar_receitas boolean not null default true;

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
    -- Combinado: grupo com 2+ contratos cuja última receita tem a soma de todos.
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

      -- Modelo: última receita da série (descrição sem "(n/m)", categoria, conta, forma).
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
        -- Sem histórico: conta mais usada nas receitas da empresa.
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

-- Contrato criado, ativado ou com agenda alterada: completa a janela na hora.
create or replace function public.contratos_gerar_receitas_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ativo' and new.gerar_receitas then
    perform public.gerar_receitas_contratos(new.id, false);
  end if;
  return new;
end $$;

drop trigger if exists trg_contratos_gerar_receitas on public.contratos;
create trigger trg_contratos_gerar_receitas
  after insert or update of status, data_inicio, data_fim, dia_vencimento, recorrencia, gerar_receitas
  on public.contratos for each row execute function public.contratos_gerar_receitas_trg();

-- Todo dia às 06:00 (UTC) a janela anda um dia.
select cron.unschedule('contratos-janela-receitas')
where exists (select 1 from cron.job where jobname = 'contratos-janela-receitas');
select cron.schedule('contratos-janela-receitas', '0 6 * * *', $$select public.gerar_receitas_contratos()$$);

-- ============================================================================
-- Empresa (tenant_id) nas linhas inseridas sem usuário logado (webhook do Asaas,
-- edge functions com service role, cron): antes ficavam com tenant_id nulo e
-- sumiam para os membros da equipe. Ordem: conta ativa de quem está logado →
-- empresa do contrato → empresa do cliente → conta ativa do dono da linha.
-- ============================================================================
create or replace function public.set_tenant_id()
returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(new);
begin
  if new.tenant_id is null then
    new.tenant_id := coalesce(
      (select current_tenant_id from public.profiles where user_id = auth.uid()),
      (select tenant_id from public.contratos where id = (j->>'contrato_id')::uuid),
      (select tenant_id from public.clientes where id = (j->>'cliente_id')::uuid),
      (select current_tenant_id from public.profiles where user_id = (j->>'user_id')::uuid)
    );
  end if;
  return new;
end $$;

-- Corrige as receitas que já entraram sem empresa (categorias-padrão do sistema
-- não têm dono e continuam sem empresa, de propósito).
update public.receitas r
   set tenant_id = coalesce(
     (select tenant_id from public.contratos where id = r.contrato_id),
     (select tenant_id from public.clientes where id = r.cliente_id),
     (select current_tenant_id from public.profiles where user_id = r.user_id))
 where r.tenant_id is null;

-- Aplicado depois (10/11/2026): Digicont "Serviço de Conteúdo e Tráfego" fora da
-- geração até o dono decidir se o serviço continua; e a 1ª geração (108 receitas).
-- update public.contratos set gerar_receitas = false where id = '568bd1d9-d802-4875-8814-e768f440f212';
-- select count(*) from public.gerar_receitas_contratos();
