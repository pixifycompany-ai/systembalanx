// Indicadores de negócio para a IARA — MESMAS fórmulas das telas do app, portadas de:
//   src/hooks/useDashboard.ts   → MRR, receita anual projetada, LTV (Visão / Início)
//   src/hooks/useAnalises.ts    → LTV evolução, churn, coortes, projeção 6m, rentabilidade, saúde
//   src/hooks/useAdvancedReports.ts → MRR 12m, ABC, categorias, aging, burn/runway, margem,
//                                     LTV/CAC, cartões, conciliação, KPIs, projeção 12m, fiscal
//   src/hooks/useRelatorios.ts  → DRE (competência), Rec × Desp, fluxo realizado, comparativo
//   src/hooks/useDFC.ts         → DFC (caixa)
//   src/utils/contractUtils.ts  → vigência, pausa, valor mensal equivalente, aditivos
// Se mudar uma fórmula lá, mude aqui também.
//
// Datas: o app calcula no navegador (horário de Brasília). Aqui o relógio é deslocado
// para a hora de São Paulo e as datas ISO são lidas como "hora local" do servidor —
// assim startOfMonth/differenceInDays etc. dão o mesmo resultado que no navegador.
import {
  addMonths, differenceInDays, differenceInMonths, endOfMonth, format, parseISO,
  startOfDay, startOfMonth, subMonths,
} from "npm:date-fns@3.6.0";
import { ptBR } from "npm:date-fns@3.6.0/locale";

// deno-lint-ignore no-explicit-any
type DB = any;
// deno-lint-ignore no-explicit-any
type Row = any;

export const GRUPOS_INDICADORES = [
  "recorrencia", "clientes", "rentabilidade", "saude", "projecao", "resultado", "dre", "dfc",
  "comparativo", "categorias", "abc", "aging", "caixa", "conciliacao", "cartoes", "kpis", "fiscal", "margem",
] as const;
export type GrupoIndicador = typeof GRUPOS_INDICADORES[number];

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Agora" no relógio de São Paulo (Brasil sem horário de verão desde 2019). */
function agoraBR(): Date {
  const offsetServidorMin = new Date().getTimezoneOffset(); // UTC → 0
  return new Date(Date.now() + (offsetServidorMin - 180) * 60000);
}

/** Lê todas as linhas (o PostgREST corta em 1000 por página). */
async function todas(q: () => Row, porPagina = 1000, max = 20000): Promise<Row[]> {
  const out: Row[] = [];
  for (let de = 0; de < max; de += porPagina) {
    try {
      const { data, error } = await q().range(de, de + porPagina - 1);
      if (error || !data) break;
      out.push(...data);
      if (data.length < porPagina) break;
    } catch (_e) { break; }
  }
  return out;
}

// ===================== contractUtils (porte 1:1) =====================
function dataFimEfetiva(c: Row, agora: Date): Date | null {
  if (c.data_inativacao) return parseISO(c.data_inativacao);
  if (c.data_fim) return parseISO(c.data_fim);
  if (c.status === "cancelado" || c.status === "encerrado") return agora;
  return null;
}
function pausaCobre(c: Row, de: Date, ate: Date): boolean {
  if (!c.pausado_desde) return false;
  const p0 = parseISO(c.pausado_desde);
  const p1 = c.pausado_ate ? parseISO(c.pausado_ate) : null;
  return p0 <= startOfDay(de) && (!p1 || p1 >= startOfDay(ate));
}
function ativoNoPeriodo(c: Row, ini: Date, fim: Date, agora: Date): boolean {
  const inicio = parseISO(c.data_inicio);
  const f = dataFimEfetiva(c, agora);
  if (pausaCobre(c, ini, fim)) return false;
  return inicio <= fim && (!f || f >= ini);
}
function ativoHoje(c: Row, agora: Date): boolean {
  if (c.status !== "ativo") return false;
  const hoje = startOfDay(agora);
  const inicio = parseISO(c.data_inicio);
  const f = dataFimEfetiva(c, agora);
  if (pausaCobre(c, hoje, hoje)) return false;
  return inicio <= hoje && (!f || startOfDay(f) >= hoje);
}
function mensalEquivalente(valor: number, rec: string): number {
  switch (rec) {
    case "semanal": return valor * (52 / 12);
    case "quinzenal": return valor * 2;
    case "mensal": return valor;
    case "trimestral": return valor / 3;
    case "semestral": return valor / 6;
    case "anual": return valor / 12;
    case "unico": return 0;
    default: return valor;
  }
}
function valorVigente(c: Row, aditivos: Row[], data: Date): number {
  const ads = aditivos.filter((a) => a.contrato_id === c.id);
  if (!ads.length) return Number(c.valor);
  const ds = format(data, "yyyy-MM-dd");
  const ok = ads.filter((a) => a.data_vigencia <= ds).sort((a, b) => b.data_vigencia.localeCompare(a.data_vigencia));
  if (ok.length) return Number(ok[0].valor_novo);
  const first = [...ads].sort((a, b) => a.data_vigencia.localeCompare(b.data_vigencia))[0];
  return Number(first.valor_anterior);
}
const mensalNaData = (c: Row, ads: Row[], d: Date) => mensalEquivalente(valorVigente(c, ads, d), c.recorrencia);
function mesesRelacionamento(c: Row, ref: Date, agora: Date): number {
  const inicio = parseISO(c.data_inicio);
  const f = dataFimEfetiva(c, agora);
  const final = f && f < ref ? f : ref;
  return Math.max(1, differenceInMonths(final, inicio) + 1);
}
function clientesAtivosNoPeriodo(contratos: Row[], ini: Date, fim: Date, agora: Date): Set<string> {
  const s = new Set<string>();
  contratos.forEach((c) => { if (ativoNoPeriodo(c, ini, fim, agora)) s.add(c.cliente_id); });
  return s;
}

