// Executa NO SERVIDOR o que a IARA preparou, para confirmar POR VOZ (Atalho do iPhone).
// Espelho do que o app faz ao tocar em "Confirmar":
//   - ações  → src/lib/acoesIara.ts (executarAcoes)
//   - lançamentos → src/lib/lancarItens.ts (salvarItens) + src/hooks/useDespesas.ts / useReceitas.ts
//   - cartão → src/hooks/useFaturas.ts + src/utils/faturaCalculator.ts
// Se mudar a regra lá, mude aqui também.
// Roda com o cliente do PRÓPRIO usuário (RLS), nunca com a service role.
// Excluir (despesa/receita), cancelar cobrança, excluir item da agenda, pagar fatura, contratos e
// lembrete de WhatsApp NÃO entram: só pelo card no app.
// deno-lint-ignore-file no-explicit-any

/** Tipos de ação que podem ser confirmados por voz. */
export const VOZ_OK = new Set([
  "cliente", "contrato", "cobranca", "compromisso", "tarefa",
  "concluir_tarefa", "alterar_agenda", "alterar_cobranca", "alterar_despesa",
  "dar_baixa", "alterar_receita", "alterar_categoria", "transferencia", "definir_meta", "definir_orcamento",
  "editar_lancamentos",
]);
export const soPeloApp = (a: any) => !VOZ_OK.has(a?.tipo);

export interface Ctx { db: any; userId: string; token: string; supabaseUrl: string; anonKey: string }
export interface Resultado { ok: boolean; mensagem: string }

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const hojeISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const CAMPOS_AGENDA = ["titulo", "data", "inicio", "fim", "dia_inteiro", "notas", "cliente_id", "lembrete_min"];

// ---------- datas (UTC, sem fuso) ----------
const ymd = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return { y, m: m - 1, d }; };
const diasNoMes = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const somaMes = (y: number, m: number, n: number) => { const t = y * 12 + m + n; return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 }; };
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const clamp = (y: number, m: number, d: number) => iso(y, m, Math.min(d, diasNoMes(y, m)));
function somaDias(base: string, n: number) { const { y, m, d } = ymd(base); const t = new Date(Date.UTC(y, m, d + n)); return t.toISOString().slice(0, 10); }
function somaMeses(base: string, n: number) { const { y, m, d } = ymd(base); const r = somaMes(y, m, n); return clamp(r.y, r.m, d); }

/** Igual a proximaDataSerie (lancarItens.ts). */
function proximaDataSerie(base: string, freq: string, i: number): string {
  switch (freq) {
    case "semanal": return somaDias(base, 7 * i);
    case "quinzenal": return somaDias(base, 15 * i);
    case "bimestral": return somaMeses(base, 2 * i);
    case "trimestral": return somaMeses(base, 3 * i);
    case "semestral": return somaMeses(base, 6 * i);
    case "anual": return somaMeses(base, 12 * i);
    default: return somaMeses(base, i);
  }
}

// ---------- cartão (espelho de faturaCalculator.ts / useFaturas.ts) ----------
/** Competência (1º dia do mês) da fatura de uma compra. */
function competenciaFatura(dataCompra: string, diaFech: number): string {
  const { y, m, d } = ymd(dataCompra);
  const fech = Math.min(diaFech, diasNoMes(y, m));
  const r = d >= fech ? somaMes(y, m, 1) : { y, m };
  return iso(r.y, r.m, 1);
}
function datasFatura(comp: string, diaFech: number, diaVenc: number, anchor: string | null) {
  const c = ymd(comp);
  const fechamento = clamp(c.y, c.m, diaFech);
  if (anchor) {
    const a = ymd(anchor);
    const ac = a.d > diaFech ? { y: a.y, m: a.m } : somaMes(a.y, a.m, -1);
    const diff = (c.y - ac.y) * 12 + (c.m - ac.m);
    const v = somaMes(a.y, a.m, diff);
    return { fechamento, vencimento: clamp(v.y, v.m, a.d) };
  }
  const fd = ymd(fechamento).d;
  const mv = diaVenc > fd ? { y: c.y, m: c.m } : somaMes(c.y, c.m, 1);
  return { fechamento, vencimento: clamp(mv.y, mv.m, diaVenc) };
}
const rotuloComp = (comp: string) => { const { y, m } = ymd(comp); return `${String(m + 1).padStart(2, "0")}/${y}`; };

