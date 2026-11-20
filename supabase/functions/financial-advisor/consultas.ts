// Consultas (só leitura) da IARA que espelham telas do app:
//   cobranças e histórico de envios → /cobrancas
//   contratos (todos os status, pausa, reajustes) → /contratos
//   extrato de uma conta e transferências → /contas (mesma regra de saldo de lib/conferenciaSaldo.ts)
//   pendências → hooks/usePendencias.ts (mesmos itens e textos)
//   metas → Início (meta de faturamento = recebido no mês, padrão R$ 15.000)
// Rodam com o cliente do PRÓPRIO usuário (RLS).
// deno-lint-ignore-file no-explicit-any

export interface CtxConsulta {
  db: any;
  safe: <T>(p: PromiseLike<{ data: T | null }>) => Promise<T[]>;
  hoje: string; // YYYY-MM-DD (São Paulo)
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const norm = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const dBR = (iso?: string | null) => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10) + "T00:00:00Z") - Date.parse(a.slice(0, 10) + "T00:00:00Z")) / 86400000);
const somaDias = (iso: string, n: number) => new Date(Date.parse(iso.slice(0, 10) + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const nomeDe = (r: any) => r?.cliente?.nome || r?.clientes?.nome || "Sem cliente";
const STATUS_COB: Record<string, string> = { pendente: "aguardando pagamento", vencido: "vencida", pago: "paga", cancelado: "cancelada", estornado: "estornada" };

/** Acha contas pelo nome (ou banco). */
export function acharConta(contas: any[], nome?: string | null): any[] {
  if (!nome || !norm(nome)) return [];
  const t = norm(nome);
  const exato = contas.filter((c) => norm(c.nome) === t);
  if (exato.length) return exato;
  return contas.filter((c) => norm(c.nome).includes(t) || t.includes(norm(c.nome)) || (c.banco && norm(c.banco).includes(t)));
}

// ---------------------------------------------------------------- Cobranças
/** Fatura agrupada (vários contratos, mesmo pagamento no Asaas) conta uma vez só — igual à tela. */
function agruparCobrancas(linhas: any[]) {
  const porFatura = new Map<string, any>();
  for (const c of linhas) {
    const k = c.asaas_payment_id || c.id;
    const atual = porFatura.get(k);
    if (atual) { atual.valor = r2(atual.valor + Number(c.valor || 0)); atual.ids.push(c.id); atual.agrupada = true; continue; }
    porFatura.set(k, { ...c, valor: Number(c.valor || 0), ids: [c.id], agrupada: false });
  }
  return [...porFatura.values()];
}

export async function cobrancasLista(ctx: CtxConsulta, a: { status?: string; cliente?: string; inicio?: string; fim?: string }) {
  let q = ctx.db.from("cobrancas")
    .select("id, descricao, valor, vencimento, status, forma_pagamento, data_pagamento, invoice_url, asaas_payment_id, asaas_subscription_id, contrato_id, exigir_nf, notas_fiscais, nota_fiscal_path, nota_fiscal_enviada, cliente_id, cliente:clientes(nome)");
  const st = (a.status || "abertas").toLowerCase();
  if (st === "abertas" || st === "aberto" || st === "em_aberto") q = q.in("status", ["pendente", "vencido"]);
  else if (st === "vencidas" || st === "vencido") q = q.eq("status", "vencido");
  else if (st === "aguardando" || st === "pendente") q = q.eq("status", "pendente");
  else if (st === "pagas" || st === "pago") q = q.eq("status", "pago");
  else if (st === "canceladas" || st === "cancelado") q = q.in("status", ["cancelado", "estornado"]);
  else q = q.not("status", "in", "(cancelado,estornado)");
  if (a.inicio) q = q.gte(st.startsWith("pag") ? "data_pagamento" : "vencimento", a.inicio);
  if (a.fim) q = q.lte(st.startsWith("pag") ? "data_pagamento" : "vencimento", a.fim);
  let linhas = await ctx.safe<any>(q);
  if (a.cliente && norm(a.cliente)) {
    const t = norm(a.cliente);
    linhas = linhas.filter((c) => norm(nomeDe(c)).includes(t) || t.includes(norm(nomeDe(c))) || norm(c.descricao).includes(t));
  }
  const cobs = agruparCobrancas(linhas).sort((x, y) => String(x.vencimento).localeCompare(String(y.vencimento)));

  // Último envio de cada cobrança (WhatsApp e e-mail).
  const ids = cobs.flatMap((c) => c.ids);
  const [wpp, mail] = ids.length ? await Promise.all([
    ctx.safe<any>(ctx.db.from("whatsapp_envios").select("cobranca_id, status, origem, created_at").in("cobranca_id", ids.slice(0, 300))),
    ctx.safe<any>(ctx.db.from("email_envios").select("cobranca_id, status, origem, created_at").in("cobranca_id", ids.slice(0, 300))),
  ]) : [[], []];
  const envios = new Map<string, { qtd: number; ultimo: any }>();
  for (const e of [...wpp.map((x: any) => ({ ...x, canal: "WhatsApp" })), ...mail.map((x: any) => ({ ...x, canal: "e-mail" }))]) {
    const g = envios.get(e.cobranca_id) || { qtd: 0, ultimo: null };
    g.qtd += 1;
    if (!g.ultimo || String(e.created_at) > String(g.ultimo.created_at)) g.ultimo = e;
    envios.set(e.cobranca_id, g);
  }
  const itens = cobs.map((c) => {
    const env = c.ids.map((id: string) => envios.get(id)).filter(Boolean) as { qtd: number; ultimo: any }[];
    const ult = env.map((e) => e.ultimo).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))[0];
    const atraso = c.status === "vencido" ? diasEntre(c.vencimento, ctx.hoje) : 0;
    return {
      cliente: nomeDe(c), descricao: c.descricao || "Cobrança", valor: r2(c.valor),
      vencimento: c.vencimento, situacao: STATUS_COB[c.status] || c.status,
      dias_de_atraso: atraso || undefined,
      pago_em: c.data_pagamento || undefined,
      forma: c.forma_pagamento || null,
      de_assinatura: !!c.asaas_subscription_id,
      junta_contratos: c.agrupada || undefined,
      link_pagamento: c.invoice_url || null,
      envios: env.reduce((s, e) => s + e.qtd, 0),
      ultimo_envio: ult ? `${ult.canal} em ${dBR(String(ult.created_at).slice(0, 10))} (${ult.status}${ult.origem ? `, ${ult.origem}` : ""})` : "nenhum",
      nota_fiscal_pendente: c.exigir_nf && !c.nota_fiscal_enviada && !(Array.isArray(c.notas_fiscais) && c.notas_fiscais.length) && !c.nota_fiscal_path ? true : undefined,
    };
  });
  const soma = (f: (i: any) => boolean) => r2(itens.filter(f).reduce((s, i) => s + i.valor, 0));
  return {
    filtro: { status: st, cliente: a.cliente || null, inicio: a.inicio || null, fim: a.fim || null },
    quantidade: itens.length,
    total: soma(() => true),
    total_vencidas: soma((i) => i.situacao === "vencida"),
    total_aguardando: soma((i) => i.situacao === "aguardando pagamento"),
    total_pagas: soma((i) => i.situacao === "paga"),
    cobrancas: itens.slice(0, 60),
    obs: [
      itens.length > 60 ? `Mostrando 60 de ${itens.length}; os totais consideram todas.` : null,
      "Com cobrança no Asaas a baixa é automática quando o cliente paga (Pix na hora; boleto em 1–2 dias úteis).",
    ].filter(Boolean).join(" "),
  };
}