// ===================== cálculo =====================
export async function calcularIndicadores(
  supabase: DB,
  opts: { inicio?: string; fim?: string; grupos?: string[] },
): Promise<Record<string, unknown>> {
  const agora = agoraBR();
  const hoje = startOfDay(agora);
  const hojeISO = format(agora, "yyyy-MM-dd");
  // Período padrão = o padrão da tela Relatórios ("Este ano": 1/jan a 31/dez).
  const inicioISO = /^\d{4}-\d{2}-\d{2}$/.test(opts.inicio || "") ? opts.inicio! : `${agora.getFullYear()}-01-01`;
  const fimISO = /^\d{4}-\d{2}-\d{2}$/.test(opts.fim || "") ? opts.fim! : `${agora.getFullYear()}-12-31`;
  const pStart = parseISO(inicioISO);
  const pEnd = parseISO(fimISO);
  const pedidos = new Set((opts.grupos?.length ? opts.grupos : ["recorrencia", "clientes", "saude"]).filter((g) => (GRUPOS_INDICADORES as readonly string[]).includes(g)));

  // ---- dados (carregados sob demanda e compartilhados entre os blocos) ----
  const memo = new Map<string, Promise<Row[]>>();
  const carga = (k: string, f: () => Promise<Row[]>) => { if (!memo.has(k)) memo.set(k, f()); return memo.get(k)!; };
  const receitas = () => carga("rec", () => todas(() => supabase.from("receitas")
    .select("id, valor, status, descricao, data_competencia, data_vencimento, data_recebimento, contrato_id, cliente_id, conta_id, categoria_id, empresa_fonte, cliente:clientes(id, nome, empresa_fonte), categoria:categorias(nome, cor, grupo_dre, empresa_fonte)")
    .order("id")));
  const despesas = () => carga("desp", () => todas(() => supabase.from("despesas")
    .select("id, valor, status, tipo, descricao, data_competencia, data_vencimento, data_pagamento, categoria_id, cliente_id, conta_id, fatura_id, fornecedor, categoria:categorias(nome, cor, grupo_dre)")
    .order("id")));
  const contratos = () => carga("contr", () => todas(() => supabase.from("contratos")
    .select("id, cliente_id, data_inicio, data_fim, data_inativacao, status, valor, recorrencia, pausado_desde, pausado_ate, cliente:clientes(id, nome)")
    .order("id")));
  const aditivos = () => carga("adit", () => todas(() => supabase.from("contrato_aditivos")
    .select("contrato_id, valor_anterior, valor_novo, data_vigencia").order("data_vigencia", { ascending: false })));
  const clientes = () => carga("cli", () => todas(() => supabase.from("clientes").select("id, nome, status, created_at").order("id")));
  const contas = () => carga("contas", () => todas(() => supabase.from("contas").select("id, nome, tipo, saldo_inicial, limite, bandeira, ativa").order("id")));
  const faturas = () => carga("fat", () => todas(() => supabase.from("cartao_faturas").select("id, cartao_id, valor_total, valor_pago, status, despesa_id").order("id")));
  const fatPag = () => carga("fatpag", () => todas(() => supabase.from("cartao_fatura_pagamentos").select("fatura_id, despesa_id").order("fatura_id")));
  const transf = () => carga("transf", () => todas(() => supabase.from("transferencias").select("valor, conta_origem_id, conta_destino_id, data_transferencia").order("data_transferencia")));

  const ehDistribuicao = (d: Row) => d.categoria?.grupo_dre === "distribuicao_lucro";
  const isCompetencia = (d: Row) => d.fornecedor !== "[fatura]" && d.fornecedor !== "[pagamento-fatura]";
  const mesLabel = (d: Date, fmt = "MMM/yy") => cap(format(d, fmt, { locale: ptBR }));
  const out: Record<string, unknown> = {
    hoje: hojeISO,
    periodo: { inicio: inicioISO, fim: fimISO, obs: "Só vale para os blocos que usam período (resultado, dre, dfc, categorias, abc, margem, kpis, LTV/CAC). Os outros são sempre 'hoje' ou séries fixas, como nas telas." },
  };

  // ============ bloco: dados das Análises (compartilhado por clientes/rentabilidade/saude/projecao) ============
  let analisesCache: Record<string, Row> | null = null;
  async function analises() {
    if (analisesCache) return analisesCache;
    const [rec, desp, contr, ads, cts] = await Promise.all([receitas(), despesas(), contratos(), aditivos(), contas()]);
    const contasAtivas = cts.filter((c) => c.ativa === true);
    const today = agora; // useAnalises usa new Date() (com hora)

    // LTV evolução 12m
    const ltvEvolucao: Row[] = [];
    for (let i = 11; i >= 0; i--) {
      const md = subMonths(today, i); const ms = startOfMonth(md); const me = endOfMonth(md);
      const porCli: Record<string, { v: number; m: number }> = {};
      contr.filter((c) => c.recorrencia !== "unico" && ativoNoPeriodo(c, ms, me, agora)).forEach((c) => {
        const v = mensalNaData(c, ads, me); const m = mesesRelacionamento(c, me, agora);
        porCli[c.cliente_id] ||= { v: 0, m: 0 };
        porCli[c.cliente_id].v += v;
        if (m > porCli[c.cliente_id].m) porCli[c.cliente_id].m = m;
      });
      const n = Object.keys(porCli).length;
      const vals = Object.values(porCli);
      ltvEvolucao.push({ mes: mesLabel(md), ltv: r2(n ? vals.reduce((s, d) => s + d.v * d.m, 0) / n : 0), ticket_medio: r2(n ? vals.reduce((s, d) => s + d.v, 0) / n : 0), clientes_ativos: n });
    }

    // Churn (6m; métrica principal = último mês COMPLETO)
    const hist: Row[] = []; let perdidosUlt = 0; let novosUlt = 0;
    for (let i = 5; i >= 0; i--) {
      const md = subMonths(today, i);
      const prev = clientesAtivosNoPeriodo(contr, startOfMonth(subMonths(md, 1)), endOfMonth(subMonths(md, 1)), agora);
      const curr = clientesAtivosNoPeriodo(contr, startOfMonth(md), endOfMonth(md), agora);
      let perdidos = 0; prev.forEach((id) => { if (!curr.has(id)) perdidos++; });
      let novos = 0; curr.forEach((id) => { if (!prev.has(id)) novos++; });
      hist.push({ mes: cap(format(md, "MMM", { locale: ptBR })), taxa_pct: r2(prev.size ? (perdidos / prev.size) * 100 : 0), perdidos, novos, base_mes_anterior: prev.size });
      if (i === 1) { perdidosUlt = perdidos; novosUlt = novos; }
    }
    const ativosHoje = new Set<string>(); contr.forEach((c) => { if (ativoHoje(c, agora)) ativosHoje.add(c.cliente_id); });
    const churnTaxa = hist.length >= 2 ? hist[hist.length - 2].taxa_pct : 0;

    // Coortes (últimas 6 turmas, retenção mês 0..6)
    const primeiro: Record<string, Date> = {};
    contr.forEach((c) => { const d = parseISO(c.data_inicio); if (!primeiro[c.cliente_id] || d < primeiro[c.cliente_id]) primeiro[c.cliente_id] = d; });
    const turmas: Record<string, string[]> = {};
    Object.entries(primeiro).forEach(([id, d]) => { const k = format(d, "yyyy-MM"); (turmas[k] ||= []).push(id); });
    const coortes = Object.keys(turmas).sort().slice(-6).map((k) => {
      const ids = turmas[k]; const cd = parseISO(k + "-01");
      const ret: (number | null)[] = [];
      for (let m = 0; m <= 6; m++) {
        const chk = addMonths(cd, m);
        if (chk > today) { ret.push(null); continue; }
        const cs = startOfMonth(chk); const ce = endOfMonth(chk);
        let retidos = 0;
        ids.forEach((id) => {
          if (contr.some((c) => {
            if (c.cliente_id !== id) return false;
            const ini = parseISO(c.data_inicio);
            const f = c.data_inativacao ? parseISO(c.data_inativacao) : (c.data_fim ? parseISO(c.data_fim) : null);
            return ini <= ce && (!f || f >= cs);
          })) retidos++;
        });
        ret.push(Math.round(ids.length ? (retidos / ids.length) * 100 : 0));
      }
      return { turma: mesLabel(cd), clientes_iniciais: ids.length, retencao_pct_por_mes: ret };
    });

    // MRR atual (com aditivos) — usado na projeção e na saúde
    const mrrAtual = contr.filter((c) => c.recorrencia !== "unico" && ativoHoje(c, agora)).reduce((s, c) => s + mensalNaData(c, ads, today), 0);

    // Projeção de receita 6m
    let somaVar = 0;
    for (let i = 2; i >= 0; i--) {
      const md = subMonths(today, i); const ms = startOfMonth(md); const me = endOfMonth(md);
      somaVar += rec.filter((r) => { const d = r.data_recebimento ? parseISO(r.data_recebimento) : null; return r.status === "recebido" && !r.contrato_id && d && d >= ms && d <= me; }).reduce((s, r) => s + Number(r.valor), 0);
    }
    const mediaVar = somaVar / 3;
    const projecao6m = [1, 2, 3, 4, 5, 6].map((i) => {
      const rr = mrrAtual * Math.pow(1.03, i);
      return { mes: mesLabel(addMonths(today, i)), recorrente: r2(rr), variavel: r2(mediaVar), total: r2(rr + mediaVar) };
    });

    // Rentabilidade por cliente (todo o histórico)
    const pagas = desp.filter((d) => d.status === "pago" && !d.fatura_id && !ehDistribuicao(d));
    const diretas: Record<string, number> = {}; let naoVinc = 0;
    pagas.forEach((d) => { const v = Number(d.valor); if (d.cliente_id) diretas[d.cliente_id] = (diretas[d.cliente_id] || 0) + v; else naoVinc += v; });
    const recCli: Record<string, { v: number; nome: string }> = {};
    rec.forEach((r) => { if (r.cliente_id && r.status === "recebido") { recCli[r.cliente_id] ||= { v: 0, nome: r.cliente?.nome || "Sem nome" }; recCli[r.cliente_id].v += Number(r.valor); } });
    const recTotal = Object.values(recCli).reduce((s, c) => s + c.v, 0);
    const contrCli: Record<string, { primeiro: Date; ativo: boolean; fim: Date | null }> = {};
    contr.forEach((c) => {
      const ini = parseISO(c.data_inicio);
      const f = c.data_inativacao ? parseISO(c.data_inativacao) : (c.data_fim ? parseISO(c.data_fim) : null);
      const x = contrCli[c.cliente_id];
      if (!x) contrCli[c.cliente_id] = { primeiro: ini, ativo: c.status === "ativo", fim: f };
      else { if (ini < x.primeiro) x.primeiro = ini; if (c.status === "ativo") x.ativo = true; if (f && (!x.fim || f > x.fim)) x.fim = f; }
    });
    const rentab = Object.entries(recCli).map(([id, d]) => {
      const custo = (diretas[id] || 0) + naoVinc * (recTotal > 0 ? d.v / recTotal : 0);
      const lucro = d.v - custo;
      let tempo = 0;
      if (contrCli[id]) { const c = contrCli[id]; tempo = differenceInMonths(c.ativo ? today : (c.fim || today), c.primeiro) + 1; }
      return { cliente: d.nome, receita_recebida: r2(d.v), custo_direto: r2(diretas[id] || 0), custo_rateado: r2(custo - (diretas[id] || 0)), custo_total: r2(custo), lucro: r2(lucro), margem_pct: r2(d.v > 0 ? (lucro / d.v) * 100 : 0), meses_relacionamento: tempo };
    }).sort((a, b) => b.receita_recebida - a.receita_recebida);

    // Saúde financeira
    const cms = startOfMonth(today); const cme = endOfMonth(today);
    const pms = startOfMonth(subMonths(today, 1)); const pme = endOfMonth(subMonths(today, 1));
    const recebidoEntre = (a: Date, b: Date) => rec.filter((r) => { const d = r.data_recebimento ? parseISO(r.data_recebimento) : null; return r.status === "recebido" && d && d >= a && d <= b; }).reduce((s, r) => s + Number(r.valor), 0);
    const pagoOperEntre = (a: Date, b: Date) => desp.filter((d) => { const dt = d.data_pagamento ? parseISO(d.data_pagamento) : null; return d.status === "pago" && !d.fatura_id && !ehDistribuicao(d) && dt && dt >= a && dt <= b; }).reduce((s, d) => s + Number(d.valor), 0);
    let recMes = recebidoEntre(cms, cme); let despMes = pagoOperEntre(cms, cme); let usouMesAnterior = false;
    if (recMes === 0) { recMes = recebidoEntre(pms, pme); despMes = pagoOperEntre(pms, pme); usouMesAnterior = true; }
    const margem = recMes > 0 ? ((recMes - despMes) / recMes) * 100 : 0;
    const sMargem = Math.min(100, Math.max(0, margem * 2));
    const tresMeses = startOfMonth(subMonths(today, 2));
    const noPer = rec.filter((r) => { const v = parseISO(r.data_vencimento); return v >= tresMeses && v < today; });
    const vencidoAberto = (r: Row) => r.status === "atrasado" || (r.status === "pendente" && parseISO(r.data_vencimento) < today);
    const valAtras = noPer.filter(vencidoAberto).reduce((s, r) => s + Number(r.valor), 0);
    const valVenc = noPer.filter((r) => vencidoAberto(r) || r.status === "recebido").reduce((s, r) => s + Number(r.valor), 0);
    const inad = valVenc > 0 ? (valAtras / valVenc) * 100 : 0;
    const sInad = Math.max(0, 100 - inad * 2);
    const mrrAnt = contr.filter((c) => c.recorrencia !== "unico" && ativoNoPeriodo(c, pms, pme, agora)).reduce((s, c) => s + mensalNaData(c, ads, pme), 0);
    const cresc = mrrAnt > 0 ? ((mrrAtual - mrrAnt) / mrrAnt) * 100 : 0;
    const sCresc = Math.min(100, Math.max(0, 50 + cresc * 5));
    const sChurn = Math.max(0, 100 - churnTaxa * 10);
    const caixa = contasAtivas.reduce((s, c) => s + Number(c.saldo_inicial || 0), 0)
      + rec.filter((r) => r.status === "recebido").reduce((s, r) => s + Number(r.valor), 0)
      - desp.filter((d) => d.status === "pago" && !d.fatura_id).reduce((s, d) => s + Number(d.valor), 0);
    const saidaMes = desp.filter((d) => { const dt = d.data_pagamento ? parseISO(d.data_pagamento) : null; return d.status === "pago" && !d.fatura_id && dt && dt >= cms && dt <= cme; }).reduce((s, d) => s + Number(d.valor), 0);
    const despDia = (saidaMes || despMes) / 30;
    const dias = despDia > 0 ? caixa / despDia : 90;
    const sLiq = Math.min(100, (dias / 90) * 100);
    const fatores = [
      { fator: "Margem Líquida", valor: r2(margem), unidade: "%", peso: 25, nota_0a100: r2(sMargem), pontos: r2(sMargem * 0.25), regra: "nota = margem × 2 (máx 100). Margem de 50% ou mais = nota cheia." },
      { fator: "Inadimplência", valor: r2(inad), unidade: "% do valor vencido nos últimos 3 meses ainda em aberto", peso: 20, nota_0a100: r2(sInad), pontos: r2(sInad * 0.2), regra: "nota = 100 − inadimplência × 2" },
      { fator: "Crescimento MRR", valor: r2(cresc), unidade: "% vs mês anterior", peso: 20, nota_0a100: r2(sCresc), pontos: r2(sCresc * 0.2), regra: "nota = 50 + crescimento × 5 (0 a 100). Crescer 10% no mês = nota cheia; estável = 50." },
      { fator: "Retenção", valor: r2(100 - churnTaxa), unidade: "% (100 − churn)", peso: 15, nota_0a100: r2(sChurn), pontos: r2(sChurn * 0.15), regra: "nota = 100 − churn × 10" },
      { fator: "Liquidez", valor: r2(dias), unidade: "dias de caixa", peso: 20, nota_0a100: r2(sLiq), pontos: r2(sLiq * 0.2), regra: "nota = dias de caixa ÷ 90 × 100 (90 dias ou mais = nota cheia)" },
    ];
    const score = fatores.reduce((s, f) => s + f.pontos, 0);
    const categoria = score >= 80 ? "excelente" : score >= 60 ? "bom" : score >= 40 ? "atencao" : "critico";

    analisesCache = {
      ltvEvolucao, churn: { taxa_mensal_pct: churnTaxa, clientes_perdidos: perdidosUlt, clientes_novos: novosUlt, clientes_ativos_hoje: ativosHoje.size, historico_6m: hist },
      coortes, mrrAtual, mrrAnt, projecao6m, mediaVar, rentab,
      saude: { score: Math.round(score), categoria, faixas: "0–39 crítico · 40–59 atenção · 60–79 bom · 80–100 excelente", fatores, base_margem: { recebido: r2(recMes), pago_sem_distribuicao: r2(despMes), mes_usado: usouMesAnterior ? "mês anterior (o atual ainda não teve recebimento)" : "mês atual" }, base_liquidez: { caixa_estimado: r2(caixa), saida_media_dia: r2(despDia) } },
    };
    return analisesCache;
  }

  // ============ bloco: Relatórios avançados (período) ============
  let advCache: Record<string, Row> | null = null;
  async function avancados() {
    if (advCache) return advCache;
    const [recAllRaw, despAllRaw, contr, cli, cts, fats] = await Promise.all([receitas(), despesas(), contratos(), clientes(), contas(), faturas()]);
    const today = agora;
    const since12 = startOfMonth(subMonths(today, 11));
    const sinceStr = format(pStart < since12 ? pStart : since12, "yyyy-MM-dd");
    const inP = (ds?: string | null) => { if (!ds) return false; const d = parseISO(ds); return d >= pStart && d <= pEnd; };
    const rec = recAllRaw.filter((r) => r.data_competencia >= sinceStr);
    const desp = despAllRaw.filter((d) => d.data_competencia >= sinceStr);
    const contasAtivas = cts.filter((c) => c.ativa === true);
    const recRecebidas = recAllRaw.filter((r) => r.status === "recebido");
    const despPagas = despAllRaw.filter((d) => d.status === "pago");
    const despReais = desp.filter(isCompetencia);
    const recP = rec.filter((r) => inP(r.data_competencia));
    const despReaisP = despReais.filter((d) => inP(d.data_competencia));
    const mk = (d: Date) => mesLabel(d);

    // MRR 12m (só data_inativacao como fim, sem status/pausa — igual à tela)
    const mrr12: Row[] = [];
    for (let i = 11; i >= 0; i--) {
      const m = startOfMonth(subMonths(today, i)); const me = endOfMonth(m);
      const mens = (c: Row) => mensalEquivalente(Number(c.valor), c.recorrencia);
      const ativos = contr.filter((c) => { const ini = c.data_inicio ? parseISO(c.data_inicio) : null; const f = c.data_inativacao ? parseISO(c.data_inativacao) : null; if (!ini || ini > me) return false; if (f && f < m) return false; return c.recorrencia !== "unico"; });
      const mrr = ativos.reduce((s, c) => s + mens(c), 0);
      const novo = contr.filter((c) => c.recorrencia !== "unico" && c.data_inicio && parseISO(c.data_inicio) >= m && parseISO(c.data_inicio) <= me).reduce((s, c) => s + mens(c), 0);
      const perdido = contr.filter((c) => c.recorrencia !== "unico" && c.data_inativacao && parseISO(c.data_inativacao) >= m && parseISO(c.data_inativacao) <= me).reduce((s, c) => s + mens(c), 0);
      mrr12.push({ mes: mk(m), mrr: r2(mrr), arr: r2(mrr * 12), mrr_novo: r2(novo), mrr_perdido: r2(perdido) });
    }

    // ABC
    const cmap = new Map<string, { nome: string; total: number }>();
    recP.forEach((r) => { if (!r.cliente_id) return; const cur = cmap.get(r.cliente_id) ?? { nome: r.cliente?.nome || "Sem cliente", total: 0 }; cur.total += Number(r.valor); cmap.set(r.cliente_id, cur); });
    const sorted = [...cmap.entries()].sort((a, b) => b[1].total - a[1].total);
    const grand = sorted.reduce((s, [, v]) => s + v.total, 0);
    let cum = 0;
    const abc = sorted.map(([, v]) => { const share = grand > 0 ? v.total / grand : 0; cum += share; return { cliente: v.nome, total: r2(v.total), participacao_pct: r2(share * 100), acumulado_pct: r2(cum * 100), classe: cum <= 0.8 ? "A" : cum <= 0.95 ? "B" : "C" }; });

    // Categorias
    const porCat = (rows: Row[]) => {
      const m = new Map<string, { nome: string; total: number }>();
      rows.forEach((r) => { const k = r.categoria_id || "sem"; const cur = m.get(k) ?? { nome: r.categoria?.nome || "Sem categoria", total: 0 }; cur.total += Number(r.valor); m.set(k, cur); });
      const l = [...m.values()].sort((a, b) => b.total - a.total); const t = l.reduce((s, v) => s + v.total, 0);
      return l.map((v) => ({ categoria: v.nome, total: r2(v.total), participacao_pct: r2(t ? (v.total / t) * 100 : 0) }));
    };

    // Aging
    const FAIXAS = [
      { label: "Atraso 90+ dias", min: 91, max: 99999, vencido: true }, { label: "Atraso 61–90 dias", min: 61, max: 90, vencido: true },
      { label: "Atraso 31–60 dias", min: 31, max: 60, vencido: true }, { label: "Atraso 1–30 dias", min: 1, max: 30, vencido: true },
      { label: "Vence em até 30 dias", min: -30, max: 0, vencido: false }, { label: "Vence em 31–60 dias", min: -60, max: -31, vencido: false },
      { label: "Vence em 61–90 dias", min: -90, max: -61, vencido: false }, { label: "Vence em 91 dias a 1 ano", min: -365, max: -91, vencido: false },
      { label: "Vence em mais de 1 ano", min: -99999, max: -366, vencido: false },
    ];
    const aging = (rows: Row[]) => {
      const b = FAIXAS.map((f) => ({ ...f, quantidade: 0, total: 0 }));
      rows.forEach((r) => { if (!r.data_vencimento) return; const d = differenceInDays(startOfDay(today), parseISO(r.data_vencimento)); const x = b.find((f) => d >= f.min && d <= f.max); if (x) { x.quantidade++; x.total += Number(r.valor); } });
      const faixas = b.map(({ label, quantidade, total, vencido }) => ({ faixa: label, vencido, quantidade, total: r2(total) }));
      const emAtraso = faixas.filter((f) => f.vencido).reduce((s, f) => s + f.total, 0);
      const aVencer = faixas.filter((f) => !f.vencido).reduce((s, f) => s + f.total, 0);
      return { total_em_aberto: r2(emAtraso + aVencer), em_atraso: r2(emAtraso), a_vencer: r2(aVencer), faixas: faixas.filter((f) => f.quantidade > 0) };
    };
    const abertoRec = recAllRaw.filter((r) => r.status !== "recebido");
    const abertoDesp = despAllRaw.filter((d) => d.status !== "pago" && !d.fatura_id && d.fornecedor !== "[pagamento-fatura]");

    // Conciliação (sem transferências — igual à tela)
    const recon = contasAtivas.filter((c) => c.tipo !== "cartao_credito").map((c) => {
      const e = recRecebidas.filter((r) => r.conta_id === c.id).reduce((s, r) => s + Number(r.valor), 0);
      const sd = despPagas.filter((d) => d.conta_id === c.id).reduce((s, d) => s + Number(d.valor), 0);
      return { conta: c.nome, saldo_inicial: r2(Number(c.saldo_inicial)), entradas: r2(e), saidas: r2(sd), saldo_calculado: r2(Number(c.saldo_inicial) + e - sd) };
    });

    // Burn & runway (caixa)
    const bancos = new Set(contasAtivas.filter((c) => c.tipo !== "cartao_credito").map((c) => c.id));
    const burn: Row[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = startOfMonth(subMonths(today, i)); const me = endOfMonth(m);
      const v = despPagas.filter((d) => { const dt = d.data_pagamento ? parseISO(d.data_pagamento) : null; return !d.fatura_id && !!d.conta_id && bancos.has(d.conta_id) && dt && dt >= m && dt <= me; }).reduce((s, d) => s + Number(d.valor), 0);
      burn.push({ mes: mk(m), queima: r2(v) });
    }
    const ult3 = burn.slice(-3);
    const burnAvg = ult3.length ? ult3.reduce((s, x) => s + x.queima, 0) / ult3.length : 0;
    const caixa = recon.reduce((s, r) => s + r.saldo_calculado, 0);

    // Margem por cliente (período, custo só vinculado)
    const custoCli = new Map<string, number>();
    despReaisP.forEach((d) => { if (d.cliente_id) custoCli.set(d.cliente_id, (custoCli.get(d.cliente_id) ?? 0) + Number(d.valor)); });
    const margemCli = sorted.map(([id, v]) => { const c = custoCli.get(id) ?? 0; const m = v.total - c; return { cliente: v.nome, receita: r2(v.total), custo_direto: r2(c), margem: r2(m), margem_pct: r2(v.total ? (m / v.total) * 100 : 0) }; });

    // LTV / CAC
    const ativos = contr.filter((c) => c.status === "ativo" && c.recorrencia !== "unico");
    const ticket = ativos.length ? ativos.reduce((s, c) => s + mensalEquivalente(Number(c.valor), c.recorrencia), 0) / ativos.length : 0;
    const vidas = contr.filter((c) => c.data_inicio && c.recorrencia !== "unico").map((c) => Math.max(1, Math.round(differenceInDays(c.data_inativacao ? parseISO(c.data_inativacao) : today, parseISO(c.data_inicio)) / 30)));
    const vidaMedia = vidas.length ? vidas.reduce((s, m) => s + m, 0) / vidas.length : 0;
    const ltv = ticket * vidaMedia;
    const termos = ["marketing", "comercial", "venda", "mídia", "midia", "tráfego", "trafego", "publicidade", "captação", "captacao"];
    const gastoCom = despReaisP.filter((d) => { const n = (d.categoria?.nome || "").toLowerCase(); return termos.some((t) => n.includes(t)); }).reduce((s, d) => s + Number(d.valor), 0);
    // created_at é timestamp: compara pela data no fuso de SP (a tela compara o instante com 00:00 do último dia)
    const novos = cli.filter((c) => { if (!c.created_at) return false; const d = new Date(c.created_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); return d >= inicioISO && d <= fimISO; }).length;
    const cac = novos > 0 ? gastoCom / novos : 0;

    // Cartões
    const usado = new Map<string, number>();
    fats.forEach((f) => usado.set(f.cartao_id, (usado.get(f.cartao_id) ?? 0) + (Number(f.valor_total) - Number(f.valor_pago))));
    const cartoes = contasAtivas.filter((c) => c.tipo === "cartao_credito").map((c) => { const u = usado.get(c.id) ?? 0; const l = Number(c.limite ?? 0); return { cartao: c.nome, bandeira: c.bandeira ?? null, limite: r2(l), usado: r2(u), disponivel: r2(Math.max(0, l - u)), uso_pct: r2(l ? (u / l) * 100 : 0) }; });

    // KPIs operacionais
    const cliAtivos = cli.filter((c) => c.status === "ativo").length;
    const contrAtivos = contr.filter((c) => c.status === "ativo").length;
    const recPer = recP.reduce((s, r) => s + Number(r.valor), 0);

    // Projeção 12m
    const lastMRR = mrr12[mrr12.length - 1]?.mrr ?? 0;
    let acc = caixa; const proj12: Row[] = [];
    for (let i = 1; i <= 12; i++) { acc += lastMRR - burnAvg; proj12.push({ mes: mk(addMonths(today, i)), entradas: r2(lastMRR), saidas: r2(burnAvg), saldo_acumulado: r2(acc) }); }

    // Fiscal (impostos = grupo_dre 'imposto'; receitas desde o início da janela, sem limite superior)
    const tx = new Map<string, { ord: string; receita: number; deducoes: number }>();
    rec.forEach((r) => { const d = parseISO(r.data_competencia); const k = mk(d); const cur = tx.get(k) ?? { ord: format(d, "yyyy-MM"), receita: 0, deducoes: 0 }; cur.receita += Number(r.valor); tx.set(k, cur); });
    desp.forEach((d) => { if (d.categoria?.grupo_dre === "imposto" && isCompetencia(d)) { const dt = parseISO(d.data_competencia); const k = mk(dt); const cur = tx.get(k) ?? { ord: format(dt, "yyyy-MM"), receita: 0, deducoes: 0 }; cur.deducoes += Number(d.valor); tx.set(k, cur); } });
    const fiscal = [...tx.entries()].sort((a, b) => a[1].ord.localeCompare(b[1].ord)).map(([mes, v]) => ({ mes, receita: r2(v.receita), impostos: r2(v.deducoes), receita_liquida: r2(v.receita - v.deducoes), aliquota_efetiva_pct: r2(v.receita ? (v.deducoes / v.receita) * 100 : 0) }));

    advCache = {
      mrr12, abc, recCat: porCat(recP), despCat: porCat(despReaisP),
      agingRec: aging(abertoRec), agingPag: aging(abertoDesp), recon,
      burn: { queima_media_3m: r2(burnAvg), caixa_hoje: r2(caixa), runway_meses: r2(burnAvg > 0 ? caixa / burnAvg : 0), serie_6m: burn },
      margemCli, ltvCac: { ltv: r2(ltv), cac: r2(cac), ltv_sobre_cac: r2(cac > 0 ? ltv / cac : 0), payback_meses: r2(ticket > 0 ? cac / ticket : 0), ticket_medio_mensal: r2(ticket), permanencia_media_meses: r2(vidaMedia), novos_clientes_no_periodo: novos, gasto_comercial_no_periodo: r2(gastoCom) },
      cartoes, kpis: { ticket_medio: r2(cliAtivos ? recPer / cliAtivos : 0), clientes_ativos: cliAtivos, contratos_ativos: contrAtivos, receita_por_cliente: r2(cliAtivos ? grand / cliAtivos : 0), receita_competencia_periodo: r2(recPer) },
      proj12, fiscal,
    };
    return advCache;
  }

  // ============ DRE / Rec×Desp / fluxo realizado (useRelatorios) ============
  async function dreDe(ini: Date, fim: Date) {
    const [rec, desp] = await Promise.all([receitas(), despesas()]);
    const iS = format(ini, "yyyy-MM-dd"); const fS = format(fim, "yyyy-MM-dd");
    const meses: string[] = []; const chaves: string[] = [];
    for (let c = new Date(ini.getFullYear(), ini.getMonth(), 1); c <= fim; c = new Date(c.getFullYear(), c.getMonth() + 1, 1)) { meses.push(cap(format(c, "MMM yyyy", { locale: ptBR }))); chaves.push(format(c, "yyyy-MM")); }
    const z = () => Object.fromEntries(meses.map((m) => [m, 0])) as Record<string, number>;
    const key = (ds: string) => cap(format(parseISO(ds), "MMM yyyy", { locale: ptBR }));
    const L = { receitaBruta: z(), servicos: z(), outras: z(), impostos: z(), custosVar: z(), comerciais: z(), administrativas: z(), pessoal: z(), outrasOp: z(), distribuicao: z() };
    const det: Record<string, Record<string, number>> = {};
    const addDet = (b: string, cat: string, v: number) => { (det[b] ||= {}); det[b][cat] = (det[b][cat] || 0) + v; };
    rec.filter((r) => r.data_competencia >= iS && r.data_competencia <= fS).forEach((r) => {
      const m = key(r.data_competencia); const v = Number(r.valor); const cat = r.categoria; const nome = cat?.nome || "Sem categoria";
      L.receitaBruta[m] += v;
      if (cat?.grupo_dre === "rec_servico") { L.servicos[m] += v; addDet("rec_servico", nome, v); } else { L.outras[m] += v; addDet("rec_outra", nome, v); }
    });
    desp.filter((d) => d.data_competencia >= iS && d.data_competencia <= fS && isCompetencia(d)).forEach((d) => {
      const m = key(d.data_competencia); const v = Number(d.valor); const nome = d.categoria?.nome || "Sem categoria";
      switch (d.categoria?.grupo_dre) {
        case "imposto": L.impostos[m] += v; addDet("imposto", nome, v); break;
        case "custo_variavel": L.custosVar[m] += v; addDet("custo_variavel", nome, v); break;
        case "desp_comercial": L.comerciais[m] += v; addDet("desp_comercial", nome, v); break;
        case "desp_administrativa": L.administrativas[m] += v; addDet("desp_administrativa", nome, v); break;
        case "desp_pessoal": L.pessoal[m] += v; addDet("desp_pessoal", nome, v); break;
        case "distribuicao_lucro": L.distribuicao[m] += v; addDet("distribuicao_lucro", nome, v); break;
        default: L.outrasOp[m] += v; addDet("desp_operacional", nome, v);
      }
    });
    const D = { receitaLiquida: z(), lucroBruto: z(), despOper: z(), resultado: z(), aposDistrib: z() };
    meses.forEach((m) => {
      D.receitaLiquida[m] = L.receitaBruta[m] - L.impostos[m];
      D.lucroBruto[m] = D.receitaLiquida[m] - L.custosVar[m];
      D.despOper[m] = L.comerciais[m] + L.administrativas[m] + L.pessoal[m] + L.outrasOp[m];
      D.resultado[m] = D.lucroBruto[m] - D.despOper[m];
      D.aposDistrib[m] = D.resultado[m] - L.distribuicao[m];
    });
    return { meses, chaves, L, D, det };
  }
  const somaV = (v: Record<string, number>) => Object.values(v).reduce((s, x) => s + x, 0);
  const porMes = (v: Record<string, number>) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, r2(x)]));
  const topDet = (det: Record<string, number> | undefined, n = 6) => Object.entries(det || {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([categoria, total]) => ({ categoria, total: r2(total) }));

  // ============================ montagem por grupo ============================
  if (pedidos.has("recorrencia")) {
    const [contr, a, adv] = await Promise.all([contratos(), analises(), avancados()]);
    const ativos = contr.filter((c) => ativoHoje(c, agora));
    const mrrVisao = ativos.reduce((s, c) => s + mensalEquivalente(Number(c.valor), c.recorrencia), 0);
    const cliAtivos = new Set(ativos.map((c) => c.cliente_id));
    const prox = ativos.filter((c) => c.data_fim && parseISO(c.data_fim) > startOfDay(agora)).sort((x, y) => x.data_fim.localeCompare(y.data_fim))[0];
    const venc30 = ativos.filter((c) => c.data_fim && c.data_fim >= hojeISO && c.data_fim <= format(addMonths(agora, 1), "yyyy-MM-dd")).map((c) => ({ cliente: c.cliente?.nome || "Cliente", termina_em: c.data_fim, valor: r2(Number(c.valor)), recorrencia: c.recorrencia }));
    out.recorrencia = {
      mrr_atual: r2(mrrVisao),
      receita_anual_projetada: r2(mrrVisao * 12),
      contratos_ativos: ativos.length,
      clientes_ativos: cliAtivos.size,
      mrr_com_reajustes: r2(a.mrrAtual),
      mrr_mes_anterior: r2(a.mrrAnt),
      crescimento_mrr_pct: r2(a.mrrAnt > 0 ? ((a.mrrAtual - a.mrrAnt) / a.mrrAnt) * 100 : 0),
      proximo_contrato_a_terminar: prox ? { cliente: prox.cliente?.nome || "Cliente", data: prox.data_fim, valor: r2(Number(prox.valor)) } : null,
      contratos_terminam_em_30_dias: venc30,
      serie_12m_relatorio: adv.mrr12,
      como_calcula: "MRR = soma do valor MENSAL equivalente dos contratos ativos hoje (semanal ×52/12, quinzenal ×2, trimestral ÷3, semestral ÷6, anual ÷12; contrato único não entra; pausado não conta). É o número da Visão/Início. Receita anual projetada (ARR) = MRR × 12. 'mrr_com_reajustes' aplica os aditivos de valor (usado em Análises e na nota de saúde). A série 12m do relatório MRR/ARR usa o valor original do contrato e considera ativo até a data de inativação.",
    };
  }

  if (pedidos.has("clientes")) {
    const [contr, ads, cli, a, adv] = await Promise.all([contratos(), aditivos(), clientes(), analises(), avancados()]);
    const today = startOfDay(agora); // useDashboard usa startOfDay
    const porCli: Record<string, { v: number; m: number; ativo: boolean }> = {};
    contr.forEach((c) => {
      if (c.recorrencia === "unico") return;
      const x = (porCli[c.cliente_id] ||= { v: 0, m: 0, ativo: false });
      x.v += mensalNaData(c, ads, today);
      const m = mesesRelacionamento(c, today, agora); if (m > x.m) x.m = m;
      if (ativoHoje(c, agora)) x.ativo = true;
    });
    const vals = Object.values(porCli); const n = vals.length; const at = vals.filter((x) => x.ativo);
    out.clientes = {
      ltv_medio: r2(n ? vals.reduce((s, x) => s + x.v * x.m, 0) / n : 0),
      ticket_mensal_medio: r2(at.length ? at.reduce((s, x) => s + x.v, 0) / at.length : 0),
      tempo_medio_meses: r2(n ? vals.reduce((s, x) => s + x.m, 0) / n : 0),
      clientes_com_contrato_ativo: at.length,
      total_clientes_cadastrados: cli.length,
      valor_total_contratado: r2(vals.reduce((s, x) => s + x.v * x.m, 0)),
      churn: a.churn,
      ltv_evolucao_12m: a.ltvEvolucao,
      coortes: a.coortes,
      ltv_cac: adv.ltvCac,
      como_calcula: "LTV (Visão) = para cada cliente com contrato recorrente: valor mensal contratado (com reajustes) × meses de relacionamento (do início até hoje ou até o fim do contrato, mínimo 1); depois a média entre os clientes. Ticket mensal = média do valor mensal dos clientes com contrato ativo hoje. Churn = clientes que tinham contrato ativo no mês anterior e não têm no mês ÷ clientes ativos do mês anterior; o número principal é o do último mês COMPLETO. Coortes: dos clientes que começaram no mês X, quantos % ainda tinham contrato ativo N meses depois. LTV/CAC (relatório): LTV = ticket médio dos contratos ativos × permanência média (meses) de todos os contratos recorrentes; CAC = despesas de categorias de marketing/comercial/tráfego/publicidade/captação no período ÷ clientes cadastrados no período; payback = CAC ÷ ticket.",
    };
  }

  if (pedidos.has("rentabilidade")) {
    const a = await analises();
    out.rentabilidade = {
      clientes: a.rentab.slice(0, 20),
      total_clientes: a.rentab.length,
      como_calcula: "Tela Análises → Rentabilidade (todo o histórico). Receita = recebido de cada cliente. Custo = despesas pagas vinculadas ao cliente + rateio das despesas pagas SEM cliente, proporcional à fatia do cliente na receita. Compras no cartão (itens de fatura) e distribuição de lucros ficam de fora. Margem = (receita − custo) ÷ receita.",
    };
  }

  if (pedidos.has("saude")) {
    const a = await analises();
    out.saude = { ...a.saude, como_calcula: "Nota de 0 a 100 = soma ponderada de 5 fatores: Margem líquida 25%, Inadimplência 20%, Crescimento do MRR 20%, Retenção 15%, Liquidez 20%. Margem e liquidez usam caixa (recebido/pago no mês, sem itens de cartão; margem sem distribuição de lucros)." };
  }

  if (pedidos.has("projecao")) {
    const [a, adv] = await Promise.all([analises(), avancados()]);
    out.projecao = {
      receita_6m: a.projecao6m,
      receita_variavel_media_3m: r2(a.mediaVar),
      caixa_12m: adv.proj12,
      como_calcula: "Receita 6m (Análises): recorrente = MRR atual (com reajustes) crescendo 3% ao mês; variável = média dos últimos 3 meses de recebimentos sem contrato, constante. Caixa 12m (relatório Projeção): parte do saldo calculado das contas e soma, todo mês, o MRR do último mês menos a queima média dos últimos 3 meses (não considera contas a pagar/receber específicas).",
    };
  }

  if (pedidos.has("resultado") || pedidos.has("dre")) {
    const { meses, L, D, det } = await dreDe(pStart, pEnd);
    if (pedidos.has("dre")) {
      out.dre = {
        regime: "competência",
        meses,
        linhas: [
          { linha: "Receita bruta", total: r2(somaV(L.receitaBruta)), por_mes: porMes(L.receitaBruta) },
          { linha: "Prestação de serviços", total: r2(somaV(L.servicos)), categorias: topDet(det.rec_servico) },
          { linha: "Outras receitas", total: r2(somaV(L.outras)), categorias: topDet(det.rec_outra) },
          { linha: "(−) Deduções da receita (impostos)", total: r2(somaV(L.impostos)), por_mes: porMes(L.impostos), categorias: topDet(det.imposto) },
          { linha: "Receita líquida", total: r2(somaV(D.receitaLiquida)), por_mes: porMes(D.receitaLiquida) },
          { linha: "(−) Custos variáveis", total: r2(somaV(L.custosVar)), por_mes: porMes(L.custosVar), categorias: topDet(det.custo_variavel) },
          { linha: "Lucro bruto", total: r2(somaV(D.lucroBruto)), por_mes: porMes(D.lucroBruto) },
          { linha: "(−) Despesas operacionais", total: r2(somaV(D.despOper)), por_mes: porMes(D.despOper) },
          { linha: "Comerciais / marketing", total: r2(somaV(L.comerciais)), categorias: topDet(det.desp_comercial) },
          { linha: "Administrativas", total: r2(somaV(L.administrativas)), categorias: topDet(det.desp_administrativa) },
          { linha: "Pessoal", total: r2(somaV(L.pessoal)), categorias: topDet(det.desp_pessoal) },
          { linha: "Outras despesas operacionais", total: r2(somaV(L.outrasOp)), categorias: topDet(det.desp_operacional) },
          { linha: "Resultado operacional (EBITDA) = lucro líquido", total: r2(somaV(D.resultado)), por_mes: porMes(D.resultado) },
          ...(somaV(L.distribuicao) !== 0 ? [
            { linha: "(−) Distribuição de lucros", total: r2(somaV(L.distribuicao)), por_mes: porMes(L.distribuicao), categorias: topDet(det.distribuicao_lucro) },
            { linha: "Resultado após distribuição", total: r2(somaV(D.aposDistrib)), por_mes: porMes(D.aposDistrib) },
          ] : []),
        ],
        margem_bruta_pct: r2(somaV(L.receitaBruta) ? (somaV(D.lucroBruto) / somaV(L.receitaBruta)) * 100 : 0),
        margem_operacional_pct: r2(somaV(L.receitaBruta) ? (somaV(D.resultado) / somaV(L.receitaBruta)) * 100 : 0),
        como_calcula: "DRE por COMPETÊNCIA (mês a que o lançamento pertence, pago ou não). Compras no cartão entram pela categoria de cada item; a fatura em si e o pagamento da fatura não entram (senão contaria em dobro). Linhas vêm do 'grupo no DRE' de cada categoria; sem grupo = outras despesas operacionais. Distribuição de lucros fica abaixo do resultado.",
      };
    }
    if (pedidos.has("resultado")) {
      const [rec, desp] = await Promise.all([receitas(), despesas()]);
      const iS = inicioISO; const fS = fimISO;
      const totRec = somaV(L.receitaBruta);
      const despMes = Object.fromEntries(meses.map((m) => [m, L.impostos[m] + L.custosVar[m] + D.despOper[m]]));
      const totDesp = somaV(despMes);
      const ent = Object.fromEntries(meses.map((m) => [m, 0])) as Record<string, number>; const sai = { ...ent };
      const key = (ds: string) => cap(format(parseISO(ds), "MMM yyyy", { locale: ptBR }));
      rec.filter((r) => r.status === "recebido" && r.data_recebimento && r.data_recebimento >= iS && r.data_recebimento <= fS).forEach((r) => { const k = key(r.data_recebimento); if (k in ent) ent[k] += Number(r.valor); });
      desp.filter((d) => d.status === "pago" && !d.fatura_id && d.data_pagamento && d.data_pagamento >= iS && d.data_pagamento <= fS).forEach((d) => { const k = key(d.data_pagamento); if (k in sai) sai[k] += Number(d.valor); });
      let acc = 0;
      const empresas: Record<string, number> = { PIXIFY: 0, REVVUE: 0, CLARIO: 0, TABELIO: 0 };
      rec.filter((r) => r.data_competencia >= iS && r.data_competencia <= fS).forEach((r) => { const ef = r.empresa_fonte || r.categoria?.empresa_fonte || r.cliente?.empresa_fonte || "PIXIFY"; if (empresas[ef] !== undefined) empresas[ef] += Number(r.valor); });
      out.resultado = {
        receitas_x_despesas: { regime: "competência", receitas: r2(totRec), despesas: r2(totDesp), resultado: r2(totRec - totDesp), margem_pct: r2(totRec > 0 ? ((totRec - totDesp) / totRec) * 100 : 0), por_mes: meses.map((m) => ({ mes: m, receitas: r2(L.receitaBruta[m]), despesas: r2(despMes[m]) })) },
        fluxo_realizado: { regime: "caixa", por_mes: meses.map((m) => { acc += ent[m] - sai[m]; return { mes: m, entradas: r2(ent[m]), saidas: r2(sai[m]), saldo_acumulado: r2(acc) }; }) },
        receita_por_marca: Object.entries(empresas).filter(([, v]) => v > 0).map(([marca, v]) => ({ marca, total: r2(v) })),
        como_calcula: "Receitas × despesas (relatório): competência; despesas = impostos + custos variáveis + despesas operacionais (sem distribuição de lucros). Fluxo realizado: caixa, o que entrou (recebido) e saiu (pago, sem itens de cartão, com distribuição de lucros e pagamento de fatura) em cada mês.",
      };
    }
  }

  if (pedidos.has("comparativo")) {
    const p1 = startOfMonth(subMonths(agora, 1)); const p2 = startOfMonth(agora);
    const { meses, L, D } = await dreDe(p1, endOfMonth(agora));
    const [m1, m2] = [meses[0], meses[1]];
    const linhas = [["Receita Bruta", L.receitaBruta], ["Deduções", L.impostos], ["Custos Variáveis", L.custosVar], ["Despesas Operacionais", D.despOper], ["Resultado Líquido", D.resultado]] as const;
    out.comparativo = {
      periodo_1: m1, periodo_2: m2,
      linhas: linhas.map(([l, v]) => { const a = v[m1] || 0; const b = v[m2] || 0; return { linha: l, periodo_1: r2(a), periodo_2: r2(b), variacao: r2(b - a), variacao_pct: r2(a !== 0 ? ((b - a) / Math.abs(a)) * 100 : 0) }; }),
      obs: `Mês atual (${format(p2, "MM/yyyy")}) ainda em andamento.`,
      como_calcula: "Mesmas linhas do DRE (competência), mês atual × mês anterior. Variação % = (atual − anterior) ÷ |anterior|.",
    };
  }

  if (pedidos.has("dfc")) {
    const [cts, rec, desp, fats, fp, tr] = await Promise.all([contas(), receitas(), despesas(), faturas(), fatPag(), transf()]);
    const bancos = new Set(cts.filter((c) => c.tipo !== "cartao_credito").map((c) => c.id));
    const saldoIni = cts.filter((c) => bancos.has(c.id)).reduce((s, c) => s + Number(c.saldo_inicial || 0), 0);
    const ent = rec.filter((r) => r.status === "recebido");
    const sai = desp.filter((d) => d.status === "pago" && !d.fatura_id);
    const itens = desp.filter((d) => d.fatura_id);
    const fatPorDesp = new Map<string, string>();
    fp.forEach((x) => { if (x.despesa_id) fatPorDesp.set(x.despesa_id, x.fatura_id); });
    fats.forEach((f) => { if (f.despesa_id) fatPorDesp.set(f.despesa_id, f.id); });
    const itensFat = new Map<string, Row[]>(); itens.forEach((i) => { const a = itensFat.get(i.fatura_id) || []; a.push(i); itensFat.set(i.fatura_id, a); });
    const tf = tr.map((t) => ({ data: t.data_transferencia, efeito: (t.conta_destino_id && bancos.has(t.conta_destino_id) ? Number(t.valor) : 0) - (t.conta_origem_id && bancos.has(t.conta_origem_id) ? Number(t.valor) : 0) })).filter((t) => t.efeito !== 0);
    const doBanco = (id: string | null) => !!id && bancos.has(id);
    const ateHoje = (d: string) => (d > hojeISO ? hojeISO : d);
    const eB = ent.filter((r) => doBanco(r.conta_id) && r.data_recebimento).map((r) => ({ ...r, dt: ateHoje(r.data_recebimento) }));
    const sB = sai.filter((d) => doBanco(d.conta_id) && d.data_pagamento).map((d) => ({ ...d, dt: ateHoje(d.data_pagamento) }));
    const saldoAte = (ate: string) => saldoIni + eB.filter((r) => r.dt <= ate).reduce((s, r) => s + Number(r.valor), 0) - sB.filter((d) => d.dt <= ate).reduce((s, d) => s + Number(d.valor), 0) + tf.filter((t) => t.data && t.data <= ate).reduce((s, t) => s + t.efeito, 0);
    const GR = ["imposto", "custo_variavel", "desp_comercial", "desp_administrativa", "desp_pessoal", "desp_operacional"] as const;
    const NOMES: Record<string, string> = { imposto: "Impostos e deduções", custo_variavel: "Custos variáveis", desp_comercial: "Comerciais / Marketing", desp_administrativa: "Administrativas", desp_pessoal: "Pessoal", desp_operacional: "Outras despesas operacionais", distribuicao_lucro: "Distribuição de lucros / retiradas" };
    const grupoDe = (c: Row) => { const g = c?.grupo_dre; return g && (g in NOMES) ? g : "desp_operacional"; };
    const meses: { label: string; ini: string; fim: string }[] = [];
    for (let c = new Date(pStart.getFullYear(), pStart.getMonth(), 1), i = 0; c <= pEnd; c = new Date(c.getFullYear(), c.getMonth() + 1, 1), i++) {
      meses.push({ label: cap(format(c, "MMM yyyy", { locale: ptBR })), ini: format(i === 0 ? pStart : startOfMonth(c), "yyyy-MM-dd"), fim: "" });
    }
    meses.forEach((m, i) => { m.fim = i === meses.length - 1 ? fimISO : format(endOfMonth(parseISO(m.ini)), "yyyy-MM-dd"); });
    const col = (d: string) => meses.find((m) => d >= m.ini && d <= m.fim)?.label;
    const zero = () => Object.fromEntries(meses.map((m) => [m.label, 0])) as Record<string, number>;
    const servico = zero(); const outra = zero(); const por: Record<string, Record<string, number>> = Object.fromEntries([...GR, "distribuicao_lucro"].map((g) => [g, zero()]));
    const catSaida: Record<string, number> = {};
    eB.forEach((r) => { const k = col(r.dt); if (!k) return; if (r.categoria?.grupo_dre === "rec_servico") servico[k] += Number(r.valor); else outra[k] += Number(r.valor); });
    sB.forEach((d) => {
      const k = col(d.dt); if (!k) return; const v = Number(d.valor);
      const fid = fatPorDesp.get(d.id); const its = fid ? itensFat.get(fid) || [] : []; const tot = its.reduce((s, i) => s + Number(i.valor), 0);
      if (fid && tot > 0) its.forEach((i) => { const p = v * (Number(i.valor) / tot); const g = grupoDe(i.categoria); por[g][k] += p; const n = i.categoria?.nome || "Sem categoria"; catSaida[n] = (catSaida[n] || 0) + p; });
      else { const g = grupoDe(d.categoria); por[g][k] += v; const n = d.fornecedor === "[pagamento-fatura]" ? "Fatura do cartão (sem itens)" : (d.categoria?.nome || "Sem categoria"); catSaida[n] = (catSaida[n] || 0) + v; }
    });
    const linhasMes = meses.map((m) => {
      const dia = format(new Date(parseISO(m.ini).getTime() - 86400000), "yyyy-MM-dd");
      const si = saldoAte(dia); const e = servico[m.label] + outra[m.label];
      const so = GR.reduce((s, g) => s + por[g][m.label], 0);
      const outros = tf.filter((t) => t.data && t.data >= m.ini && t.data <= m.fim).reduce((s, t) => s + t.efeito, 0);
      const varc = e - so - por.distribuicao_lucro[m.label] + outros;
      return { mes: m.label, saldo_inicial: r2(si), entradas: r2(e), saidas_operacionais: r2(so), geracao_caixa_operacional: r2(e - so), distribuicao_lucros: r2(por.distribuicao_lucro[m.label]), transferencias_fora_do_caixa: r2(outros), variacao: r2(varc), saldo_final: r2(si + varc) };
    });
    out.dfc = {
      regime: "caixa",
      por_mes: linhasMes,
      totais: { entradas: r2(somaV(servico) + somaV(outra)), recebimentos_servicos: r2(somaV(servico)), outras_entradas: r2(somaV(outra)), saidas_por_grupo: Object.fromEntries([...GR, "distribuicao_lucro"].map((g) => [NOMES[g], r2(somaV(por[g]))])) },
      maiores_saidas_por_categoria: Object.entries(catSaida).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([categoria, total]) => ({ categoria, total: r2(total) })),
      saldo_real_contas_hoje: r2(saldoAte(hojeISO)),
      como_calcula: "DFC por CAIXA: só contas bancárias, pela data em que o dinheiro entrou/saiu. Compras no cartão saem quando a fatura é paga, e esse pagamento é rateado pelas categorias das compras. Saldo inicial de cada mês = saldo real das contas no dia anterior; o saldo final do mês atual bate com o saldo das contas.",
    };
  }

  if (pedidos.has("categorias")) {
    const adv = await avancados();
    out.categorias = { regime: "competência", receita: adv.recCat.slice(0, 15), despesa: adv.despCat.slice(0, 15), como_calcula: "Soma por categoria no período, pela data de competência. Despesa inclui os itens de compras no cartão (cada um na sua categoria) e exclui a fatura e o pagamento da fatura." };
  }
  if (pedidos.has("abc")) {
    const adv = await avancados();
    out.abc = { regime: "competência", clientes: adv.abc.slice(0, 25), total_clientes: adv.abc.length, resumo: ["A", "B", "C"].map((c) => ({ classe: c, clientes: adv.abc.filter((x: Row) => x.classe === c).length, receita: r2(adv.abc.filter((x: Row) => x.classe === c).reduce((s: number, x: Row) => s + x.total, 0)) })), como_calcula: "Curva ABC: clientes ordenados pela receita do período (competência); classe A = até 80% acumulado, B = até 95%, C = o resto." };
  }
  if (pedidos.has("margem")) {
    const adv = await avancados();
    out.margem = { clientes: adv.margemCli.slice(0, 20), como_calcula: "Relatório Margem por cliente: receita do cliente no período (competência) − despesas vinculadas a ele no período. Diferente da Rentabilidade em Análises, aqui NÃO há rateio das despesas gerais." };
  }
  if (pedidos.has("aging")) {
    const adv = await avancados();
    out.aging = { a_receber: adv.agingRec, a_pagar: adv.agingPag, como_calcula: "Tudo que está em aberto hoje (qualquer data), separado por dias de atraso (hoje − vencimento) ou por quanto falta para vencer. A pagar não inclui itens de cartão: a fatura é a conta." };
  }
  if (pedidos.has("caixa")) {
    const adv = await avancados();
    out.caixa = { ...adv.burn, como_calcula: "Queima (burn) = o que SAIU das contas bancárias no mês (data de pagamento; inclui pagamento de fatura e distribuição de lucros). Queima média = média dos 3 últimos meses (o atual incluso). Caixa = saldo calculado das contas bancárias ativas (saldo inicial + recebido − pago; o relatório não soma transferências). Runway = caixa ÷ queima média, em meses." };
  }
  if (pedidos.has("conciliacao")) {
    const adv = await avancados();
    out.conciliacao = { contas: adv.recon, como_calcula: "Por conta bancária ativa: saldo inicial + tudo recebido nela − tudo pago nela (todo o histórico). Não considera transferências entre contas." };
  }
  if (pedidos.has("cartoes")) {
    const adv = await avancados();
    out.cartoes = { cartoes: adv.cartoes, como_calcula: "Usado = soma (valor total − valor pago) de todas as faturas do cartão; disponível = limite − usado." };
  }
  if (pedidos.has("kpis")) {
    const adv = await avancados();
    out.kpis = { ...adv.kpis, como_calcula: "Clientes ativos = cadastros com status ativo; contratos ativos = status ativo. Ticket médio = receita do período (competência, todas) ÷ clientes ativos. Receita por cliente = receita de clientes identificados no período ÷ clientes ativos." };
  }
  if (pedidos.has("fiscal")) {
    const adv = await avancados();
    out.fiscal = { por_mes: adv.fiscal, como_calcula: "Impostos = despesas em categorias com grupo no DRE 'Deduções/impostos', por competência. Alíquota efetiva = impostos ÷ receita do mês." };
  }

  return out;
}