async function faturaDaCompetencia(ctx: Ctx, cartao: any, comp: string): Promise<any | null> {
  if (cartao.tipo !== "cartao_credito" || !cartao.dia_fechamento || !cartao.dia_vencimento) return null;
  const { data: existente } = await ctx.db.from("cartao_faturas").select("*").eq("cartao_id", cartao.id).eq("competencia", comp).maybeSingle();
  if (existente) return existente;
  const { fechamento, vencimento } = datasFatura(comp, cartao.dia_fechamento, cartao.dia_vencimento, cartao.vencimento_anchor || null);
  const { data: nova, error } = await ctx.db.from("cartao_faturas").insert({
    user_id: ctx.userId, cartao_id: cartao.id, competencia: comp,
    data_fechamento: fechamento, data_vencimento: vencimento, status: "aberta", valor_total: 0, valor_pago: 0,
  }).select("*").single();
  if (error) { console.error("faturaDaCompetencia", error); return null; }
  return nova;
}

async function recalcularFatura(ctx: Ctx, faturaId: string) {
  const { data: fatura } = await ctx.db.from("cartao_faturas").select("*").eq("id", faturaId).single();
  if (!fatura) return;
  const { data: itens } = await ctx.db.from("despesas").select("valor").eq("fatura_id", faturaId);
  const total = (itens || []).reduce((s: number, l: any) => s + Number(l.valor), 0);
  const pago = Number(fatura.valor_pago);
  const status = total > 0 && pago >= total ? "paga" : pago > 0 && pago < total ? "parcialmente_paga" : "aberta";
  await ctx.db.from("cartao_faturas").update({ valor_total: total, status }).eq("id", faturaId);
  const { data: f } = await ctx.db.from("cartao_faturas").select("*").eq("id", faturaId).single();
  const { data: cartao } = await ctx.db.from("contas").select("*").eq("id", fatura.cartao_id).single();
  if (!f || !cartao) return;
  // Itens espelham o status da fatura.
  if (f.status === "paga") {
    const { data: pg } = await ctx.db.from("cartao_fatura_pagamentos").select("data_pagamento").eq("fatura_id", f.id)
      .order("data_pagamento", { ascending: false }).limit(1);
    await ctx.db.from("despesas").update({ status: "pago", data_pagamento: pg?.[0]?.data_pagamento || hojeISO() })
      .eq("fatura_id", f.id).neq("status", "pago");
  } else {
    await ctx.db.from("despesas").update({ status: "pendente", data_pagamento: null }).eq("fatura_id", f.id).neq("status", "pendente");
  }
  // Despesa-sombra '[fatura]' (o "a pagar" do mês).
  const restante = Number(f.valor_total) - Number(f.valor_pago);
  const descricao = `Fatura ${cartao.nome} – ${rotuloComp(f.competencia)}`;
  if (f.despesa_id) {
    await ctx.db.from("despesas").update({
      descricao, valor: Math.max(restante, 0), data_vencimento: f.data_vencimento, data_competencia: f.competencia,
      status: restante <= 0 ? "pago" : "pendente", fornecedor: "[fatura]", tipo: "fixa",
    }).eq("id", f.despesa_id);
    return;
  }
  if (restante <= 0) return;
  const { data: d } = await ctx.db.from("despesas").insert({
    user_id: ctx.userId, descricao, valor: restante, data_vencimento: f.data_vencimento, data_competencia: f.competencia,
    status: "pendente", tipo: "fixa", fornecedor: "[fatura]", conta_id: null,
  }).select("id").single();
  if (d?.id) await ctx.db.from("cartao_faturas").update({ despesa_id: d.id }).eq("id", f.id);
}