export async function historicoEnvios(ctx: CtxConsulta, a: { cliente?: string; inicio?: string; fim?: string; canal?: string }) {
  const ini = a.inicio || somaDias(ctx.hoje, -60);
  const fim = a.fim || ctx.hoje;
  const sel = "cobranca_id, status, origem, erro, created_at, cobranca:cobrancas(descricao, valor, vencimento, status, cliente:clientes(nome))";
  const canal = (a.canal || "todos").toLowerCase();
  const [wpp, mail] = await Promise.all([
    canal === "email" ? Promise.resolve([]) : ctx.safe<any>(ctx.db.from("whatsapp_envios").select(`telefone, ${sel}`).gte("created_at", ini).lte("created_at", fim + "T23:59:59")),
    canal === "whatsapp" ? Promise.resolve([]) : ctx.safe<any>(ctx.db.from("email_envios").select(`para, assunto, ${sel}`).gte("created_at", ini).lte("created_at", fim + "T23:59:59")),
  ]);
  let itens = [
    ...wpp.map((e: any) => ({ canal: "WhatsApp", para: e.telefone, e })),
    ...mail.map((e: any) => ({ canal: "e-mail", para: e.para, e })),
  ].map(({ canal, para, e }) => ({
    data: String(e.created_at).slice(0, 10),
    hora: new Date(e.created_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    canal, para, status: e.status, erro: e.erro || undefined,
    tipo: e.origem === "auto" || e.origem === "automatico" ? "automático" : (e.origem || "manual"),
    cliente: nomeDe(e.cobranca), cobranca: e.cobranca ? `${e.cobranca.descricao || "Cobrança"} · ${brl(Number(e.cobranca.valor || 0))} · vence ${dBR(e.cobranca.vencimento)} · ${STATUS_COB[e.cobranca.status] || e.cobranca.status}` : null,
  }));
  if (a.cliente && norm(a.cliente)) {
    const t = norm(a.cliente);
    itens = itens.filter((i) => norm(i.cliente).includes(t) || t.includes(norm(i.cliente)));
  }
  itens.sort((x, y) => (y.data + y.hora).localeCompare(x.data + x.hora));
  const falhas = itens.filter((i) => /falh|erro|devolv|spam/i.test(String(i.status)));
  return {
    periodo: { inicio: ini, fim }, quantidade: itens.length,
    por_canal: { whatsapp: itens.filter((i) => i.canal === "WhatsApp").length, email: itens.filter((i) => i.canal === "e-mail").length },
    falhas: falhas.length,
    envios: itens.slice(0, 50),
    obs: itens.length > 50 ? `Mostrando os 50 mais recentes de ${itens.length}.` : undefined,
  };
}

// ---------------------------------------------------------------- Contratos
function estadoPausa(c: any, hoje: string): "pausado" | "agendada" | null {
  if (!c.pausado_desde) return null;
  if (c.pausado_ate && c.pausado_ate < hoje) return null;
  return c.pausado_desde <= hoje ? "pausado" : "agendada";
}
export function situacaoContrato(c: any, hoje: string): string {
  if (c.status !== "ativo") return c.status; // encerrado | cancelado
  const p = estadoPausa(c, hoje);
  if (p === "pausado") return "pausado";
  return p === "agendada" ? "ativo (pausa agendada)" : "ativo";
}

export async function contratosLista(ctx: CtxConsulta, a: { status?: string; cliente?: string; terminam_ate?: string }) {
  const todos = await ctx.safe<any>(ctx.db.from("contratos")
    .select("id, descricao, valor, recorrencia, dia_vencimento, data_inicio, data_fim, status, data_inativacao, asaas_subscription_id, pausado_desde, pausado_ate, gerar_receitas, cliente:clientes(nome)"));
  const st = (a.status || "todos").toLowerCase();
  let lista = todos.map((c) => ({ ...c, situacao: situacaoContrato(c, ctx.hoje) }));
  if (st === "ativo" || st === "ativos") lista = lista.filter((c) => c.situacao.startsWith("ativo"));
  else if (st === "pausado" || st === "pausados") lista = lista.filter((c) => c.situacao === "pausado" || c.situacao === "ativo (pausa agendada)");
  else if (st === "encerrado" || st === "encerrados") lista = lista.filter((c) => c.status === "encerrado");
  else if (st === "cancelado" || st === "cancelados") lista = lista.filter((c) => c.status === "cancelado");
  else if (st === "inativos") lista = lista.filter((c) => c.status !== "ativo");
  if (a.cliente && norm(a.cliente)) {
    const t = norm(a.cliente);
    lista = lista.filter((c) => norm(nomeDe(c)).includes(t) || t.includes(norm(nomeDe(c))) || norm(c.descricao).includes(t));
  }
  if (a.terminam_ate) lista = lista.filter((c) => c.status === "ativo" && c.data_fim && c.data_fim <= a.terminam_ate!);

  const ids = lista.map((c) => c.id);
  const [aditivos, receitas] = ids.length ? await Promise.all([
    ctx.safe<any>(ctx.db.from("contrato_aditivos").select("contrato_id, valor_anterior, valor_novo, data_vigencia, motivo").in("contrato_id", ids.slice(0, 300))),
    ctx.safe<any>(ctx.db.from("receitas").select("contrato_id, valor, status, data_vencimento").in("contrato_id", ids.slice(0, 300)).in("status", ["pendente", "atrasado"])),
  ]) : [[], []];
  const itens = lista.map((c) => {
    const ad = aditivos.filter((x: any) => x.contrato_id === c.id).sort((x: any, y: any) => String(x.data_vigencia).localeCompare(String(y.data_vigencia)));
    const abertas = receitas.filter((x: any) => x.contrato_id === c.id).sort((x: any, y: any) => String(x.data_vencimento).localeCompare(String(y.data_vencimento)));
    const atrasadas = abertas.filter((x: any) => x.status === "atrasado" || x.data_vencimento < ctx.hoje);
    const prox = abertas.find((x: any) => x.data_vencimento >= ctx.hoje);
    return {
      cliente: nomeDe(c), descricao: c.descricao, valor: r2(Number(c.valor || 0)), recorrencia: c.recorrencia,
      dia_vencimento: c.dia_vencimento || null, situacao: c.situacao,
      inicio: c.data_inicio, termina_em: c.data_fim || "sem data final",
      dias_para_terminar: c.data_fim && c.status === "ativo" ? diasEntre(ctx.hoje, c.data_fim) : undefined,
      encerrado_em: c.status !== "ativo" ? (c.data_inativacao || null) : undefined,
      pausa: c.pausado_desde ? `de ${dBR(c.pausado_desde)} ${c.pausado_ate ? `até ${dBR(c.pausado_ate)}` : "até reativar"}` : undefined,
      cobra_no_asaas: !!c.asaas_subscription_id,
      reajustes: ad.map((x: any) => ({ vigencia: x.data_vigencia, de: r2(Number(x.valor_anterior)), para: r2(Number(x.valor_novo)), motivo: x.motivo || undefined })),
      proxima_receita: prox ? { vencimento: prox.data_vencimento, valor: r2(Number(prox.valor)) } : null,
      em_atraso: atrasadas.length ? { quantidade: atrasadas.length, total: r2(atrasadas.reduce((s: number, x: any) => s + Number(x.valor || 0), 0)) } : undefined,
    };
  }).sort((x, y) => x.cliente.localeCompare(y.cliente));
  const contagem: Record<string, number> = {};
  for (const c of todos) { const s = situacaoContrato(c, ctx.hoje); contagem[s] = (contagem[s] || 0) + 1; }
  return {
    filtro: { status: st, cliente: a.cliente || null, terminam_ate: a.terminam_ate || null },
    quantidade: itens.length, contagem_geral: contagem,
    contratos: itens.slice(0, 60),
    obs: itens.length > 60 ? `Mostrando 60 de ${itens.length}.` : undefined,
  };
}

// ---------------------------------------------------------------- Extrato e transferências
/** Movimentos efetivados de uma conta — mesma regra do saldo de /contas (lib/conferenciaSaldo.ts). */
async function movimentosConta(ctx: CtxConsulta, contaId: string) {
  const [rec, desp, tOut, tIn] = await Promise.all([
    ctx.safe<any>(ctx.db.from("receitas").select("descricao, valor, data_recebimento, data_vencimento, cliente:clientes(nome), categoria:categorias(nome)").eq("conta_id", contaId).eq("status", "recebido")),
    ctx.safe<any>(ctx.db.from("despesas").select("descricao, fornecedor, valor, data_pagamento, data_vencimento, categoria:categorias(nome)").eq("conta_id", contaId).eq("status", "pago").is("fatura_id", null)),
    ctx.safe<any>(ctx.db.from("transferencias").select("descricao, valor, data_transferencia, destino:contas!transferencias_conta_destino_id_fkey(nome)").eq("conta_origem_id", contaId)),
    ctx.safe<any>(ctx.db.from("transferencias").select("descricao, valor, data_transferencia, origem:contas!transferencias_conta_origem_id_fkey(nome)").eq("conta_destino_id", contaId)),
  ]);
  return [
    ...rec.map((r: any) => ({ data: String(r.data_recebimento || r.data_vencimento), tipo: "entrada", quem: r.cliente?.nome || null, descricao: r.descricao || "Receita", categoria: r.categoria?.nome || null, valor: Number(r.valor || 0) })),
    ...desp.map((d: any) => ({
      data: String(d.data_pagamento || d.data_vencimento), tipo: "saída",
      quem: d.fornecedor === "[pagamento-fatura]" ? "Pagamento de fatura" : (d.fornecedor && !String(d.fornecedor).startsWith("[") ? d.fornecedor : null),
      descricao: d.descricao || "Despesa", categoria: d.categoria?.nome || null, valor: -Number(d.valor || 0),
    })),
    ...tOut.map((t: any) => ({ data: String(t.data_transferencia), tipo: "transferência enviada", quem: t.destino?.nome ? `para ${t.destino.nome}` : null, descricao: t.descricao || "Transferência", categoria: null, valor: -Number(t.valor || 0) })),
    ...tIn.map((t: any) => ({ data: String(t.data_transferencia), tipo: "transferência recebida", quem: t.origem?.nome ? `de ${t.origem.nome}` : null, descricao: t.descricao || "Transferência", categoria: null, valor: Number(t.valor || 0) })),
  ].sort((x, y) => x.data.localeCompare(y.data));
}

export async function extratoConta(ctx: CtxConsulta, contas: any[], a: { conta?: string; inicio: string; fim: string }) {
  const bancarias = contas.filter((c) => c.tipo !== "cartao_credito");
  const achadas = a.conta ? acharConta(bancarias, a.conta) : (bancarias.length === 1 ? bancarias : []);
  if (!achadas.length) {
    if (a.conta && acharConta(contas.filter((c) => c.tipo === "cartao_credito"), a.conta).length) return { erro: "Isso é um cartão de crédito: use fatura_cartao." };
    return { erro: a.conta ? `Não achei a conta "${a.conta}".` : "Qual conta? Pergunte.", contas: bancarias.map((c) => c.nome) };
  }
  if (achadas.length > 1) return { precisa_escolher: true, contas: achadas.map((c) => c.nome) };
  const conta = achadas[0];
  const movs = await movimentosConta(ctx, conta.id);
  const antes = movs.filter((m) => m.data < a.inicio).reduce((s, m) => s + m.valor, 0);
  const saldoInicial = Number(conta.saldo_inicial || 0) + antes;
  let saldo = saldoInicial;
  const doPeriodo = movs.filter((m) => m.data >= a.inicio && m.data <= a.fim).map((m) => { saldo += m.valor; return { ...m, valor: r2(m.valor), saldo_apos: r2(saldo) }; });
  const saldoAtual = Number(conta.saldo_inicial || 0) + movs.reduce((s, m) => s + m.valor, 0);
  const conf = await ctx.safe<any>(ctx.db.from("conferencias_saldo").select("data, saldo_banco, saldo_sistema, diferenca").eq("conta_id", conta.id).order("data", { ascending: false }).limit(1));
  const entradas = doPeriodo.filter((m) => m.valor > 0).reduce((s, m) => s + m.valor, 0);
  const saidas = doPeriodo.filter((m) => m.valor < 0).reduce((s, m) => s + m.valor, 0);
  return {
    conta: conta.nome, banco: conta.banco || null, periodo: { inicio: a.inicio, fim: a.fim },
    saldo_no_inicio: r2(saldoInicial), entradas: r2(entradas), saidas: r2(-saidas), saldo_no_fim: r2(saldo),
    saldo_atual_da_conta: r2(saldoAtual),
    quantidade: doPeriodo.length,
    movimentos: doPeriodo.slice(-80),
    ultima_conferencia_com_banco: conf[0] ? { data: conf[0].data, saldo_no_banco: r2(Number(conf[0].saldo_banco)), saldo_no_sistema: r2(Number(conf[0].saldo_sistema)), diferenca: r2(Number(conf[0].diferenca)) } : "nunca conferida",
    obs: [
      doPeriodo.length > 80 ? `Mostrando os 80 últimos de ${doPeriodo.length}; os totais consideram todos.` : null,
      "Só o que já foi efetivado (recebido/pago/transferido), pela data em que aconteceu. Compras no cartão não entram: o que sai da conta é o pagamento da fatura.",
    ].filter(Boolean).join(" "),
  };
}

export async function listarTransferencias(ctx: CtxConsulta, contas: any[], a: { inicio: string; fim: string; conta?: string }) {
  let q = ctx.db.from("transferencias").select("descricao, valor, data_transferencia, conta_origem_id, conta_destino_id")
    .gte("data_transferencia", a.inicio).lte("data_transferencia", a.fim);
  if (a.conta) {
    const c = acharConta(contas, a.conta);
    if (!c.length) return { erro: `Não achei a conta "${a.conta}".`, contas: contas.map((x) => x.nome) };
    const ids = c.map((x) => x.id).join(",");
    q = q.or(`conta_origem_id.in.(${ids}),conta_destino_id.in.(${ids})`);
  }
  const linhas = await ctx.safe<any>(q);
  const nome = (id: string) => contas.find((c) => c.id === id)?.nome || "Conta";
  const itens = linhas.map((t: any) => ({ data: t.data_transferencia, de: nome(t.conta_origem_id), para: nome(t.conta_destino_id), valor: r2(Number(t.valor || 0)), descricao: t.descricao || null }))
    .sort((x: any, y: any) => String(x.data).localeCompare(String(y.data)));
  return { periodo: { inicio: a.inicio, fim: a.fim }, quantidade: itens.length, total: r2(itens.reduce((s: number, i: any) => s + i.valor, 0)), transferencias: itens.slice(0, 80), obs: "Transferências entre contas não mudam o saldo total, só onde o dinheiro está." };
}

// ---------------------------------------------------------------- Pendências (espelho de hooks/usePendencias.ts)
const parcelaDe = (d: string) => String(d || "").match(/\((\d+)\s*\/\s*\d+\)/)?.[1] ?? null;
function gruposDuplicados(itens: any[], cobrancaDe: Map<string, string>): any[][] {
  const mapa = new Map<string, any[]>();
  for (const item of itens) {
    if (!item.data_vencimento) continue;
    const chave = `${item.tipo}-${item.valor}-${String(item.fornecedor_cliente).toLowerCase().trim()}-${String(item.data_vencimento).slice(0, 7)}`;
    mapa.set(chave, [...(mapa.get(chave) || []), item]);
  }
  const conflitam = (a: any, b: any) => {
    const pa = parcelaDe(a.descricao), pb = parcelaDe(b.descricao);
    if (pa && pb && pa !== pb) return false;
    const ca = cobrancaDe.get(a.id), cb = cobrancaDe.get(b.id);
    if (ca && cb && ca !== cb) return false;
    return true;
  };
  const grupos: any[][] = [];
  mapa.forEach((g) => { const f = g.filter((a) => g.some((b) => b !== a && conflitam(a, b))); if (f.length > 1) grupos.push(f); });
  return grupos;
}
const temNota = (l: any) => (Array.isArray(l.notas_fiscais) && l.notas_fiscais.some((n: any) => n?.path)) || !!l.nota_fiscal_path || !!l.nota_fiscal_enviada;
const temAnexo = (d: any) => Array.isArray(d.anexos) && d.anexos.some((x: any) => x?.path);

export async function pendencias(ctx: CtxConsulta) {
  const hoje = ctx.hoje;
  const [cobs, emails, faturas, cartoes, contratos, recAbertas, recSemConta, despAbertas, despSemConta, ign] = await Promise.all([
    ctx.safe<any>(ctx.db.from("cobrancas").select("id, descricao, valor, vencimento, status, receita_id, cliente_id, exigir_nf, notas_fiscais, nota_fiscal_path, nota_fiscal_enviada, asaas_payment_id, cliente:clientes(nome)").not("status", "in", "(cancelado,estornado)")),
    ctx.safe<any>(ctx.db.from("email_envios").select("id, para, assunto, status, created_at").in("status", ["falhou", "devolvido", "spam"]).eq("visto", false).gte("created_at", somaDias(hoje, -30))),
    ctx.safe<any>(ctx.db.from("cartao_faturas").select("id, cartao_id, data_vencimento, valor_total, valor_pago, status").neq("status", "paga").lte("data_vencimento", somaDias(hoje, 3))),
    ctx.safe<any>(ctx.db.from("contas").select("id, nome").eq("tipo", "cartao_credito")),
    ctx.safe<any>(ctx.db.from("contratos").select("id, descricao, valor, recorrencia, data_fim, asaas_subscription_id, gerar_receitas, cliente:clientes(nome)").eq("status", "ativo")),
    ctx.safe<any>(ctx.db.from("receitas").select("id, descricao, valor, data_vencimento, status, contrato_id, cliente:clientes(nome)").in("status", ["pendente", "atrasado"])),
    ctx.safe<any>(ctx.db.from("receitas").select("id, descricao, valor, data_recebimento, cliente:clientes(nome)").eq("status", "recebido").is("conta_id", null).gt("valor", 0)),
    ctx.safe<any>(ctx.db.from("despesas").select("id, descricao, valor, data_vencimento, fornecedor, anexos").in("status", ["pendente", "atrasado"]).is("fatura_id", null)),
    ctx.safe<any>(ctx.db.from("despesas").select("id, descricao, valor, data_pagamento").eq("status", "pago").is("conta_id", null).is("fatura_id", null).gt("valor", 0)),
    ctx.safe<any>(ctx.db.from("pendencias_ignoradas").select("chave")),
  ]);
  const itens: { chave: string; bloco: string; titulo: string; detalhe: string; porque: string; valor?: number; onde: string }[] = [];
  const porFatura = new Map<string, any[]>();
  for (const c of cobs) { const k = c.asaas_payment_id || c.id; porFatura.set(k, [...(porFatura.get(k) || []), c]); }
  const fCob = [...porFatura.values()].map((ls) => ({ ...ls[0], valor: ls.reduce((s, l) => s + Number(l.valor), 0), linhas: ls }));

  for (const c of fCob.filter((f) => f.status === "vencido")) {
    const dias = diasEntre(c.vencimento, hoje);
    itens.push({ chave: `cob-vencida:${c.id}`, bloco: "Dinheiro em risco", titulo: "Cobrança vencida", valor: c.valor, onde: "Cobranças",
      detalhe: `${nomeDe(c)} · ${c.descricao || "Cobrança"} · venceu ${dBR(c.vencimento)} (${dias} dia${dias === 1 ? "" : "s"})`, porque: "O cliente ainda não pagou. Vale lembrar por WhatsApp ou e-mail." });
  }
  for (const e of emails) {
    itens.push({ chave: `email:${e.id}`, bloco: "Dinheiro em risco", onde: "Cobranças",
      titulo: e.status === "devolvido" ? "E-mail de cobrança devolvido" : e.status === "spam" ? "E-mail marcado como spam" : "E-mail de cobrança não enviado",
      detalhe: `${e.para} · ${e.assunto || ""} · ${dBR(String(e.created_at).slice(0, 10))}`, porque: "O cliente não recebeu a cobrança." });
  }
  const nomeCartao = new Map(cartoes.map((c: any) => [c.id, c.nome]));
  for (const f of faturas) {
    const aberto = Number(f.valor_total) - Number(f.valor_pago);
    if (aberto <= 0.009) continue;
    const dias = diasEntre(hoje, f.data_vencimento);
    itens.push({ chave: `fatura:${f.id}`, bloco: "Dinheiro em risco", onde: "Contas → Pagar fatura", titulo: dias < 0 ? "Fatura de cartão vencida" : "Fatura de cartão vencendo", valor: aberto,
      detalhe: `${nomeCartao.get(f.cartao_id) || "Cartão"} · vence ${dBR(f.data_vencimento)}${dias >= 0 ? (dias === 0 ? " (hoje)" : ` (em ${dias} dia${dias === 1 ? "" : "s"})`) : ""}`,
      porque: 'Pague pelo "Pagar fatura" para o valor sair da conta certa.' });
  }
  for (const c of contratos.filter((x: any) => x.gerar_receitas === false && x.asaas_subscription_id)) {
    itens.push({ chave: `contrato-sem-geracao:${c.id}`, bloco: "Dinheiro em risco", onde: "Contratos", titulo: "Assinatura do Asaas ativa sem receitas lançadas", valor: Number(c.valor),
      detalhe: `${nomeDe(c)} · ${c.descricao}`, porque: "O Asaas continua cobrando todo mês. Encerre o contrato se o serviço acabou, ou volte a gerar as receitas." });
  }
  for (const c of fCob.filter((f) => f.linhas.some((l: any) => !l.receita_id))) {
    itens.push({ chave: `cob-sem-receita:${c.id}`, bloco: "Ajustes de cadastro", onde: "Cobranças → Conciliar", titulo: "Cobrança sem lançamento", valor: c.valor,
      detalhe: `${nomeDe(c)} · ${c.descricao || "Cobrança"} · vence ${dBR(c.vencimento)}`, porque: "Não aparece como receita a receber nem dá baixa sozinha quando for paga." });
  }
  const compart = new Map<string, number>();
  for (const c of contratos) if (c.asaas_subscription_id) compart.set(c.asaas_subscription_id, (compart.get(c.asaas_subscription_id) || 0) + 1);
  for (const c of contratos) {
    if (c.data_fim && c.data_fim < hoje) {
      itens.push({ chave: `contrato-vencido:${c.id}`, bloco: "Ajustes de cadastro", onde: "Contratos", titulo: "Contrato já terminou e continua ativo", valor: Number(c.valor),
        detalhe: `${nomeDe(c)} · ${c.descricao} · terminou ${dBR(c.data_fim)}`, porque: "Entra no MRR e nas projeções como se ainda estivesse valendo." });
      continue;
    }
    if (c.gerar_receitas === false || c.recorrencia === "unico") continue;
    if (c.asaas_subscription_id && (compart.get(c.asaas_subscription_id) || 0) > 1) continue;
    const dif = recAbertas.filter((r: any) => r.contrato_id === c.id && r.data_vencimento >= hoje && Math.abs(Number(r.valor) - Number(c.valor)) > 0.009);
    if (dif.length) {
      itens.push({ chave: `contrato-valor:${c.id}`, bloco: "Ajustes de cadastro", onde: "Fluxo de caixa", titulo: "Valor do contrato diferente das receitas", valor: Number(c.valor),
        detalhe: `${nomeDe(c)} · ${c.descricao} · ${dif.length} receita(s) futura(s) com ${[...new Set(dif.map((r: any) => brl(Number(r.valor))))].join(", ")}`,
        porque: 'Previsões e MRR usam valores que não batem. Se o valor varia todo mês, marque "Não é problema" na tela de Pendências.' });
    }
  }
  const desp = despAbertas.filter((d: any) => d.fornecedor !== "[pagamento-fatura]");
  const cobrancaDe = new Map<string, string>(cobs.filter((c: any) => c.receita_id).map((c: any) => [c.receita_id, c.id]));
  const pend = [
    ...recAbertas.map((r: any) => ({ id: r.id, descricao: r.descricao, valor: Number(r.valor), data_vencimento: r.data_vencimento, tipo: "receita", fornecedor_cliente: nomeDe(r) })),
    ...desp.map((d: any) => ({ id: d.id, descricao: d.descricao, valor: Number(d.valor), data_vencimento: d.data_vencimento, tipo: "despesa", fornecedor_cliente: d.fornecedor || "Sem fornecedor" })),
  ];
  for (const g of gruposDuplicados(pend, cobrancaDe)) {
    itens.push({ chave: `duplicado:${g.map((i) => i.id).sort().join(",")}`, bloco: "Ajustes de cadastro", onde: "Fluxo de caixa", titulo: `Possível duplicado (${g.length} lançamentos)`, valor: g[0].valor,
      detalhe: `${g[0].fornecedor_cliente} · ${g.map((i) => `${i.descricao} (${dBR(i.data_vencimento)})`).join(" · ")}`, porque: "Mesmo valor, mesmo cliente/fornecedor e mesmo mês. Se for lançamento repetido, exclua um." });
  }
  for (const d of despSemConta) {
    itens.push({ chave: `desp-sem-conta:${d.id}`, bloco: "Ajustes de cadastro", onde: "Fluxo de caixa", titulo: "Despesa paga sem conta", valor: Number(d.valor),
      detalhe: `${d.descricao}${d.data_pagamento ? ` · paga ${dBR(d.data_pagamento)}` : ""}`, porque: "O dinheiro não saiu de nenhuma conta, então o saldo fica maior do que o real." });
  }
  for (const r of recSemConta) {
    itens.push({ chave: `rec-sem-conta:${r.id}`, bloco: "Ajustes de cadastro", onde: "Fluxo de caixa", titulo: "Receita recebida sem conta", valor: Number(r.valor),
      detalhe: `${nomeDe(r)} · ${r.descricao}${r.data_recebimento ? ` · recebida ${dBR(r.data_recebimento)}` : ""}`, porque: "O dinheiro não entrou em nenhuma conta, então o saldo fica menor do que o real." });
  }
  for (const c of fCob) {
    if (!c.linhas.some((l: any) => l.exigir_nf) || c.linhas.some(temNota) || !["pendente", "vencido"].includes(c.status)) continue;
    itens.push({ chave: `nf:${c.id}`, bloco: "Documentos", onde: "Cobranças", titulo: "Nota fiscal exigida e não anexada", valor: c.valor,
      detalhe: `${nomeDe(c)} · ${c.descricao || "Cobrança"} · vence ${dBR(c.vencimento)}`, porque: "Sem a nota, a cobrança não é disparada." });
  }
  const limite = somaDias(hoje, 7);
  for (const d of desp) {
    if (d.fornecedor === "[fatura]" || !d.data_vencimento || d.data_vencimento > limite || temAnexo(d)) continue;
    itens.push({ chave: `boleto:${d.id}`, bloco: "Documentos", onde: "Fluxo de caixa", titulo: "Conta a pagar sem boleto anexado", valor: Number(d.valor),
      detalhe: `${d.fornecedor ? `${d.fornecedor} · ` : ""}${d.descricao} · vence ${dBR(d.data_vencimento)}`, porque: 'Anexe o boleto para pagar sem procurar no e-mail. Se não tem boleto (débito automático, Pix), marque "Não é problema".' });
  }
  const ignoradas = new Set(ign.map((i: any) => i.chave));
  const visiveis = itens.filter((p) => !ignoradas.has(p.chave)).map(({ chave: _c, ...p }) => ({ ...p, valor: p.valor != null ? r2(p.valor) : undefined }));
  const blocos: Record<string, number> = {};
  for (const p of visiveis) blocos[p.bloco] = (blocos[p.bloco] || 0) + 1;
  return {
    total: visiveis.length, por_bloco: blocos, marcadas_como_nao_problema: itens.length - visiveis.length,
    pendencias: visiveis.slice(0, 40),
    obs: "Mesma lista da tela Pendências (menu). Itens que a pessoa marcou como \"Não é problema\" ficam de fora.",
  };
}

// ---------------------------------------------------------------- Metas
export async function metas(ctx: CtxConsulta, a: { meses?: number }) {
  const n = Math.min(12, Math.max(1, Math.floor(a.meses || 3)));
  const [y, m] = ctx.hoje.split("-").map(Number);
  const meses: string[] = [];
  for (let i = 0; i < n; i++) { const t = y * 12 + (m - 1) - i; meses.push(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`); }
  const ini = `${meses[meses.length - 1]}-01`;
  const [linhas, rec] = await Promise.all([
    ctx.safe<any>(ctx.db.from("metas").select("tipo, periodo, valor_meta").eq("tipo", "faturamento")),
    ctx.safe<any>(ctx.db.from("receitas").select("valor, data_recebimento").eq("status", "recebido").gte("data_recebimento", ini).lte("data_recebimento", ctx.hoje)),
  ]);
  const ultimoDia = (ym: string) => { const [a1, b1] = ym.split("-").map(Number); return new Date(Date.UTC(a1, b1, 0)).getUTCDate(); };
  const out = meses.map((ym) => {
    const meta = linhas.find((x: any) => x.periodo === ym);
    const alvo = Number(meta?.valor_meta ?? 15000);
    const feito = rec.filter((r: any) => String(r.data_recebimento).slice(0, 7) === ym).reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
    const atual = ym === ctx.hoje.slice(0, 7);
    const diasRest = atual ? ultimoDia(ym) - Number(ctx.hoje.slice(8, 10)) : 0;
    const falta = Math.max(alvo - feito, 0);
    return {
      mes: ym, meta: r2(alvo), meta_definida: !!meta, recebido: r2(feito), pct: alvo ? Math.round((feito / alvo) * 1000) / 10 : 0,
      falta: r2(falta), atingida: feito >= alvo,
      ...(atual ? { dias_restantes: diasRest, precisa_por_dia: diasRest > 0 ? r2(falta / diasRest) : r2(falta) } : {}),
    };
  });
  return {
    metas: out,
    como_calcula: "Meta de faturamento do Início: soma do que foi RECEBIDO no mês (pela data do recebimento) ÷ meta do mês. Sem meta definida, o app usa R$ 15.000.",
  };
}

// ---------------------------------------------------------------- Pagamentos de uma fatura
export async function pagamentosDaFatura(ctx: CtxConsulta, contas: any[], faturaId: string) {
  const ps = await ctx.safe<any>(ctx.db.from("cartao_fatura_pagamentos").select("valor, data_pagamento, conta_id").eq("fatura_id", faturaId));
  return ps.map((p: any) => ({ data: p.data_pagamento, valor: r2(Number(p.valor || 0)), conta: contas.find((c) => c.id === p.conta_id)?.nome || "Conta" }))
    .sort((x: any, y: any) => String(x.data).localeCompare(String(y.data)));
}
