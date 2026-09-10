import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface RequestBody {
  messages: Message[];
  period: "current_month" | "last_3_months" | "last_6_months" | "current_year";
}

function getPeriodDates(period: string): { startDate: string; endDate: string; periodLabel: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let startDate: Date;
  const endDate = new Date(year, month + 1, 0); // último dia do mês atual
  let periodLabel: string;
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  switch (period) {
    case "last_3_months":
      startDate = new Date(year, month - 2, 1);
      periodLabel = "Últimos 3 meses";
      break;
    case "last_6_months":
      startDate = new Date(year, month - 5, 1);
      periodLabel = "Últimos 6 meses";
      break;
    case "current_year":
      startDate = new Date(year, 0, 1);
      periodLabel = `Ano ${year}`;
      break;
    case "current_month":
    default:
      startDate = new Date(year, month, 1);
      periodLabel = `${monthNames[month]} ${year}`;
      break;
  }

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    periodLabel,
  };
}

function fmt(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function monthsBetween(startDate: string, endDate: string): number {
  const s = new Date(startDate);
  const e = new Date(endDate);
  return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1);
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

async function safe<T>(p: PromiseLike<{ data: T | null }>): Promise<T[]> {
  try {
    const { data } = await p;
    return (data as T[]) || [];
  } catch (_e) {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    // Cliente autenticado como o usuário → a RLS já limita os dados ao tenant/usuário dele.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fair-use: teto diário generoso por usuário (anti-abuso — uso normal nunca encosta).
    // Falha ABERTA se a RPC ainda não existir (não bloqueia por erro de infra).
    try {
      const limiteDia = Number(Deno.env.get("IARA_LIMITE_DIA") || "120");
      const { data: uso } = await supabase.rpc("iara_registrar_uso", { p_limite: limiteDia });
      if (uso && (uso as { bloqueado?: boolean }).bloqueado) {
        return new Response(JSON.stringify({ error: `Você atingiu o limite de ${limiteDia} perguntas à IARA por hoje. Volte amanhã 🙂` }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (_e) { /* fail open */ }

    const { messages, period }: RequestBody = await req.json();
    const { startDate, endDate, periodLabel } = getPeriodDates(period);
    const hojeISO = new Date().toISOString().split("T")[0];
    const numMeses = monthsBetween(startDate, endDate);

    // ---- Busca de dados (em paralelo). Tudo já vem filtrado pela RLS do usuário. ----
    const [receitas, despesas, contratos, contas, transferencias, clientes, metas, faturas] = await Promise.all([
      safe<any>(supabase.from("receitas").select("*, cliente:clientes(nome), categoria:categorias(nome)").gte("data_competencia", startDate).lte("data_competencia", endDate)),
      safe<any>(supabase.from("despesas").select("*, categoria:categorias(nome)").gte("data_competencia", startDate).lte("data_competencia", endDate)),
      safe<any>(supabase.from("contratos").select("*, cliente:clientes(nome)").eq("status", "ativo")),
      safe<any>(supabase.from("contas").select("*").eq("ativa", true)),
      safe<any>(supabase.from("transferencias").select("*")),
      safe<any>(supabase.from("clientes").select("id, nome, status")),
      safe<any>(supabase.from("metas").select("*")),
      safe<any>(supabase.from("cartao_faturas").select("*")),
    ]);

    const profileRows = await safe<any>(supabase.from("profiles").select("nome").limit(1));
    const nomeUsuario = profileRows[0]?.nome || "";

    // ---- Métricas de receita/despesa ----
    const receitasRecebidas = receitas.filter(r => r.status === "recebido");
    const receitasPendentes = receitas.filter(r => r.status === "pendente");
    const receitasAtrasadas = receitas.filter(r => r.status === "atrasado");
    const despesasPagas = despesas.filter(d => d.status === "pago");
    const despesasPendentes = despesas.filter(d => d.status === "pendente");
    const despesasAtrasadas = despesas.filter(d => d.status === "atrasado");

    const sum = (arr: any[]) => arr.reduce((s, x) => s + Number(x.valor || 0), 0);
    const totalRecebido = sum(receitasRecebidas);
    const totalReceitaPendente = sum(receitasPendentes);
    const totalReceitaAtrasada = sum(receitasAtrasadas);
    const totalPago = sum(despesasPagas);
    const totalDespesaPendente = sum(despesasPendentes);
    const totalDespesaAtrasada = sum(despesasAtrasadas);

    const lucro = totalRecebido - totalPago;
    const margem = totalRecebido > 0 ? ((lucro / totalRecebido) * 100).toFixed(1) : "0";

    // ---- Saldo por conta (contas bancárias) e faturas de cartão ----
    const bancarias = contas.filter(c => c.tipo !== "cartao_credito");
    const cartoes = contas.filter(c => c.tipo === "cartao_credito");

    const saldoConta = (conta: any) => {
      const recC = receitas.filter(r => r.conta_id === conta.id && r.status === "recebido").reduce((s, r) => s + Number(r.valor || 0), 0);
      const despC = despesas.filter(d => d.conta_id === conta.id && d.status === "pago").reduce((s, d) => s + Number(d.valor || 0), 0);
      const tIn = transferencias.filter(t => t.conta_destino_id === conta.id).reduce((s, t) => s + Number(t.valor || 0), 0);
      const tOut = transferencias.filter(t => t.conta_origem_id === conta.id).reduce((s, t) => s + Number(t.valor || 0), 0);
      return Number(conta.saldo_inicial || 0) + recC - despC + tIn - tOut;
    };
    const saldosBancarios = bancarias.map(c => ({ nome: c.nome, saldo: saldoConta(c) }));
    const caixaTotal = saldosBancarios.reduce((s, c) => s + c.saldo, 0);

    // Faturas de cartão abertas (não pagas)
    const faturasAbertas = faturas.filter(f => {
      const total = Number(f.valor_total || 0);
      const pago = Number(f.valor_pago || 0);
      const aberto = total - pago;
      const statusAberto = !f.status || ["aberta", "fechada", "pendente", "atrasada"].includes(String(f.status).toLowerCase());
      return aberto > 0.005 && statusAberto;
    });
    const totalFaturasAbertas = faturasAbertas.reduce((s, f) => s + (Number(f.valor_total || 0) - Number(f.valor_pago || 0)), 0);

    // ---- MRR / ARR ----
    const mrr = contratos.reduce((s, c) => {
      const v = Number(c.valor || 0);
      if (c.recorrencia === "mensal") return s + v;
      if (c.recorrencia === "trimestral") return s + v / 3;
      if (c.recorrencia === "semestral") return s + v / 6;
      if (c.recorrencia === "anual") return s + v / 12;
      return s;
    }, 0);

    // ---- Despesas por categoria (todas, ordenadas) ----
    const porCategoria: Record<string, number> = {};
    for (const d of despesasPagas) {
      const cat = d.categoria?.nome || "Sem categoria";
      porCategoria[cat] = (porCategoria[cat] || 0) + Number(d.valor || 0);
    }
    const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);

    // ---- Receita por cliente (top) ----
    const porCliente: Record<string, number> = {};
    for (const r of receitas) {
      const nome = r.cliente?.nome || "Sem cliente";
      porCliente[nome] = (porCliente[nome] || 0) + Number(r.valor || 0);
    }
    const clientesOrdenados = Object.entries(porCliente).filter(([n]) => n !== "Sem cliente").sort((a, b) => b[1] - a[1]);

    // ---- Runway (meses de caixa cobrindo a despesa média mensal) ----
    const despesaMediaMensal = totalPago / numMeses;
    const runway = despesaMediaMensal > 0 ? (caixaTotal / despesaMediaMensal).toFixed(1) : "∞";

    // ---- Metas do período ----
    const metasResumo = metas.map(m => {
      const alvo = Number(m.valor_meta ?? m.valor ?? 0);
      const tipo = m.tipo || "meta";
      let realizado = 0;
      if (tipo === "faturamento") realizado = totalRecebido;
      const pct = alvo > 0 ? ((realizado / alvo) * 100).toFixed(0) : "0";
      return { tipo, periodo: m.periodo || "", alvo, realizado, pct };
    });

    // ---- Aging (top atrasados) ----
    const topAtrasadosRec = receitasAtrasadas
      .sort((a, b) => Number(b.valor) - Number(a.valor)).slice(0, 5)
      .map(r => `  • ${r.descricao || r.cliente?.nome || "Receita"} — ${fmt(Number(r.valor))} (venc. ${r.data_vencimento || "?"})`);
    const topAtrasadosDesp = despesasAtrasadas
      .sort((a, b) => Number(b.valor) - Number(a.valor)).slice(0, 5)
      .map(d => `  • ${d.descricao || d.categoria?.nome || "Despesa"} — ${fmt(Number(d.valor))} (venc. ${d.data_vencimento || "?"})`);

    // ---- Monta o contexto financeiro ----
    const contexto = `
DATA DE HOJE: ${hojeISO}
PERÍODO ANALISADO: ${periodLabel} (${startDate} a ${endDate})
${nomeUsuario ? `USUÁRIO: ${nomeUsuario}` : ""}

CAIXA (contas bancárias):
${saldosBancarios.length ? saldosBancarios.map(c => `- ${c.nome}: ${fmt(c.saldo)}`).join("\n") : "- (nenhuma conta ativa)"}
Total em caixa: ${fmt(caixaTotal)}
Runway (caixa ÷ despesa média mensal): ${runway} ${runway === "∞" ? "" : "meses"}

CARTÕES DE CRÉDITO:
- Cartões ativos: ${cartoes.length}
- Total em faturas abertas: ${fmt(totalFaturasAbertas)}

RECEITAS (${periodLabel}):
- Recebido: ${fmt(totalRecebido)}
- A receber (pendente): ${fmt(totalReceitaPendente)}
- Atrasado: ${fmt(totalReceitaAtrasada)} (${receitasAtrasadas.length} título(s))
- Total previsto: ${fmt(totalRecebido + totalReceitaPendente + totalReceitaAtrasada)}

DESPESAS (${periodLabel}):
- Pago: ${fmt(totalPago)}
- A pagar (pendente): ${fmt(totalDespesaPendente)}
- Atrasado: ${fmt(totalDespesaAtrasada)} (${despesasAtrasadas.length} conta(s))
- Despesa média mensal no período: ${fmt(despesaMediaMensal)}
- Por categoria (pagas):
${categoriasOrdenadas.length ? categoriasOrdenadas.map(([c, v]) => `  • ${c}: ${fmt(v)}`).join("\n") : "  • (sem despesas pagas)"}

RESULTADO (${periodLabel}):
- Lucro líquido (recebido − pago): ${fmt(lucro)}
- Margem de lucro: ${margem}%

CONTRATOS / RECORRÊNCIA:
- Contratos ativos: ${contratos.length}
- MRR (receita mensal recorrente): ${fmt(mrr)}
- ARR (projeção anual = MRR × 12): ${fmt(mrr * 12)}

CLIENTES:
- Total cadastrados: ${clientes.length} (ativos: ${clientes.filter(c => c.status === "ativo").length})
- Top por receita no período:
${clientesOrdenados.length ? clientesOrdenados.slice(0, 5).map(([n, v], i) => `  ${i + 1}. ${n}: ${fmt(v)}`).join("\n") : "  • (sem receitas com cliente no período)"}

METAS:
${metasResumo.length ? metasResumo.map(m => `- ${m.tipo}${m.periodo ? ` (${m.periodo})` : ""}: ${fmt(m.realizado)} de ${fmt(m.alvo)} (${m.pct}%)`).join("\n") : "- (nenhuma meta definida)"}

CONTAS EM ATRASO (aging):
- A receber atrasado: ${fmt(totalReceitaAtrasada)}
${topAtrasadosRec.length ? topAtrasadosRec.join("\n") : "  • (nenhuma)"}
- A pagar atrasado: ${fmt(totalDespesaAtrasada)}
${topAtrasadosDesp.length ? topAtrasadosDesp.join("\n") : "  • (nenhuma)"}
`.trim();

    // ---- System prompt da IARA ----
    const systemPrompt = `Você é a IARA, a assistente financeira do BALANX — um sistema de gestão financeira para pessoas e agências no Brasil. Você conversa em português do Brasil.

## Quem você é
- Uma assistente financeira consultiva, clara e confiável. Fala de forma acolhedora e objetiva, sem jargão desnecessário.
- Você analisa os DADOS REAIS da conta de quem está falando com você (fornecidos abaixo em "CONTEXTO FINANCEIRO"). Esses dados já vêm filtrados e pertencem exclusivamente a este usuário/tenant.
${nomeUsuario ? `- O nome da pessoa é ${nomeUsuario}. Trate-a pelo primeiro nome quando fizer sentido.` : ""}

## Regra de ouro: baseie-se SEMPRE nos dados reais
- Use exclusivamente os números do CONTEXTO FINANCEIRO. Nunca invente valores, clientes, contas ou datas.
- Se a pessoa perguntar algo que os dados não cobrem (ou o período selecionado não inclui), diga isso com transparência e sugira trocar o período ou onde encontrar no app (Receitas, Despesas, Contas, Cartões, Contratos, Relatórios, Calendário).
- Ao citar um número, use os valores exatos do contexto e formate em Real (R$ 1.234,56). Mostre a conta quando ajudar ("lucro = recebido − pago").
- O período analisado agora é: ${periodLabel}. Deixe claro a qual período seus números se referem.

## O que você faz muito bem
- Explica o fluxo de caixa, saldo por conta, runway e para onde o dinheiro está indo (despesas por categoria).
- Analisa receitas x despesas, margem de lucro, MRR/ARR e projeções a partir de contratos ativos.
- Aponta atrasos (a receber e a pagar), concentração de receita em poucos clientes e categorias que pesam demais.
- Orienta sobre distribuição de lucro (pró-labore/retirada) de forma conservadora, sempre preservando uma reserva de emergência de 3 a 6 meses de despesa média mensal.
- Ajuda a montar relatórios simples (resumo do mês, DRE simplificado, comparativos, top clientes) a partir dos dados.

## Limites de segurança (inegociáveis)
- Você NÃO recomenda investimentos de risco (ações específicas, cripto, day-trade, derivativos, "oportunidades", câmbio especulativo) e NÃO dá recomendação personalizada de investimento — você não é consultora de valores mobiliários certificada. Se pedirem, explique isso com gentileza e redirecione para o que você faz: organizar o caixa, reduzir custos, planejar reserva e distribuir lucro com segurança. No máximo, fale de forma genérica e educativa sobre reserva em liquidez/baixo risco, sem indicar produtos.
- Priorize sempre a saúde financeira: reserva de emergência antes de retiradas maiores; alertar quando o runway estiver curto (< 3 meses) ou a margem negativa.
- Nunca peça nem exponha senhas, tokens, dados de cartão ou credenciais. Não invente dados pessoais.
- Se a margem estiver negativa ou o caixa apertado, seja honesta e construtiva: aponte os maiores ofensores (categorias/atrasos) e próximos passos práticos.

## Períodos e datas (MUITO IMPORTANTE)
- HOJE é ${hojeISO}. O bloco "CONTEXTO FINANCEIRO" abaixo é um panorama do período "${periodLabel}" selecionado no app. Para QUALQUER outro período que a pessoa mencionar, você DEVE usar as ferramentas para consultar os dados reais daquele intervalo — nunca estime.
- Traduza expressões em datas ISO (YYYY-MM-DD) a partir de HOJE (${hojeISO}), fuso do Brasil, semana de segunda a domingo:
  • "hoje" → ${hojeISO} a ${hojeISO}; "amanhã" → dia seguinte; "depois de amanhã" → +2 dias; "ontem" → dia anterior.
  • "essa semana" → segunda a domingo da semana atual; "semana passada" → segunda a domingo da semana anterior; "próxima semana" → a seguinte.
  • "esse mês"/"resto do mês" → de HOJE até o último dia do mês atual; "mês passado" → 1º ao último dia do mês anterior.
  • "do dia X ao dia Y", "entre X e Y" → use exatamente essas datas (assuma o mês/ano atual se só vier o dia).
- Escolha a ferramenta certa:
  • Perguntas de resultado/desempenho ("quanto faturei/gastei/lucrei", "margem", "por categoria", "top clientes") → resumo_financeiro (regime de competência).
  • Perguntas de agenda/caixa futuro-ou-passado por data ("o que vence/tenho a pagar/a receber", "hoje", "amanhã", "essa semana", "resto do mês") → agenda_vencimentos (por data de vencimento).
  • Procurar por fornecedor/descrição ("quanto paguei pra X") → buscar_lancamento. Panorama de um cliente → detalhe_cliente. Saldo atual/cartões → saldo_e_contas. Projeção de caixa futuro → projecao_fluxo. Comparar dois períodos → comparativo_periodos.
- Você pode chamar mais de uma ferramenta antes de responder (ex.: saldo_e_contas + projecao_fluxo para dizer se vai faltar caixa).
- Se a pessoa não disser o período, responda com o período do contexto ("${periodLabel}") e diga qual período usou. Sempre deixe claro o intervalo que os números cobrem.

## Estilo das respostas
- Responda em Markdown. Comece pela conclusão/resposta direta e depois os detalhes.
- Use listas curtas e, quando útil, uma mini-tabela. Emojis com muita moderação (no máximo 1–2 quando destacam algo importante).
- Seja concisa: nada de textos longos quando um parágrafo resolve. Ofereça um próximo passo acionável quando fizer sentido.
- Termine oferecendo aprofundar ("Quer que eu detalhe as despesas por categoria?") quando couber.

# CONTEXTO FINANCEIRO (dados reais deste usuário)
${contexto}`;

    // ---- Ferramentas: a IARA consulta a fonte para QUALQUER intervalo de datas ----
    // Ferramentas enxutas (descrições curtas = menos tokens por chamada). O roteamento
    // detalhado está no system prompt; aqui basta o essencial. Mesmas 7 capacidades.
    const D = { type: "string", description: "YYYY-MM-DD" };
    const TOOLS = [
      { type: "function", function: { name: "resumo_financeiro", description: "Resultado por competência num intervalo: recebido, a receber, pago, a pagar, lucro, margem, despesas por categoria e receita por cliente. Use p/ faturamento, gastos, lucro, margem, top categorias/clientes.", parameters: { type: "object", properties: { inicio: D, fim: D }, required: ["inicio", "fim"] } } },
      { type: "function", function: { name: "agenda_vencimentos", description: "Lançamentos por data de VENCIMENTO (o que vence/entra/sai) + totais a receber/pagar. Use p/ hoje, amanhã, essa semana, resto do mês, do dia X ao Y, contas a pagar/receber.", parameters: { type: "object", properties: { inicio: D, fim: D, tipo: { type: "string", enum: ["receita", "despesa", "ambos"], description: "padrão: ambos" }, status: { type: "string", enum: ["pago", "recebido", "pendente", "atrasado"], description: "opcional" } }, required: ["inicio", "fim"] } } },
      { type: "function", function: { name: "buscar_lancamento", description: "Procura receitas/despesas por texto na descrição ou fornecedor. Ex: 'quanto paguei pra X', 'gastos com energia'.", parameters: { type: "object", properties: { termo: { type: "string", description: "texto a procurar" } }, required: ["termo"] } } },
      { type: "function", function: { name: "detalhe_cliente", description: "Panorama de um cliente: faturado, recebido, a receber, atrasado, contratos ativos e MRR. Ex: 'como está o cliente X', 'quanto Y me deve'.", parameters: { type: "object", properties: { nome: { type: "string", description: "nome ou parte" } }, required: ["nome"] } } },
      { type: "function", function: { name: "saldo_e_contas", description: "Saldo atual de cada conta + total em caixa e cartões (fatura aberta, limite, disponível). Ex: 'meu saldo', 'como estão meus cartões'.", parameters: { type: "object", properties: {} } } },
      { type: "function", function: { name: "projecao_fluxo", description: "Projeta a variação de caixa nos próximos N dias (a receber − a pagar por vencimento). Ex: 'vou ter caixa mês que vem'. Combine com saldo_e_contas.", parameters: { type: "object", properties: { dias: { type: "number", description: "dias à frente (ex: 30)" } }, required: ["dias"] } } },
      { type: "function", function: { name: "comparativo_periodos", description: "Compara dois intervalos por competência (recebido, pago, lucro, margem) com variação %. Ex: 'esse mês vs passado'.", parameters: { type: "object", properties: { inicio_a: D, fim_a: D, inicio_b: D, fim_b: D }, required: ["inicio_a", "fim_a", "inicio_b", "fim_b"] } } },
    ];

    async function computeResumo(inicio: string, fim: string) {
      const [rec, desp] = await Promise.all([
        safe<any>(supabase.from("receitas").select("valor,status,cliente:clientes(nome),categoria:categorias(nome)").gte("data_competencia", inicio).lte("data_competencia", fim)),
        safe<any>(supabase.from("despesas").select("valor,status,categoria:categorias(nome)").gte("data_competencia", inicio).lte("data_competencia", fim)),
      ]);
      const s = (arr: any[]) => arr.reduce((t, x) => t + Number(x.valor || 0), 0);
      const recebido = s(rec.filter(r => r.status === "recebido"));
      const aReceber = s(rec.filter(r => r.status === "pendente"));
      const atrasadoReceber = s(rec.filter(r => r.status === "atrasado"));
      const pago = s(desp.filter(d => d.status === "pago"));
      const aPagar = s(desp.filter(d => d.status === "pendente"));
      const atrasadoPagar = s(desp.filter(d => d.status === "atrasado"));
      const lucroP = recebido - pago;
      const cat: Record<string, number> = {};
      for (const d of desp.filter(d => d.status === "pago")) { const c = d.categoria?.nome || "Sem categoria"; cat[c] = (cat[c] || 0) + Number(d.valor || 0); }
      const cli: Record<string, number> = {};
      for (const r of rec) { const n = r.cliente?.nome; if (n) cli[n] = (cli[n] || 0) + Number(r.valor || 0); }
      return {
        periodo: { inicio, fim },
        recebido, a_receber: aReceber, atrasado_a_receber: atrasadoReceber,
        pago, a_pagar: aPagar, atrasado_a_pagar: atrasadoPagar,
        lucro: lucroP, margem_pct: recebido > 0 ? Number(((lucroP / recebido) * 100).toFixed(1)) : 0,
        despesas_por_categoria: Object.fromEntries(Object.entries(cat).sort((a, b) => b[1] - a[1]).slice(0, 10)),
        receita_por_cliente: Object.fromEntries(Object.entries(cli).sort((a, b) => b[1] - a[1]).slice(0, 10)),
      };
    }

    async function toolResumo(inicio: string, fim: string): Promise<string> {
      return JSON.stringify(await computeResumo(inicio, fim));
    }

    async function toolComparativo(iA: string, fA: string, iB: string, fB: string): Promise<string> {
      const [a, b] = await Promise.all([computeResumo(iA, fA), computeResumo(iB, fB)]);
      const varPct = (x: number, y: number) => (y !== 0 ? Number((((x - y) / Math.abs(y)) * 100).toFixed(1)) : null);
      return JSON.stringify({
        periodo_a: a, periodo_b: b,
        variacao: {
          recebido_pct: varPct(a.recebido, b.recebido),
          pago_pct: varPct(a.pago, b.pago),
          lucro_pct: varPct(a.lucro, b.lucro),
        },
      });
    }

    function sanitize(t: string) { return (t || "").replace(/[%,()]/g, " ").trim(); }

    async function toolBuscar(termo: string): Promise<string> {
      const t = sanitize(termo);
      if (!t) return JSON.stringify({ erro: "termo vazio" });
      const [rec, desp] = await Promise.all([
        safe<any>(supabase.from("receitas").select("descricao,valor,status,data_vencimento,data_competencia,cliente:clientes(nome)").ilike("descricao", `%${t}%`).limit(25)),
        safe<any>(supabase.from("despesas").select("descricao,fornecedor,valor,status,data_vencimento,data_competencia,categoria:categorias(nome)").or(`descricao.ilike.%${t}%,fornecedor.ilike.%${t}%`).limit(25)),
      ]);
      const itens = [
        ...rec.map(r => ({ tipo: "receita", descricao: r.descricao, quem: r.cliente?.nome || null, valor: Number(r.valor || 0), status: r.status, vencimento: r.data_vencimento, competencia: r.data_competencia })),
        ...desp.map(d => ({ tipo: "despesa", descricao: d.descricao || d.fornecedor, quem: d.fornecedor || d.categoria?.nome || null, valor: Number(d.valor || 0), status: d.status, vencimento: d.data_vencimento, competencia: d.data_competencia })),
      ];
      const totalDespesas = itens.filter(i => i.tipo === "despesa").reduce((s, i) => s + i.valor, 0);
      const totalReceitas = itens.filter(i => i.tipo === "receita").reduce((s, i) => s + i.valor, 0);
      return JSON.stringify({ termo: t, encontrados: itens.length, total_receitas: totalReceitas, total_despesas: totalDespesas, itens: itens.slice(0, 40) });
    }

    async function toolDetalheCliente(nome: string): Promise<string> {
      const t = sanitize(nome);
      const clientesMatch = await safe<any>(supabase.from("clientes").select("id,nome,status,cpf_cnpj").ilike("nome", `%${t}%`).limit(1));
      if (!clientesMatch.length) return JSON.stringify({ erro: `Nenhum cliente encontrado para "${nome}".` });
      const cli = clientesMatch[0];
      const [rec, contratosCli] = await Promise.all([
        safe<any>(supabase.from("receitas").select("valor,status").eq("cliente_id", cli.id)),
        safe<any>(supabase.from("contratos").select("valor,recorrencia,status").eq("cliente_id", cli.id).eq("status", "ativo")),
      ]);
      const s = (arr: any[], st?: string) => arr.filter(x => !st || x.status === st).reduce((t2, x) => t2 + Number(x.valor || 0), 0);
      const mrr = contratosCli.reduce((sum, c) => {
        const v = Number(c.valor || 0);
        if (c.recorrencia === "mensal") return sum + v;
        if (c.recorrencia === "trimestral") return sum + v / 3;
        if (c.recorrencia === "semestral") return sum + v / 6;
        if (c.recorrencia === "anual") return sum + v / 12;
        return sum;
      }, 0);
      return JSON.stringify({
        cliente: cli.nome, status: cli.status, documento: cli.cpf_cnpj || null,
        faturado_total: s(rec), recebido: s(rec, "recebido"), a_receber: s(rec, "pendente"), atrasado: s(rec, "atrasado"),
        contratos_ativos: contratosCli.length, mrr_cliente: mrr,
      });
    }

    async function toolSaldoContas(): Promise<string> {
      const [contasAll, rec, desp, transf, faturas] = await Promise.all([
        safe<any>(supabase.from("contas").select("*").eq("ativa", true)),
        safe<any>(supabase.from("receitas").select("valor,conta_id").eq("status", "recebido")),
        safe<any>(supabase.from("despesas").select("valor,conta_id").eq("status", "pago")),
        safe<any>(supabase.from("transferencias").select("valor,conta_origem_id,conta_destino_id")),
        safe<any>(supabase.from("cartao_faturas").select("valor_total,valor_pago,data_vencimento,status,cartao_id")),
      ]);
      const bancarias = contasAll.filter(c => c.tipo !== "cartao_credito");
      const cartoesC = contasAll.filter(c => c.tipo === "cartao_credito");
      const saldo = (c: any) => Number(c.saldo_inicial || 0)
        + rec.filter(r => r.conta_id === c.id).reduce((s, r) => s + Number(r.valor || 0), 0)
        - desp.filter(d => d.conta_id === c.id).reduce((s, d) => s + Number(d.valor || 0), 0)
        + transf.filter(t => t.conta_destino_id === c.id).reduce((s, t) => s + Number(t.valor || 0), 0)
        - transf.filter(t => t.conta_origem_id === c.id).reduce((s, t) => s + Number(t.valor || 0), 0);
      const contasSaldo = bancarias.map(c => ({ nome: c.nome, banco: c.banco || null, saldo: saldo(c) }));
      const cartoesInfo = cartoesC.map(c => {
        const aberto = faturas.filter(f => f.cartao_id === c.id).reduce((s, f) => s + Math.max(Number(f.valor_total || 0) - Number(f.valor_pago || 0), 0), 0);
        const limite = Number(c.limite || 0);
        return { nome: c.nome, bandeira: c.bandeira || null, limite, fatura_aberta: aberto, disponivel: Math.max(limite - aberto, 0) };
      });
      return JSON.stringify({
        contas: contasSaldo, total_caixa: contasSaldo.reduce((s, c) => s + c.saldo, 0),
        cartoes: cartoesInfo, total_faturas_abertas: cartoesInfo.reduce((s, c) => s + c.fatura_aberta, 0),
      });
    }

    async function toolProjecao(dias: number): Promise<string> {
      const start = hojeISO;
      const end = addDaysISO(hojeISO, Math.max(1, Math.floor(dias || 30)));
      const [rec, desp] = await Promise.all([
        safe<any>(supabase.from("receitas").select("valor,status,data_vencimento").gte("data_vencimento", start).lte("data_vencimento", end).neq("status", "recebido")),
        safe<any>(supabase.from("despesas").select("valor,status,data_vencimento").gte("data_vencimento", start).lte("data_vencimento", end).neq("status", "pago")),
      ]);
      const aReceber = rec.reduce((s, r) => s + Number(r.valor || 0), 0);
      const aPagar = desp.reduce((s, d) => s + Number(d.valor || 0), 0);
      return JSON.stringify({
        periodo: { inicio: start, fim: end, dias: Math.max(1, Math.floor(dias || 30)) },
        a_receber: aReceber, a_pagar: aPagar, variacao_prevista: aReceber - aPagar,
        obs: "Para o caixa projetado final, some 'variacao_prevista' ao total_caixa de saldo_e_contas.",
      });
    }

    async function toolAgenda(inicio: string, fim: string, tipo?: string, status?: string): Promise<string> {
      const wantRec = tipo !== "despesa";
      const wantDesp = tipo !== "receita";
      const [rec, desp] = await Promise.all([
        wantRec ? safe<any>(supabase.from("receitas").select("descricao,valor,status,data_vencimento,cliente:clientes(nome)").gte("data_vencimento", inicio).lte("data_vencimento", fim)) : Promise.resolve([]),
        wantDesp ? safe<any>(supabase.from("despesas").select("descricao,valor,status,data_vencimento,categoria:categorias(nome)").gte("data_vencimento", inicio).lte("data_vencimento", fim)) : Promise.resolve([]),
      ]);
      let itens = [
        ...rec.map(r => ({ data: r.data_vencimento, tipo: "receita", descricao: r.descricao || r.cliente?.nome || "Receita", valor: Number(r.valor || 0), status: r.status, quem: r.cliente?.nome || null })),
        ...desp.map(d => ({ data: d.data_vencimento, tipo: "despesa", descricao: d.descricao || d.categoria?.nome || "Despesa", valor: Number(d.valor || 0), status: d.status, quem: d.categoria?.nome || null })),
      ];
      if (status) itens = itens.filter(i => i.status === status);
      itens.sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")));
      const aReceber = itens.filter(i => i.tipo === "receita" && i.status !== "recebido").reduce((t, i) => t + i.valor, 0);
      const aPagar = itens.filter(i => i.tipo === "despesa" && i.status !== "pago").reduce((t, i) => t + i.valor, 0);
      return JSON.stringify({
        periodo: { inicio, fim },
        total_itens: itens.length,
        a_receber: aReceber, a_pagar: aPagar, saldo_previsto: aReceber - aPagar,
        itens: itens.slice(0, 40),
      });
    }

    // ---- Provedor (compatível com API da OpenAI) + loop de ferramentas ----
    const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("IARA_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "IA não configurada (defina OPENAI_API_KEY)." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiBase = (Deno.env.get("IARA_API_BASE") || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = Deno.env.get("IARA_MODEL") || "gpt-4o-mini";

    const callAI = (msgs: any[]) => fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: msgs, tools: TOOLS, tool_choice: "auto", temperature: 0.3 }),
    });

    const convo: any[] = [{ role: "system", content: systemPrompt }, ...messages];
    let finalText = "";

    for (let i = 0; i < 4; i++) {
      const resp = await callAI(convo);
      if (!resp.ok) {
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errorText = await resp.text();
        console.error("AI error:", resp.status, errorText);
        const msg = resp.status === 401 ? "Chave de IA inválida. Verifique a OPENAI_API_KEY." : "Erro ao processar sua mensagem.";
        return new Response(JSON.stringify({ error: msg }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      if (msg?.tool_calls?.length) {
        convo.push(msg);
        for (const tc of msg.tool_calls) {
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
          let result = "{}";
          try {
            if (tc.function.name === "resumo_financeiro") result = await toolResumo(args.inicio, args.fim);
            else if (tc.function.name === "agenda_vencimentos") result = await toolAgenda(args.inicio, args.fim, args.tipo, args.status);
            else if (tc.function.name === "buscar_lancamento") result = await toolBuscar(args.termo);
            else if (tc.function.name === "detalhe_cliente") result = await toolDetalheCliente(args.nome);
            else if (tc.function.name === "saldo_e_contas") result = await toolSaldoContas();
            else if (tc.function.name === "projecao_fluxo") result = await toolProjecao(args.dias);
            else if (tc.function.name === "comparativo_periodos") result = await toolComparativo(args.inicio_a, args.fim_a, args.inicio_b, args.fim_b);
          } catch (e) {
            result = JSON.stringify({ erro: e instanceof Error ? e.message : "falha na consulta" });
          }
          convo.push({ role: "tool", tool_call_id: tc.id, content: result });
        }
        continue; // deixa o modelo ler os resultados e decidir o próximo passo
      }
      finalText = msg?.content || "";
      break;
    }

    if (!finalText) finalText = "Não consegui montar a resposta agora. Pode reformular a pergunta?";

    // Entrega no formato SSE que o cliente já sabe ler (choices[].delta.content)
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const payload = JSON.stringify({ choices: [{ delta: { content: finalText } }] });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("financial-advisor error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