// ---------- lançamentos (espelho de salvarItens + createReceita/createDespesa) ----------
async function criarReceita(ctx: Ctx, f: any) {
  const { error } = await ctx.db.from("receitas").insert({
    user_id: ctx.userId, cliente_id: null, categoria_id: f.categoria_id || null, conta_id: f.conta_id || null,
    contrato_id: null, descricao: f.descricao, valor: f.valor, data_competencia: f.data_competencia,
    data_vencimento: f.data_vencimento, data_recebimento: f.data_recebimento || null, status: f.status,
    forma_pagamento: f.forma_pagamento || null, empresa_fonte: null,
  });
  if (error) throw error;
}
async function contaDe(ctx: Ctx, id: string | null) {
  if (!id) return null;
  const { data } = await ctx.db.from("contas").select("*").eq("id", id).maybeSingle();
  return data;
}
async function criarDespesa(ctx: Ctx, f: any) {
  const conta = await contaDe(ctx, f.conta_id);
  let fatura: any = null;
  if (conta?.tipo === "cartao_credito" && conta.dia_fechamento) {
    fatura = await faturaDaCompetencia(ctx, conta, competenciaFatura(f.data_competencia || f.data_vencimento, conta.dia_fechamento));
  }
  const { error } = await ctx.db.from("despesas").insert({
    user_id: ctx.userId, categoria_id: f.categoria_id || null, conta_id: f.conta_id || null, cliente_id: null,
    fornecedor: f.fornecedor || null, forma_pagamento: f.forma_pagamento || null, descricao: f.descricao, valor: f.valor,
    data_competencia: f.data_competencia, data_vencimento: fatura?.data_vencimento ?? f.data_vencimento,
    data_pagamento: fatura ? null : (f.data_pagamento || null), status: fatura ? "pendente" : f.status,
    tipo: f.tipo, fatura_id: fatura?.id ?? null, empresa_fonte: null,
  });
  if (error) throw error;
  if (fatura) await recalcularFatura(ctx, fatura.id);
}
async function criarDespesaParcelada(ctx: Ctx, f: any, n: number) {
  const N = Math.max(1, Math.floor(n || 1));
  const cartao = await contaDe(ctx, f.conta_id);
  if (N <= 1 || cartao?.tipo !== "cartao_credito" || !cartao.dia_fechamento) return criarDespesa(ctx, f);
  const total = Number(f.valor);
  const base = Math.round((total / N) * 100) / 100;
  const ultima = Math.round((total - base * (N - 1)) * 100) / 100;
  const grupo = crypto.randomUUID();
  const comp0 = competenciaFatura(f.data_competencia || f.data_vencimento, cartao.dia_fechamento);
  for (let i = 0; i < N; i++) {
    const comp = somaMeses(comp0, i);
    const fatura = await faturaDaCompetencia(ctx, cartao, comp);
    if (!fatura) throw new Error("não deu para gerar a fatura da parcela");
    const { error } = await ctx.db.from("despesas").insert({
      user_id: ctx.userId, categoria_id: f.categoria_id || null, conta_id: f.conta_id, cliente_id: null,
      fornecedor: f.fornecedor || null, forma_pagamento: f.forma_pagamento || null,
      descricao: `${f.descricao} (${i + 1}/${N})`, valor: i === N - 1 ? ultima : base,
      data_competencia: comp, data_vencimento: fatura.data_vencimento, data_pagamento: null, status: "pendente",
      tipo: f.tipo, fatura_id: fatura.id, empresa_fonte: null, parcela_num: i + 1, parcela_total: N, parcela_grupo_id: grupo,
    });
    if (error) throw error;
    await recalcularFatura(ctx, fatura.id);
  }
}

