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
      safe<any>(supabase.from("faturas").select("*")),
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

## Estilo das respostas
- Responda em Markdown. Comece pela conclusão/resposta direta e depois os detalhes.
- Use listas curtas e, quando útil, uma mini-tabela. Emojis com muita moderação (no máximo 1–2 quando destacam algo importante).
- Seja concisa: nada de textos longos quando um parágrafo resolve. Ofereça um próximo passo acionável quando fizer sentido.
- Termine oferecendo aprofundar ("Quer que eu detalhe as despesas por categoria?") quando couber.

# CONTEXTO FINANCEIRO (dados reais deste usuário)
${contexto}`;

    // ---- Chamada ao provedor (compatível com API da OpenAI) ----
    const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("IARA_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "IA não configurada (defina OPENAI_API_KEY)." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiBase = (Deno.env.get("IARA_API_BASE") || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = Deno.env.get("IARA_MODEL") || "gpt-4o-mini";

    const aiResponse = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 401) {
        return new Response(JSON.stringify({ error: "Chave de IA inválida. Verifique a OPENAI_API_KEY." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("financial-advisor error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
