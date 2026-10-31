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

    // Fair-use: teto diário generoso por usuário (anti-abuso/custo — uso normal nunca
    // encosta). UMA só contagem por requisição. Falha ABERTA se a RPC ainda não existir.
    try {
      const limiteDia = Number(Deno.env.get("IARA_LIMITE_DIA") || "200");
      const { data: uso } = await supabase.rpc("iara_registrar_uso", { p_limite: limiteDia });
      if (uso && (uso as { bloqueado?: boolean }).bloqueado) {
        return new Response(JSON.stringify({ error: `Você atingiu o limite de ${limiteDia} perguntas à IARA por hoje. Volte amanhã 🙂` }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (_e) { /* fail open */ }

    const { messages, period }: RequestBody = await req.json();
    const { startDate, endDate, periodLabel } = getPeriodDates(period);
    // HOJE no fuso do Brasil (não UTC) — evita "virar o dia" à noite.
    const hojeISO = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    // Âncoras de data calculadas AQUI (o modelo erra aritmética de data). Semana
    // de SEGUNDA a DOMINGO, igual ao Calendário (date-fns weekStartsOn: 1).
    const _baseDia = new Date(hojeISO + "T12:00:00Z");
    const _isoDelta = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    const _dow = _baseDia.getUTCDay();                 // 0=domingo..6=sábado
    const _offMon = (_dow + 6) % 7;                    // dias desde a segunda
    const semanaIni = _isoDelta(_baseDia, -_offMon);
    const semanaFim = _isoDelta(_baseDia, 6 - _offMon);
    const semanaPassadaIni = _isoDelta(_baseDia, -_offMon - 7);
    const semanaPassadaFim = _isoDelta(_baseDia, -_offMon - 1);
    const proximaSemanaIni = _isoDelta(_baseDia, -_offMon + 7);
    const proximaSemanaFim = _isoDelta(_baseDia, -_offMon + 13);
    const amanhaISO = _isoDelta(_baseDia, 1);
    const ontemISO = _isoDelta(_baseDia, -1);
    const [_hy, _hm] = hojeISO.split("-").map(Number);
    const mesIni = `${_hy}-${String(_hm).padStart(2, "0")}-01`;
    const mesFim = new Date(Date.UTC(_hy, _hm, 0)).toISOString().slice(0, 10);          // último dia do mês atual
    const mesPassadoIni = new Date(Date.UTC(_hy, _hm - 2, 1)).toISOString().slice(0, 10);
    const mesPassadoFim = new Date(Date.UTC(_hy, _hm - 1, 0)).toISOString().slice(0, 10);
    const numMeses = monthsBetween(startDate, endDate);

    // ---- Busca de dados (em paralelo). Tudo já vem filtrado pela RLS do usuário. ----
    const [receitas, despesas, contratos, contas, transferencias, clientes, metas, faturas, categorias] = await Promise.all([
      safe<any>(supabase.from("receitas").select("*, cliente:clientes(nome), categoria:categorias(nome)").gte("data_competencia", startDate).lte("data_competencia", endDate)),
      safe<any>(supabase.from("despesas").select("*, categoria:categorias(nome, grupo_dre)").gte("data_competencia", startDate).lte("data_competencia", endDate)),
      safe<any>(supabase.from("contratos").select("*, cliente:clientes(nome)").eq("status", "ativo")),
      safe<any>(supabase.from("contas").select("*").eq("ativa", true)),
      safe<any>(supabase.from("transferencias").select("*")),
      safe<any>(supabase.from("clientes").select("id, nome, status")),
      safe<any>(supabase.from("metas").select("*")),
      safe<any>(supabase.from("cartao_faturas").select("*")),
      safe<any>(supabase.from("categorias").select("id, nome, tipo")),
    ]);

    const profileRows = await safe<any>(supabase.from("profiles").select("nome").limit(1));
    const nomeUsuario = profileRows[0]?.nome || "";

    // ---- Métricas de receita/despesa ----
    const receitasRecebidas = receitas.filter(r => r.status === "recebido");
    const receitasPendentes = receitas.filter(r => r.status === "pendente");
    const receitasAtrasadas = receitas.filter(r => r.status === "atrasado");
    // Status (caixa / contas a pagar): itens do cartão ficam de fora — quem
    // representa a fatura é a despesa-sombra '[fatura]' (saldo em aberto) e o
    // pagamento '[pagamento-fatura]'. Contar os itens aqui dobraria os valores.
    const despesasCaixa = despesas.filter(d => !d.fatura_id);
    const despesasPagas = despesasCaixa.filter(d => d.status === "pago");
    const despesasPendentes = despesasCaixa.filter(d => d.status === "pendente");
    const despesasAtrasadas = despesasCaixa.filter(d => d.status === "atrasado");
    // Competência (mesmo critério do DRE em Relatórios): itens do cartão entram
    // com a categoria deles; sombra '[fatura]' e '[pagamento-fatura]' ficam de fora.
    const despesasCompetencia = despesas.filter(d => d.fornecedor !== "[fatura]" && d.fornecedor !== "[pagamento-fatura]");
    const ehDistribuicao = (d: any) => d.categoria?.grupo_dre === "distribuicao_lucro";

    const sum = (arr: any[]) => arr.reduce((s, x) => s + Number(x.valor || 0), 0);
    const totalRecebido = sum(receitasRecebidas);
    const totalReceitaPendente = sum(receitasPendentes);
    const totalReceitaAtrasada = sum(receitasAtrasadas);
    const totalPago = sum(despesasPagas);
    const totalDespesaPendente = sum(despesasPendentes);
    const totalDespesaAtrasada = sum(despesasAtrasadas);

    const lucro = totalRecebido - totalPago;
    const margem = totalRecebido > 0 ? ((lucro / totalRecebido) * 100).toFixed(1) : "0";

    // Resultado por competência — bate com o DRE (distribuição de lucros abaixo da linha)
    const receitaCompetencia = sum(receitas);
    const despesaCompetencia = sum(despesasCompetencia.filter(d => !ehDistribuicao(d)));
    const distribuicaoLucros = sum(despesasCompetencia.filter(ehDistribuicao));
    const lucroDre = receitaCompetencia - despesaCompetencia;

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
      if (c.recorrencia === "semanal") return s + v * (52 / 12);
      if (c.recorrencia === "quinzenal") return s + v * 2;
      if (c.recorrencia === "mensal") return s + v;
      if (c.recorrencia === "trimestral") return s + v / 3;
      if (c.recorrencia === "semestral") return s + v / 6;
      if (c.recorrencia === "anual") return s + v / 12;
      return s;
    }, 0);

    // ---- Despesas por categoria (competência, igual ao DRE) ----
    const porCategoria: Record<string, number> = {};
    for (const d of despesasCompetencia) {
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
- Por categoria (competência, igual ao DRE — itens do cartão contam na categoria deles; pagos e em aberto):
${categoriasOrdenadas.length ? categoriasOrdenadas.map(([c, v]) => `  • ${c}: ${fmt(v)}`).join("\n") : "  • (sem despesas)"}

RESULTADO POR COMPETÊNCIA (${periodLabel}) — é o mesmo número do DRE em Relatórios:
- Receita: ${fmt(receitaCompetencia)}
- Despesas (sem distribuição de lucros): ${fmt(despesaCompetencia)}
- Lucro líquido (DRE): ${fmt(lucroDre)}
- Distribuição de lucros (abaixo da linha, não é despesa operacional): ${fmt(distribuicaoLucros)}
- Resultado após distribuição: ${fmt(lucroDre - distribuicaoLucros)}

RESULTADO DE CAIXA (${periodLabel}):
- Lucro de caixa (recebido − pago): ${fmt(lucro)}
- Margem de caixa: ${margem}%

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
- DATAS JÁ CALCULADAS (fuso do Brasil, semana de SEGUNDA a DOMINGO como no Calendário). NÃO recalcule — use EXATAMENTE estes intervalos ISO:
  • "hoje" → ${hojeISO} a ${hojeISO}; "amanhã" → ${amanhaISO}; "ontem" → ${ontemISO}.
  • "essa semana"/"esta semana" → ${semanaIni} a ${semanaFim}.
  • "semana passada" → ${semanaPassadaIni} a ${semanaPassadaFim}; "próxima semana"/"semana que vem" → ${proximaSemanaIni} a ${proximaSemanaFim}.
  • "esse mês"/"este mês" → ${mesIni} a ${mesFim}; "resto do mês" → ${hojeISO} a ${mesFim}; "mês passado" → ${mesPassadoIni} a ${mesPassadoFim}.
  • "do dia X ao dia Y", "entre X e Y" → use exatamente essas datas (assuma ${_hy}-${String(_hm).padStart(2, "0")} se só vier o dia).
  • Ao mencionar o intervalo na resposta, use estas MESMAS datas (ex.: "essa semana (${semanaIni} a ${semanaFim})").
- Escolha a ferramenta certa:
  • Perguntas de resultado/desempenho ("quanto faturei/gastei/lucrei", "margem", "por categoria", "top clientes") → resumo_financeiro (regime de competência).
  • "Despesas acima da média", "o que aumentou", "onde estou gastando mais que o normal" → categorias_vs_media (compara cada categoria com a MÉDIA DELA nos meses anteriores — nunca compare uma categoria com o total do mês).
  • Gasto por CATEGORIA e "quanto gastei/lucrei" usam COMPETÊNCIA (campos despesas_por_categoria, despesa_competencia, lucro_liquido_dre) — é o mesmo número do DRE em Relatórios. Compras no cartão contam na categoria de cada item, mesmo com a fatura em aberto; a fatura em si não é despesa nova. Distribuição de lucros fica separada (distribuicao_lucros). Só use "pago"/"lucro_caixa" quando perguntarem o que SAIU do caixa.
  • Perguntas de agenda/caixa futuro-ou-passado por data ("o que vence/tenho a pagar/a receber", "hoje", "amanhã", "essa semana", "resto do mês") → agenda_vencimentos (por data de vencimento).
  • Procurar por fornecedor/descrição ("quanto paguei pra X") → buscar_lancamento. Panorama de um cliente → detalhe_cliente. Saldo atual/cartões → saldo_e_contas. Projeção de caixa futuro → projecao_fluxo. Comparar dois períodos → comparativo_periodos.
  • Por FORMA DE PAGAMENTO ("quanto fiz/paguei/recebi de PIX", "quanto no cartão/boleto/dinheiro") → movimento_por_forma (com o intervalo pedido: hoje, ontem, essa semana, esse mês, período).
  • "Quanto está minha fatura do cartão?" / "quanto devo no cartão" → saldo_e_contas (campo cartoes[].fatura_aberta é a fatura em aberto; total_faturas_abertas é a soma).
  • Compras PARCELADAS no cartão ("quantas parcelas faltam", "o que ainda está parcelado", "parcelas do notebook") → compras_parceladas (traz nº de parcelas, pagas, faltam, valor da parcela, próxima data de vencimento e valor restante por compra).
  • Total COMPROMETIDO em parcelas nos próximos meses ("quanto da fatura futura já está tomado", "quanto já devo em parcelas") → parcelas_comprometidas (soma por mês o que falta pagar de parcelas).
- Você pode chamar mais de uma ferramenta antes de responder (ex.: saldo_e_contas + projecao_fluxo para dizer se vai faltar caixa).
- Se a pessoa não disser o período, responda com o período do contexto ("${periodLabel}") e diga qual período usou. Sempre deixe claro o intervalo que os números cobrem.

## Lançar (criar receitas/despesas) — você também REGISTRA, não só consulta
- Quando a pessoa pedir para LANÇAR/REGISTRAR/ADICIONAR/ANOTAR um gasto, conta, receita, compra no cartão, pagamento, parcelamento ou algo recorrente (ex.: "lança 320 de energia hoje", "coloca 1.200 do aluguel todo mês", "comprei um notebook 3000 em 10x no cartão Nubank", "recebi 500 do cliente X"), use a ferramenta **preparar_lancamentos**. Você NÃO grava direto: ela monta uma PRÉVIA que a pessoa confirma na tela com um toque.
- Extraia o máximo que der da fala: tipo (despesa/receita), descrição curta, valor, data (padrão: hoje), categoria, conta ou cartão, forma de pagamento, fornecedor (despesa) ou cliente (receita), nº de parcelas (cartão) e se é recorrente (frequência + repetições).
- Use os nomes EXATOS das contas e categorias abaixo. Se não tiver certeza da conta, deixe em branco (o app usa a conta padrão). Cartão de crédito cai na fatura automaticamente.
- Depois de chamar a ferramenta, escreva uma frase curta confirmando o que entendeu (ex.: "Preparei 1 despesa de R$ 320,00 em Energia para hoje — é só confirmar abaixo 👇"). NÃO repita todos os campos em tabela; a prévia já mostra tudo.
- Nunca invente valor. Se faltar o valor, pergunte antes de preparar. Para mudanças, prepare de novo com os ajustes.
- CONTAS disponíveis: ${(contas || []).map((c: any) => `${c.nome}${c.tipo === "cartao_credito" ? " (cartão)" : ""}`).join(", ") || "(nenhuma)"}.
- CATEGORIAS de despesa: ${[...new Set((categorias || []).filter((c: any) => c.tipo === "despesa").map((c: any) => c.nome))].join(", ") || "(nenhuma)"}.
- CATEGORIAS de receita: ${[...new Set((categorias || []).filter((c: any) => c.tipo === "receita").map((c: any) => c.nome))].join(", ") || "(nenhuma)"}.

## Estilo das respostas
- Responda em Markdown. Comece pela conclusão/resposta direta (1 frase, com o número principal em **negrito**) e depois os detalhes.
- NÃO use tabelas (ficam ilegíveis no celular). Para listar categorias, clientes ou lançamentos use lista com marcadores, UM item por linha, no formato:
  - **Nome** — R$ 1.234,56 (detalhe curto, ex.: +35% vs média)
- No máximo 8 itens por lista; se houver mais, resuma o resto em uma linha ("+ 5 categorias somando R$ 900,00").
- Separe blocos com um subtítulo curto em negrito quando a resposta tiver mais de uma parte (ex.: **Acima da média**, **Dentro do normal**).
- Emojis com muita moderação (no máximo 1–2 quando destacam algo importante).
- Seja concisa: nada de textos longos quando um parágrafo resolve. Ofereça um próximo passo acionável quando fizer sentido.
- Termine oferecendo aprofundar ("Quer que eu detalhe as despesas por categoria?") quando couber.

# CONTEXTO FINANCEIRO (dados reais deste usuário)
${contexto}`;

    // ---- Ferramentas: a IARA consulta a fonte para QUALQUER intervalo de datas ----
    // Ferramentas enxutas (descrições curtas = menos tokens por chamada). O roteamento
    // detalhado está no system prompt; aqui basta o essencial. Mesmas 7 capacidades.
    const D = { type: "string", description: "YYYY-MM-DD" };
    const TOOLS = [
      { type: "function", function: { name: "resumo_financeiro", description: "Resultado num intervalo. Competência (= DRE): receita_competencia, despesa_competencia, lucro_liquido_dre, distribuicao_lucros, despesas_por_categoria (inclui itens do cartão). Caixa: recebido, a receber, pago, a pagar, lucro_caixa. Use p/ faturamento, gastos, lucro, margem, gasto por categoria, top clientes.", parameters: { type: "object", properties: { inicio: D, fim: D }, required: ["inicio", "fim"] } } },
      { type: "function", function: { name: "agenda_vencimentos", description: "Lançamentos por data de VENCIMENTO (o que vence/entra/sai) + totais a receber/pagar. Use p/ hoje, amanhã, essa semana, resto do mês, do dia X ao Y, contas a pagar/receber.", parameters: { type: "object", properties: { inicio: D, fim: D, tipo: { type: "string", enum: ["receita", "despesa", "ambos"], description: "padrão: ambos" }, status: { type: "string", enum: ["pago", "recebido", "pendente", "atrasado"], description: "opcional" } }, required: ["inicio", "fim"] } } },
      { type: "function", function: { name: "buscar_lancamento", description: "Procura receitas/despesas por texto na descrição ou fornecedor. Ex: 'quanto paguei pra X', 'gastos com energia'.", parameters: { type: "object", properties: { termo: { type: "string", description: "texto a procurar" } }, required: ["termo"] } } },
      { type: "function", function: { name: "detalhe_cliente", description: "Panorama de um cliente: faturado, recebido, a receber, atrasado, contratos ativos e MRR. Ex: 'como está o cliente X', 'quanto Y me deve'.", parameters: { type: "object", properties: { nome: { type: "string", description: "nome ou parte" } }, required: ["nome"] } } },
      { type: "function", function: { name: "saldo_e_contas", description: "Saldo atual de cada conta + total em caixa e cartões (fatura aberta, limite, disponível). Ex: 'meu saldo', 'como estão meus cartões'.", parameters: { type: "object", properties: {} } } },
      { type: "function", function: { name: "projecao_fluxo", description: "Projeta a variação de caixa nos próximos N dias (a receber − a pagar por vencimento). Ex: 'vou ter caixa mês que vem'. Combine com saldo_e_contas.", parameters: { type: "object", properties: { dias: { type: "number", description: "dias à frente (ex: 30)" } }, required: ["dias"] } } },
      { type: "function", function: { name: "comparativo_periodos", description: "Compara dois intervalos por competência (recebido, pago, lucro, margem) com variação %. Ex: 'esse mês vs passado'.", parameters: { type: "object", properties: { inicio_a: D, fim_a: D, inicio_b: D, fim_b: D }, required: ["inicio_a", "fim_a", "inicio_b", "fim_b"] } } },
      { type: "function", function: { name: "movimento_por_forma", description: "Soma por FORMA DE PAGAMENTO (Pix, cartão de crédito/débito, boleto, dinheiro, transferência) num intervalo por competência. Use p/ 'quanto fiz/paguei/recebi de PIX', 'quanto no cartão', 'quanto em boleto' — hoje, ontem, essa semana, esse mês ou período.", parameters: { type: "object", properties: { inicio: D, fim: D, tipo: { type: "string", enum: ["receita", "despesa", "ambos"], description: "padrão: ambos" } }, required: ["inicio", "fim"] } } },
      { type: "function", function: { name: "compras_parceladas", description: "Compras PARCELADAS no cartão: cada compra com nº de parcelas, quantas já foram pagas e quantas FALTAM, valor da parcela, próxima data de vencimento e valor restante. Use p/ 'minhas compras parceladas', 'quantas parcelas faltam do X', 'o que ainda está parcelado no cartão'.", parameters: { type: "object", properties: { incluir_quitadas: { type: "boolean", description: "incluir compras já quitadas (padrão: false)" } } } } },
      { type: "function", function: { name: "categorias_vs_media", description: "Compara o gasto de CADA categoria no período (padrão: mês atual até hoje) com a média mensal DA PRÓPRIA categoria nos meses anteriores (padrão 3). Retorna as que estão acima da média (com diferença e %), mesmo critério do DRE. Use p/ 'despesas acima da média', 'o que aumentou', 'onde estou gastando mais'.", parameters: { type: "object", properties: { inicio: D, fim: D, meses_base: { type: "number", description: "meses anteriores para a média (padrão 3, máx 12)" } } } } },
      { type: "function", function: { name: "parcelas_comprometidas", description: "Quanto das PRÓXIMAS FATURAS já está comprometido com parcelamentos do cartão, somado por MÊS de vencimento (parcelas ainda não pagas). Use p/ 'quanto já devo em parcelas nos próximos meses', 'quanto da fatura futura já está tomado', 'total comprometido em parcelas'.", parameters: { type: "object", properties: { meses: { type: "number", description: "quantos meses à frente (padrão 12)" } } } } },
      { type: "function", function: {
        name: "preparar_lancamentos",
        description: "Prepara uma PRÉVIA de um ou mais lançamentos (despesa/receita) para a pessoa CONFIRMAR e criar na tela. Use quando pedirem para lançar/registrar/adicionar/anotar gasto, conta, receita, compra no cartão, parcelamento ou recorrente. NÃO grava sozinho.",
        parameters: {
          type: "object",
          properties: {
            lancamentos: {
              type: "array",
              description: "Um item por lançamento.",
              items: {
                type: "object",
                properties: {
                  tipo: { type: "string", enum: ["despesa", "receita"] },
                  descricao: { type: "string", description: "descrição curta (ex: 'Energia', 'Aluguel', 'Notebook')" },
                  valor: { type: "number", description: "valor total em reais (do item/compra; para parcelado é o TOTAL)" },
                  data: { ...D, description: "YYYY-MM-DD; padrão hoje" },
                  categoria: { type: "string", description: "nome da categoria (use um dos nomes informados no prompt)" },
                  conta: { type: "string", description: "nome da conta ou cartão (use um dos nomes informados); vazio = conta padrão" },
                  forma_pagamento: { type: "string", enum: ["pix", "boleto", "cartao_credito", "cartao_debito", "dinheiro", "transferencia"] },
                  fornecedor: { type: "string", description: "fornecedor/loja (despesa)" },
                  cliente: { type: "string", description: "cliente (receita)" },
                  parcelas: { type: "number", description: "nº de parcelas no cartão (>=2)" },
                  quitado: { type: "boolean", description: "true = já pago/recebido (padrão); false = pendente. Cartão de crédito sempre vira fatura." },
                  recorrencia: { type: "string", enum: ["semanal", "quinzenal", "mensal", "bimestral", "trimestral", "semestral", "anual"], description: "se repete" },
                  repeticoes: { type: "number", description: "quantas vezes repete (com recorrencia; padrão 12)" },
                },
                required: ["tipo", "descricao", "valor"],
              },
            },
          },
          required: ["lancamentos"],
        },
      } },
    ];

    // ---- Normaliza a prévia de lançamentos (nomes → ids reais; detecta cartão) ----
    const FORMAS_OK = new Set(["pix", "boleto", "cartao_credito", "cartao_debito", "dinheiro", "transferencia"]);
    const FREQS_OK = new Set(["semanal", "quinzenal", "mensal", "bimestral", "trimestral", "semestral", "anual"]);
    const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    const contaPadraoId = (() => {
      const corrente = (contas || []).find((c: any) => c.tipo === "corrente") || (contas || []).find((c: any) => c.tipo !== "cartao_credito");
      return corrente?.id || (contas || [])[0]?.id || null;
    })();
    const achaConta = (nome?: string): any | null => {
      if (!nome) return null;
      const n = norm(nome);
      return (contas || []).find((c: any) => norm(c.nome) === n)
        || (contas || []).find((c: any) => norm(c.nome).includes(n) || n.includes(norm(c.nome)))
        || null;
    };
    const achaCategoria = (nome: string | undefined, tipo: string): { id: string | null; nome: string | null } => {
      if (!nome) return { id: null, nome: null };
      const n = norm(nome);
      const doTipo = (categorias || []).filter((c: any) => c.tipo === tipo);
      const hit = doTipo.find((c: any) => norm(c.nome) === n)
        || doTipo.find((c: any) => norm(c.nome).includes(n) || n.includes(norm(c.nome)));
      return hit ? { id: hit.id, nome: hit.nome } : { id: null, nome: nome };
    };

    const propostas: any[] = [];
    function prepararLancamentos(arr: any[]): string {
      const itens = (Array.isArray(arr) ? arr : []).slice(0, 20);
      const out: any[] = [];
      for (const raw of itens) {
        const valor = Number(raw?.valor);
        if (!raw || !(valor > 0)) continue;
        const tipo = raw.tipo === "receita" ? "receita" : "despesa";
        const conta = achaConta(raw.conta);
        const conta_id = conta?.id ?? contaPadraoId;
        const ehCartao = !!conta && conta.tipo === "cartao_credito";
        const cat = achaCategoria(raw.categoria, tipo);
        let data = typeof raw.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.data) ? raw.data : hojeISO;
        let forma: string | null = FORMAS_OK.has(raw.forma_pagamento) ? raw.forma_pagamento : null;
        if (ehCartao && !forma) forma = "cartao_credito";
        const parcelas = ehCartao && Number(raw.parcelas) >= 2 ? Math.floor(Number(raw.parcelas)) : null;
        const recorrencia = FREQS_OK.has(raw.recorrencia) ? raw.recorrencia : null;
        const recorrente = recorrencia ? { frequencia: recorrencia, repeticoes: Math.min(60, Math.max(1, Math.floor(Number(raw.repeticoes) || 12))) } : null;
        const quitado = typeof raw.quitado === "boolean" ? raw.quitado : true;
        out.push({
          tipo,
          descricao: String(raw.descricao || (tipo === "receita" ? "Receita" : "Despesa")).slice(0, 120),
          valor: Math.round(valor * 100) / 100,
          categoria_id: cat.id, categoria_nome: cat.nome,
          data, conta_id, quitado,
          forma_pagamento: forma,
          fornecedor: tipo === "despesa" && raw.fornecedor ? String(raw.fornecedor).slice(0, 120) : null,
          cliente_nome: tipo === "receita" && raw.cliente ? String(raw.cliente).slice(0, 120) : null,
          parcelas, recorrente,
          _conta_nome: conta?.nome || null,
          _cartao: ehCartao,
        });
      }
      propostas.push(...out);
      // Resumo p/ o modelo descrever (sem ids internos).
      const resumo = out.map((o) => ({
        tipo: o.tipo, descricao: o.descricao, valor: o.valor, data: o.data,
        categoria: o.categoria_nome, conta: o._conta_nome || "conta padrão",
        cartao: o._cartao, parcelas: o.parcelas, recorrente: o.recorrente, quitado: o.quitado,
      }));
      return JSON.stringify({ preparados: out.length, itens: resumo, obs: "Prévia pronta. A pessoa confirma na tela para criar." });
    }

    async function computeResumo(inicio: string, fim: string) {
      const [rec, desp] = await Promise.all([
        safe<any>(supabase.from("receitas").select("valor,status,cliente:clientes(nome),categoria:categorias(nome)").gte("data_competencia", inicio).lte("data_competencia", fim)),
        safe<any>(supabase.from("despesas").select("valor,status,fatura_id,fornecedor,categoria:categorias(nome,grupo_dre)").gte("data_competencia", inicio).lte("data_competencia", fim)),
      ]);
      const s = (arr: any[]) => arr.reduce((t, x) => t + Number(x.valor || 0), 0);
      const recebido = s(rec.filter(r => r.status === "recebido"));
      const aReceber = s(rec.filter(r => r.status === "pendente"));
      const atrasadoReceber = s(rec.filter(r => r.status === "atrasado"));
      // Caixa / a pagar: sem itens do cartão (a fatura é representada pela sombra '[fatura]').
      const despCx = desp.filter(d => !d.fatura_id);
      const pago = s(despCx.filter(d => d.status === "pago"));
      const aPagar = s(despCx.filter(d => d.status === "pendente"));
      const atrasadoPagar = s(despCx.filter(d => d.status === "atrasado"));
      const lucroP = recebido - pago;
      // Competência (= DRE): itens do cartão entram; sombra e pagamento de fatura não.
      const despComp = desp.filter(d => d.fornecedor !== "[fatura]" && d.fornecedor !== "[pagamento-fatura]");
      const isDist = (d: any) => d.categoria?.grupo_dre === "distribuicao_lucro";
      const receitaComp = s(rec);
      const despesaComp = s(despComp.filter(d => !isDist(d)));
      const distrib = s(despComp.filter(isDist));
      const lucroDre = receitaComp - despesaComp;
      const cat: Record<string, number> = {};
      for (const d of despComp) { const c = d.categoria?.nome || "Sem categoria"; cat[c] = (cat[c] || 0) + Number(d.valor || 0); }
      const cli: Record<string, number> = {};
      for (const r of rec) { const n = r.cliente?.nome; if (n) cli[n] = (cli[n] || 0) + Number(r.valor || 0); }
      return {
        periodo: { inicio, fim },
        // Competência — mesmos números do DRE em Relatórios
        receita_competencia: receitaComp,
        despesa_competencia: despesaComp,
        lucro_liquido_dre: lucroDre,
        distribuicao_lucros: distrib,
        resultado_apos_distribuicao: lucroDre - distrib,
        despesas_por_categoria: Object.fromEntries(Object.entries(cat).sort((a, b) => b[1] - a[1]).slice(0, 15)),
        // Caixa
        recebido, a_receber: aReceber, atrasado_a_receber: atrasadoReceber,
        pago, a_pagar: aPagar, atrasado_a_pagar: atrasadoPagar,
        lucro: lucroP, lucro_caixa: lucroP, margem_pct: recebido > 0 ? Number(((lucroP / recebido) * 100).toFixed(1)) : 0,
        receita_por_cliente: Object.fromEntries(Object.entries(cli).sort((a, b) => b[1] - a[1]).slice(0, 10)),
        obs: "despesas_por_categoria e lucro_liquido_dre são por competência (iguais ao DRE; compras no cartão contam na categoria do item, mesmo com fatura em aberto). pago/lucro_caixa são saídas/entradas de caixa.",
      };
    }

    async function toolResumo(inicio: string, fim: string): Promise<string> {
      return JSON.stringify(await computeResumo(inicio, fim));
    }

    // Cada categoria no período vs a média mensal DELA nos N meses anteriores.
    // Critério de competência = DRE (itens do cartão na categoria; sem sombra/pagamento de fatura).
    async function toolCategoriasVsMedia(inicio?: string, fim?: string, mesesBase?: number): Promise<string> {
      const N = Math.min(Math.max(Math.floor(Number(mesesBase) || 3), 1), 12);
      const ini = inicio || `${hojeISO.slice(0, 8)}01`;
      const fi = fim || hojeISO;
      const [y, m] = ini.split("-").map(Number);
      const baseIni = new Date(Date.UTC(y, m - 1 - N, 1)).toISOString().slice(0, 10);
      const baseFim = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10); // fim do mês anterior a `ini`
      const desp = await safe<any>(supabase.from("despesas")
        .select("valor, data_competencia, fornecedor, categoria:categorias(nome, grupo_dre)")
        .gte("data_competencia", baseIni).lte("data_competencia", fi));
      const r2 = (n: number) => Math.round(n * 100) / 100;
      const atual: Record<string, number> = {}, hist: Record<string, number> = {}, distrib: Record<string, boolean> = {};
      for (const d of desp) {
        if (d.fornecedor === "[fatura]" || d.fornecedor === "[pagamento-fatura]") continue;
        const c = d.categoria?.nome || "Sem categoria";
        if (d.categoria?.grupo_dre === "distribuicao_lucro") distrib[c] = true;
        const v = Number(d.valor || 0);
        if (d.data_competencia >= ini && d.data_competencia <= fi) atual[c] = (atual[c] || 0) + v;
        else if (d.data_competencia >= baseIni && d.data_competencia <= baseFim) hist[c] = (hist[c] || 0) + v;
      }
      const linhas = [...new Set([...Object.keys(atual), ...Object.keys(hist)])].map((c) => {
        const a = atual[c] || 0;
        const media = (hist[c] || 0) / N;
        return {
          categoria: c, atual: r2(a), media_mensal: r2(media), diferenca: r2(a - media),
          variacao_pct: media > 0 ? Number((((a - media) / media) * 100).toFixed(1)) : null,
          distribuicao_de_lucros: !!distrib[c],
        };
      }).sort((p, q) => q.diferenca - p.diferenca);
      const acima = linhas.filter((l) => l.atual > 0 && l.diferenca >= 50 && (l.media_mensal === 0 || l.atual > l.media_mensal * 1.1));
      const noMesAtual = ini.slice(0, 7) === hojeISO.slice(0, 7) && fi >= hojeISO;
      const diasNoMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return JSON.stringify({
        periodo: { inicio: ini, fim: fi },
        base_da_media: { inicio: baseIni, fim: baseFim, meses: N },
        mes_em_andamento: noMesAtual ? { dia: Number(hojeISO.slice(8, 10)), dias_no_mes: diasNoMes } : null,
        acima_da_media: acima,
        demais: linhas.filter((l) => !acima.includes(l)).slice(0, 12),
        obs: "Compare cada categoria com a própria média (nunca com o total do mês). Categorias de distribuição de lucros: cite à parte (é retirada dos sócios, não despesa operacional). Se o mês está em andamento, avise que a comparação é parcial.",
      });
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

    // Soma por forma de pagamento (Pix, cartão, boleto...) num intervalo (competência).
    const FORMA_LABEL_IA: Record<string, string> = {
      pix: "Pix", boleto: "Boleto", cartao_credito: "Cartão de crédito",
      cartao_debito: "Cartão de débito", dinheiro: "Dinheiro", transferencia: "Transferência",
    };
    const rotuloForma = (f: string | null) => f ? (FORMA_LABEL_IA[f] || f) : "Não informada";
    async function toolPorForma(inicio: string, fim: string, tipo?: string): Promise<string> {
      const wantRec = tipo !== "despesa";
      const wantDesp = tipo !== "receita";
      const [rec, desp] = await Promise.all([
        wantRec ? safe<any>(supabase.from("receitas").select("valor,forma_pagamento,status").gte("data_competencia", inicio).lte("data_competencia", fim)) : Promise.resolve([]),
        wantDesp ? safe<any>(supabase.from("despesas").select("valor,forma_pagamento,status,fornecedor").gte("data_competencia", inicio).lte("data_competencia", fim)).then((rows: any[]) => rows.filter((d) => d.fornecedor !== "[fatura]" && d.fornecedor !== "[pagamento-fatura]")) : Promise.resolve([]), // competência: itens do cartão sim; fatura/pagamento não (senão conta 2-3x)
      ]);
      const agrupa = (arr: any[]) => {
        const m: Record<string, number> = {};
        for (const x of arr) { const k = rotuloForma(x.forma_pagamento); m[k] = (m[k] || 0) + Number(x.valor || 0); }
        return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
      };
      const soma = (arr: any[]) => arr.reduce((s, x) => s + Number(x.valor || 0), 0);
      return JSON.stringify({
        periodo: { inicio, fim },
        obs: "Valores por competência (inclui pendentes). 'fiz/recebi/paguei' de PIX = some o Pix do bloco certo.",
        ...(wantRec ? { receitas_por_forma: agrupa(rec), total_receitas: soma(rec) } : {}),
        ...(wantDesp ? { despesas_por_forma: agrupa(desp), total_despesas: soma(desp) } : {}),
      });
    }

    // Compras parceladas no cartão (agrupadas por parcela_grupo_id).
    async function toolParceladas(incluirQuitadas?: boolean): Promise<string> {
      const linhas = await safe<any>(supabase.from("despesas")
        .select("descricao,valor,status,data_vencimento,parcela_num,parcela_total,parcela_grupo_id,conta_id")
        .not("parcela_grupo_id", "is", null));
      const nomeConta = (id: string | null) => (contas || []).find((c: any) => c.id === id)?.nome || "Cartão";
      const grupos = new Map<string, any[]>();
      for (const l of linhas) {
        if (!(Number(l.parcela_total) > 1)) continue;
        const k = l.parcela_grupo_id as string;
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k)!.push(l);
      }
      const compras: any[] = [];
      for (const itens of grupos.values()) {
        itens.sort((a, b) => (a.parcela_num || 0) - (b.parcela_num || 0));
        const total = itens[0].parcela_total;
        const pagas = itens.filter((i) => i.status === "pago").length;
        const abertas = itens.filter((i) => i.status !== "pago");
        const restantes = abertas.length;
        const valorTotal = itens.reduce((s, i) => s + Number(i.valor || 0), 0);
        const valorRestante = abertas.reduce((s, i) => s + Number(i.valor || 0), 0);
        abertas.sort((a, b) => String(a.data_vencimento || "").localeCompare(String(b.data_vencimento || "")));
        const prox = abertas[0];
        const descricao = String(itens[0].descricao || "").replace(/\s*\(\d+\/\d+\)\s*$/, "") || "Compra";
        const quitada = restantes === 0;
        if (quitada && !incluirQuitadas) continue;
        compras.push({
          descricao, cartao: nomeConta(itens[0].conta_id),
          parcelas_total: total, pagas, faltam: restantes, quitada,
          valor_parcela: Number(itens[0].valor || 0),
          valor_total: Math.round(valorTotal * 100) / 100,
          valor_restante: Math.round(valorRestante * 100) / 100,
          proxima: prox ? { numero: prox.parcela_num, de: total, vencimento: prox.data_vencimento, valor: Number(prox.valor || 0) } : null,
        });
      }
      compras.sort((a, b) => String(a.proxima?.vencimento || "9999").localeCompare(String(b.proxima?.vencimento || "9999")));
      return JSON.stringify({ total_compras_parceladas: compras.length, compras: compras.slice(0, 30) });
    }

    // Total comprometido em parcelas (não pagas) por mês de vencimento, daqui pra frente.
    async function toolParcelasComprometidas(meses?: number): Promise<string> {
      const n = Math.min(36, Math.max(1, Math.floor(meses || 12)));
      const linhas = await safe<any>(supabase.from("despesas")
        .select("valor,status,data_vencimento,parcela_total,parcela_grupo_id,conta_id")
        .not("parcela_grupo_id", "is", null).neq("status", "pago").gte("data_vencimento", mesIni));
      const porMes: Record<string, { total: number; parcelas: number; grupos: Set<string> }> = {};
      let total = 0;
      for (const l of linhas) {
        if (!(Number(l.parcela_total) > 1)) continue;
        const mes = String(l.data_vencimento).slice(0, 7);
        if (!porMes[mes]) porMes[mes] = { total: 0, parcelas: 0, grupos: new Set() };
        porMes[mes].total += Number(l.valor || 0);
        porMes[mes].parcelas += 1;
        porMes[mes].grupos.add(l.parcela_grupo_id);
        total += Number(l.valor || 0);
      }
      const r2 = (x: number) => Math.round(x * 100) / 100;
      const por_mes = Object.entries(porMes)
        .sort((a, b) => a[0].localeCompare(b[0])).slice(0, n)
        .map(([mes, v]) => ({ mes, total: r2(v.total), parcelas: v.parcelas, compras: v.grupos.size }));
      return JSON.stringify({
        total_comprometido: r2(total),
        a_partir_de: mesIni,
        por_mes,
        obs: "Soma das parcelas de cartão ainda NÃO pagas, por mês de vencimento. É o quanto das próximas faturas já está tomado por parcelamentos.",
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
        if (c.recorrencia === "semanal") return sum + v * (52 / 12);
        if (c.recorrencia === "quinzenal") return sum + v * 2;
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
        safe<any>(supabase.from("despesas").select("valor,status,data_vencimento").gte("data_vencimento", start).lte("data_vencimento", end).neq("status", "pago").is("fatura_id", null)), // fatura do cartão = sombra (sem itens, senão dobra)
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
        wantDesp ? safe<any>(supabase.from("despesas").select("descricao,valor,status,data_vencimento,categoria:categorias(nome)").gte("data_vencimento", inicio).lte("data_vencimento", fim).is("fatura_id", null)) : Promise.resolve([]), // cartão aparece como a fatura (sombra), não item a item
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
            else if (tc.function.name === "movimento_por_forma") result = await toolPorForma(args.inicio, args.fim, args.tipo);
            else if (tc.function.name === "compras_parceladas") result = await toolParceladas(args.incluir_quitadas);
            else if (tc.function.name === "parcelas_comprometidas") result = await toolParcelasComprometidas(args.meses);
            else if (tc.function.name === "categorias_vs_media") result = await toolCategoriasVsMedia(args.inicio, args.fim, args.meses_base);
            else if (tc.function.name === "preparar_lancamentos") result = prepararLancamentos(args.lancamentos);
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
        // Prévia de lançamentos p/ o front mostrar um card de confirmação (sem ids auxiliares).
        if (propostas.length) {
          const lancs = propostas.map(({ _conta_nome, _cartao, ...rest }) => rest);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ lancamentos: lancs })}\n\n`));
        }
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