export async function salvarLancamentos(ctx: Ctx, itens: any[]): Promise<{ ok: number; total: number }> {
  let ok = 0;
  for (const it of itens || []) {
    try {
      const conta = await contaDe(ctx, it.conta_id);
      const card = conta?.tipo === "cartao_credito";
      const rep = it.recorrente ? Math.max(1, it.recorrente.repeticoes) : 1;
      if (it.tipo === "receita") {
        for (let i = 0; i < rep; i++) {
          const d = it.recorrente ? proximaDataSerie(it.data, it.recorrente.frequencia, i) : it.data;
          await criarReceita(ctx, {
            descricao: it.descricao, valor: it.valor, categoria_id: it.categoria_id, conta_id: it.conta_id,
            forma_pagamento: it.forma_pagamento, data_competencia: d, data_vencimento: d,
            data_recebimento: it.quitado ? d : null, status: it.quitado ? "recebido" : "pendente",
          });
        }
      } else {
        const base = {
          descricao: it.descricao, valor: it.valor, categoria_id: it.categoria_id, conta_id: it.conta_id,
          fornecedor: it.fornecedor, forma_pagamento: it.forma_pagamento, data_competencia: it.data, data_vencimento: it.data,
          data_pagamento: (!card && it.quitado) ? it.data : null, status: it.quitado ? "pago" : "pendente", tipo: "variavel",
        };
        if (card && it.parcelas && it.parcelas > 1) await criarDespesaParcelada(ctx, base, it.parcelas);
        else if (it.recorrente) {
          for (let i = 0; i < rep; i++) {
            const d = proximaDataSerie(it.data, it.recorrente.frequencia, i);
            await criarDespesa(ctx, { ...base, data_competencia: d, data_vencimento: d, data_pagamento: (!card && it.quitado) ? d : null });
          }
        } else await criarDespesa(ctx, base);
      }
      ok++;
    } catch (e) { console.error("salvarLancamentos", e); }
  }
  return { ok, total: (itens || []).length };
}

// ---------- ações (espelho de executarAcoes) ----------
async function chamarFuncao(ctx: Ctx, nome: string, body: unknown) {
  const r = await fetch(`${ctx.supabaseUrl}/functions/v1/${nome}`, {
    method: "POST", headers: { Authorization: `Bearer ${ctx.token}`, apikey: ctx.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let j: any = null; try { j = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok || j?.error) throw new Error(j?.error || `erro ${r.status}`);
  return j;
}
async function idDoCliente(ctx: Ctx, nome: string, criados: Map<string, string>): Promise<string | null> {
  const n = norm(nome);
  for (const [k, v] of criados) if (norm(k) === n || norm(k).includes(n) || n.includes(norm(k))) return v;
  const { data } = await ctx.db.from("clientes").select("id, nome").ilike("nome", `%${nome.replace(/[%_]/g, "")}%`).limit(5);
  const hit = (data || []).find((c: any) => norm(c.nome) === n) || (data || [])[0];
  return hit?.id ?? null;
}
async function listaPeloNome(ctx: Ctx, nome?: string | null): Promise<string | null> {
  const { data: integ } = await ctx.db.from("google_integracoes").select("tasklist_id, opcoes").maybeSingle();
  if (!integ?.tasklist_id) return null;
  const nomes = integ.opcoes?.listas_nomes || {};
  const ids = [...new Set([integ.tasklist_id, ...(integ.opcoes?.listas || [])])] as string[];
  const padrao = integ.opcoes?.lista_padrao && ids.includes(integ.opcoes.lista_padrao) ? integ.opcoes.lista_padrao : integ.tasklist_id;
  if (nome) {
    const n = norm(nome);
    const ls = ids.map((id) => ({ id, nome: nomes[id] || (id === integ.tasklist_id ? "BALANX" : "Lista") }));
    const hit = ls.find((l) => norm(l.nome) === n) || ls.find((l) => norm(l.nome).includes(n) || n.includes(norm(l.nome)));
    if (hit) return hit.id;
  }
  return padrao;
}

export async function executarAcoesVoz(ctx: Ctx, acoes: any[]): Promise<Resultado[]> {
  const res: Resultado[] = [];
  const criados = new Map<string, string>();
  const lista = (acoes || []).filter((a) => VOZ_OK.has(a?.tipo));
  const falha = (rot: string, e: unknown) => res.push({ ok: false, mensagem: `${rot}: ${e instanceof Error ? e.message : "não deu certo"}` });

  for (const a of lista.filter((x) => x.tipo === "cliente")) {
    try {
      if (a.existente) { criados.set(a.nome, a.existente.id); criados.set(a.existente.nome, a.existente.id); res.push({ ok: true, mensagem: `Usei o cadastro de ${a.existente.nome}.` }); continue; }
      const { data, error } = await ctx.db.from("clientes").insert({
        user_id: ctx.userId, nome: a.nome, cpf_cnpj: a.cpf_cnpj, email: a.email, telefone: a.telefone, endereco: a.endereco, tipo: a.pessoa,
      }).select("id").single();
      if (error) throw error;
      criados.set(a.nome, data.id);
      res.push({ ok: true, mensagem: `Cliente ${a.nome} cadastrado.` });
    } catch (e) { falha(`Cliente ${a.nome}`, e); }
  }
  for (const a of lista.filter((x) => x.tipo === "contrato")) {
    try {
      const clienteId = a.cliente_id || await idDoCliente(ctx, a.cliente_nome, criados);
      if (!clienteId) throw new Error(`não achei o cliente ${a.cliente_nome}`);
      const { data, error } = await ctx.db.from("contratos").insert({
        user_id: ctx.userId, cliente_id: clienteId, descricao: a.descricao, valor: a.valor, data_inicio: a.data_inicio,
        data_fim: a.data_fim, dia_vencimento: a.dia_vencimento, recorrencia: a.recorrencia, status: "ativo",
      }).select("id").single();
      if (error) throw error;
      let extra = "";
      if (a.cobrar_no_asaas) {
        try { await chamarFuncao(ctx, "asaas-cobranca", { action: "criar-contrato", contrato_id: data.id, forma_pagamento: a.forma, conta_id: null }); extra = " com cobrança mensal no Asaas"; }
        catch { extra = ", mas a assinatura no Asaas não saiu: crie em Contratos"; }
      }
      res.push({ ok: true, mensagem: `Contrato de ${a.cliente_nome} criado${extra}.` });
    } catch (e) { falha("Contrato", e); }
  }
  for (const a of lista.filter((x) => x.tipo === "cobranca")) {
    try {
      const clienteId = a.cliente_id || await idDoCliente(ctx, a.cliente_nome, criados);
      if (!clienteId) throw new Error(`não achei o cliente ${a.cliente_nome}`);
      if (a.parcelas && a.parcelas.length > 1) {
        await chamarFuncao(ctx, "asaas-cobranca", { action: "criar-avulsa-parcelada", cliente_id: clienteId, descricao: a.descricao, forma_pagamento: a.forma, conta_id: a.conta_id, parcelas: a.parcelas });
        res.push({ ok: true, mensagem: `${a.parcelas.length} cobranças de ${a.cliente_nome} criadas.` });
      } else {
        await chamarFuncao(ctx, "asaas-cobranca", { action: "criar-avulsa", cliente_id: clienteId, valor: a.valor, vencimento: a.vencimento, descricao: a.descricao, forma_pagamento: a.forma, conta_id: a.conta_id });
        res.push({ ok: true, mensagem: `Cobrança de ${a.cliente_nome} criada.` });
      }
    } catch (e) { falha("Cobrança", e); }
  }
  let mexeuAgenda = false;
  for (const a of lista.filter((x) => x.tipo === "compromisso" || x.tipo === "tarefa")) {
    try {
      const clienteId = a.cliente_id || (a.cliente_nome ? await idDoCliente(ctx, a.cliente_nome, criados) : null);
      const linha = a.tipo === "compromisso"
        ? { tipo: "compromisso", titulo: a.titulo, data: a.data, inicio: a.inicio, fim: a.fim, dia_inteiro: a.dia_inteiro, lembrete_min: a.lembrete_min, notas: a.notas, cliente_id: clienteId }
        : { tipo: "tarefa", titulo: a.titulo, data: a.data, notas: a.notas, cliente_id: clienteId, google_tasklist_id: await listaPeloNome(ctx, a.lista_nome) };
      const { error } = await ctx.db.from("agenda_itens").insert(linha);
      if (error) throw error;
      mexeuAgenda = true;
      res.push({ ok: true, mensagem: a.tipo === "compromisso" ? `Compromisso ${a.titulo} na agenda.` : `Tarefa ${a.titulo} criada.` });
    } catch (e) { falha(a.tipo === "compromisso" ? "Compromisso" : "Tarefa", e); }
  }
  for (const a of lista.filter((x) => x.tipo === "concluir_tarefa" || x.tipo === "alterar_agenda")) {
    try {
      let r: any;
      if (a.tipo === "concluir_tarefa") r = await ctx.db.from("agenda_itens").update({ concluida: a.concluida }).eq("id", a.item_id).eq("tipo", "tarefa").select("id");
      else {
        const upd: Record<string, unknown> = {};
        for (const k of CAMPOS_AGENDA) if (a.patch && k in a.patch) upd[k] = a.patch[k];
        if (a.item_tipo === "tarefa" && a.lista_nome) upd.google_tasklist_id = await listaPeloNome(ctx, a.lista_nome);
        r = await ctx.db.from("agenda_itens").update(upd).eq("id", a.item_id).select("id");
      }
      if (r.error) throw r.error;
      if (!r.data?.length) throw new Error("não encontrei mais esse item");
      mexeuAgenda = true;
      res.push({ ok: true, mensagem: a.tipo === "concluir_tarefa" ? `Tarefa ${a.titulo} ${a.concluida ? "concluída" : "reaberta"}.` : `${a.titulo} alterado.` });
    } catch (e) { falha("Agenda", e); }
  }
  if (mexeuAgenda) {
    const { data: integ } = await ctx.db.from("google_integracoes").select("tasklist_id").maybeSingle();
    if (integ) await chamarFuncao(ctx, "google-sync", { action: "sincronizar" }).catch(() => {});
  }
  for (const a of lista.filter((x) => x.tipo === "alterar_cobranca" || x.tipo === "alterar_despesa")) {
    try {
      if (a.tipo === "alterar_cobranca") {
        await chamarFuncao(ctx, "asaas-cobranca", { action: "alterar-cobranca", cobranca_id: a.cobranca_id, vencimento: a.novo_vencimento, valor: a.novo_valor });
        res.push({ ok: true, mensagem: `Cobrança de ${a.cliente_nome} alterada.` });
      } else {
        const upd: Record<string, unknown> = {};
        if (a.novo_valor) upd.valor = a.novo_valor;
        if (a.novo_vencimento) { upd.data_vencimento = a.novo_vencimento; upd.status = a.novo_vencimento >= hojeISO() ? "pendente" : "atrasado"; }
        const { data, error } = await ctx.db.from("despesas").update(upd).eq("id", a.despesa_id).in("status", ["pendente", "atrasado"]).select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("ela já não está em aberto");
        res.push({ ok: true, mensagem: `Despesa ${a.descricao} alterada.` });
      }
    } catch (e) { falha(a.tipo === "alterar_despesa" ? "Despesa" : "Cobrança", e); }
  }
  // Espelho de executarExtra (src/lib/acoesIara.ts) para os tipos liberados por voz.
  for (const a of lista) {
    try {
      if (a.tipo === "dar_baixa") {
        if (a.via_asaas && a.cobranca_id) {
          await chamarFuncao(ctx, "asaas-cobranca", { action: "receber-manual", cobranca_id: a.cobranca_id, data_pagamento: a.data, valor: a.valor_recebido ?? undefined, forma_pagamento: a.forma_pagamento ?? undefined });
        } else {
          const upd: Record<string, unknown> = a.lanc === "receita" ? { status: "recebido", data_recebimento: a.data } : { status: "pago", data_pagamento: a.data };
          if (a.conta_id) upd.conta_id = a.conta_id;
          if (a.valor_recebido) upd.valor = a.valor_recebido;
          if (a.forma_pagamento) upd.forma_pagamento = a.forma_pagamento;
          const { data, error } = await ctx.db.from(a.lanc === "receita" ? "receitas" : "despesas").update(upd).eq("id", a.item_id).in("status", ["pendente", "atrasado"]).select("id");
          if (error) throw error;
          if (!data?.length) throw new Error("já não está em aberto");
        }
        res.push({ ok: true, mensagem: `${a.descricao} ${a.lanc === "receita" ? "recebida" : "paga"}.` });
      } else if (a.tipo === "alterar_receita") {
        const upd: Record<string, unknown> = {};
        if (a.novo_valor) upd.valor = a.novo_valor;
        if (a.nova_descricao) upd.descricao = a.nova_descricao;
        if (a.novo_vencimento) { upd.data_vencimento = a.novo_vencimento; upd.status = a.novo_vencimento >= hojeISO() ? "pendente" : "atrasado"; }
        const { data, error } = await ctx.db.from("receitas").update(upd).eq("id", a.receita_id).in("status", ["pendente", "atrasado"]).select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("ela já não está em aberto");
        res.push({ ok: true, mensagem: `Receita ${a.descricao} alterada.` });
      } else if (a.tipo === "alterar_categoria") {
        const { data, error } = await ctx.db.from(a.lanc === "receita" ? "receitas" : "despesas").update({ categoria_id: a.categoria_id }).in("id", a.ids).select("id");
        if (error) throw error;
        res.push({ ok: true, mensagem: `${data?.length ?? 0} lançamento(s) em ${a.categoria_nome}.` });
      } else if (a.tipo === "editar_lancamentos") {
        // Igual ao app (src/lib/acoesIara.ts): só colunas permitidas; mesma mudança = uma gravação.
        const PERMITIDOS = a.lanc === "receita"
          ? ["descricao", "valor", "data_vencimento", "data_competencia", "data_recebimento", "status", "categoria_id", "conta_id", "cliente_id", "forma_pagamento"]
          : ["descricao", "valor", "data_vencimento", "data_competencia", "data_pagamento", "status", "categoria_id", "conta_id", "cliente_id", "forma_pagamento", "fornecedor"];
        const grupos = new Map<string, { patch: Record<string, unknown>; ids: string[] }>();
        for (const it of a.itens || []) {
          const patch: Record<string, unknown> = {};
          for (const k of PERMITIDOS) if (it.patch && k in it.patch) patch[k] = it.patch[k];
          if (!Object.keys(patch).length) continue;
          const chave = JSON.stringify(patch);
          const g = grupos.get(chave) || { patch, ids: [] };
          g.ids.push(it.id); grupos.set(chave, g);
        }
        let n = 0; const faturas = new Set<string>();
        for (const g of grupos.values()) {
          const { data, error } = await ctx.db.from(a.lanc === "receita" ? "receitas" : "despesas").update(g.patch).in("id", g.ids)
            .select(a.lanc === "receita" ? "id" : "id, fatura_id");
          if (error) throw error;
          n += data?.length ?? 0;
          for (const r of data || []) if (r.fatura_id) faturas.add(r.fatura_id);
        }
        for (const f of faturas) await recalcularFatura(ctx, f);
        res.push({ ok: true, mensagem: `${n} lançamento${n === 1 ? "" : "s"} alterado${n === 1 ? "" : "s"}.` });
      } else if (a.tipo === "transferencia") {
        if (a.conta_origem_id === a.conta_destino_id || !(Number(a.valor) > 0)) throw new Error("transferência inválida");
        const { error } = await ctx.db.from("transferencias").insert({ user_id: ctx.userId, conta_origem_id: a.conta_origem_id, conta_destino_id: a.conta_destino_id, valor: a.valor, descricao: a.descricao || null, data_transferencia: a.data });
        if (error) throw error;
        res.push({ ok: true, mensagem: `Transferência de ${a.origem_nome} para ${a.destino_nome} registrada.` });
      } else if (a.tipo === "definir_orcamento") {
        const { data, error } = await ctx.db.from("categorias").update({ orcamento_mensal: a.valor }).eq("id", a.categoria_id).select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("não achei a categoria");
        res.push({ ok: true, mensagem: a.valor ? `Orçamento de ${a.categoria_nome} definido.` : `Orçamento de ${a.categoria_nome} removido.` });
      } else if (a.tipo === "definir_meta") {
        const { data: ex } = await ctx.db.from("metas").select("id").eq("tipo", "faturamento").eq("periodo", a.periodo).maybeSingle();
        const { error } = ex
          ? await ctx.db.from("metas").update({ valor_meta: a.valor }).eq("id", ex.id)
          : await ctx.db.from("metas").insert({ user_id: ctx.userId, tipo: "faturamento", periodo: a.periodo, valor_meta: a.valor });
        if (error) throw error;
        res.push({ ok: true, mensagem: "Meta atualizada." });
      }
    } catch (e) { falha(a.tipo === "dar_baixa" ? "Baixa" : a.tipo === "transferencia" ? "Transferência" : a.tipo === "definir_meta" ? "Meta" : a.tipo === "definir_orcamento" ? "Orçamento" : a.tipo === "alterar_categoria" ? "Categoria" : a.tipo === "editar_lancamentos" ? "Edição" : "Receita", e); }
  }
  return res;
}

/** Só para teste: compara com src/utils/faturaCalculator.ts e src/lib/lancarItens.ts. */
export const _datas = { competenciaFatura, datasFatura, proximaDataSerie };
