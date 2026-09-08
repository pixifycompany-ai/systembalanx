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
  let endDate = new Date(year, month + 1, 0); // Last day of current month
  let periodLabel: string;

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
      const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      periodLabel = `${monthNames[month]} ${year}`;
      break;
  }

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    periodLabel,
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Parse request body
    const { messages, period }: RequestBody = await req.json();
    const { startDate, endDate, periodLabel } = getPeriodDates(period);

    // Fetch financial data in parallel
    const [
      { data: receitas },
      { data: despesas },
      { data: contratos },
      { data: contas },
      { data: transferencias },
    ] = await Promise.all([
      supabase
        .from("receitas")
        .select("*, cliente:clientes(nome), categoria:categorias(nome)")
        .gte("data_competencia", startDate)
        .lte("data_competencia", endDate),
      supabase
        .from("despesas")
        .select("*, categoria:categorias(nome)")
        .gte("data_competencia", startDate)
        .lte("data_competencia", endDate),
      supabase
        .from("contratos")
        .select("*, cliente:clientes(nome)")
        .eq("status", "ativo"),
      supabase
        .from("contas")
        .select("*")
        .eq("ativa", true),
      supabase
        .from("transferencias")
        .select("*"),
    ]);

    // Calculate metrics
    const receitasRecebidas = (receitas || []).filter(r => r.status === "recebido");
    const receitasPendentes = (receitas || []).filter(r => r.status === "pendente" || r.status === "atrasado");
    const despesasPagas = (despesas || []).filter(d => d.status === "pago");
    const despesasPendentes = (despesas || []).filter(d => d.status === "pendente" || d.status === "atrasado");

    const totalReceitasRecebidas = receitasRecebidas.reduce((sum, r) => sum + Number(r.valor), 0);
    const totalReceitasPendentes = receitasPendentes.reduce((sum, r) => sum + Number(r.valor), 0);
    const totalDespesasPagas = despesasPagas.reduce((sum, d) => sum + Number(d.valor), 0);
    const totalDespesasPendentes = despesasPendentes.reduce((sum, d) => sum + Number(d.valor), 0);

    const lucro = totalReceitasRecebidas - totalDespesasPagas;
    const margemLucro = totalReceitasRecebidas > 0 ? ((lucro / totalReceitasRecebidas) * 100).toFixed(1) : "0";

    // Calculate account balances
    const accountBalances = (contas || []).map(conta => {
      const receitasConta = (receitas || [])
        .filter(r => r.conta_id === conta.id && r.status === "recebido")
        .reduce((sum, r) => sum + Number(r.valor), 0);
      const despesasConta = (despesas || [])
        .filter(d => d.conta_id === conta.id && d.status === "pago")
        .reduce((sum, d) => sum + Number(d.valor), 0);
      const transferenciasEntrada = (transferencias || [])
        .filter(t => t.conta_destino_id === conta.id)
        .reduce((sum, t) => sum + Number(t.valor), 0);
      const transferenciasSaida = (transferencias || [])
        .filter(t => t.conta_origem_id === conta.id)
        .reduce((sum, t) => sum + Number(t.valor), 0);
      
      const saldo = Number(conta.saldo_inicial) + receitasConta - despesasConta + transferenciasEntrada - transferenciasSaida;
      return { nome: conta.nome, saldo };
    });

    const caixaTotal = accountBalances.reduce((sum, c) => sum + c.saldo, 0);

    // MRR from active contracts
    const mrr = (contratos || []).reduce((sum, c) => {
      if (c.recorrencia === "mensal") return sum + Number(c.valor);
      if (c.recorrencia === "trimestral") return sum + Number(c.valor) / 3;
      if (c.recorrencia === "semestral") return sum + Number(c.valor) / 6;
      if (c.recorrencia === "anual") return sum + Number(c.valor) / 12;
      return sum;
    }, 0);

    // Group expenses by category
    const despesasPorCategoria: Record<string, number> = despesasPagas.reduce((acc: Record<string, number>, d) => {
      const cat = d.categoria?.nome || "Sem categoria";
      acc[cat] = (acc[cat] || 0) + Number(d.valor);
      return acc;
    }, {});

    // Build financial context
    const financialContext = `
DADOS FINANCEIROS DO PERÍODO (${periodLabel}):

📊 CAIXA ATUAL:
${accountBalances.map(c => `- ${c.nome}: ${formatCurrency(c.saldo)}`).join("\n")}
Total em Caixa: ${formatCurrency(caixaTotal)}

💰 RECEITAS DO PERÍODO:
- Total Recebido: ${formatCurrency(totalReceitasRecebidas)}
- Pendente/Atrasado: ${formatCurrency(totalReceitasPendentes)}
- Total Geral: ${formatCurrency(totalReceitasRecebidas + totalReceitasPendentes)}

💸 DESPESAS DO PERÍODO:
- Total Pago: ${formatCurrency(totalDespesasPagas)}
- Pendente/Atrasado: ${formatCurrency(totalDespesasPendentes)}
- Por Categoria:
${Object.entries(despesasPorCategoria)
  .sort((a, b) => (b[1] as number) - (a[1] as number))
  .slice(0, 5)
  .map(([cat, val]) => `  • ${cat}: ${formatCurrency(val as number)}`)
  .join("\n")}

📈 CONTRATOS ATIVOS:
- Quantidade: ${(contratos || []).length}
- MRR (Receita Mensal Recorrente): ${formatCurrency(mrr)}
- Receita Anual Projetada: ${formatCurrency(mrr * 12)}
${(contratos || []).slice(0, 5).map(c => `  • ${c.cliente?.nome || "Cliente"}: ${formatCurrency(Number(c.valor))}/mês`).join("\n")}

📊 RESULTADO DO PERÍODO:
- Lucro Líquido: ${formatCurrency(lucro)}
- Margem de Lucro: ${margemLucro}%
- Receitas Atrasadas: ${receitasPendentes.filter(r => r.status === "atrasado").length} (${formatCurrency(receitasPendentes.filter(r => r.status === "atrasado").reduce((s, r) => s + Number(r.valor), 0))})
`;

    // System prompt
    const systemPrompt = `Você é um consultor financeiro especializado da Pixify Company, uma agência de marketing e IA brasileira.

Suas capacidades:
- Analisar fluxo de caixa e identificar tendências
- Calcular margem de lucro e projeções
- Orientar sobre distribuição de lucros de forma segura
- Identificar despesas acima da média ou padrões preocupantes
- Projetar receitas baseado em contratos ativos
- Alertar sobre pagamentos pendentes e atrasados
- Sugerir otimizações financeiras

Diretrizes:
- Use formatação em moeda brasileira (R$)
- Seja direto e prático nas recomendações
- Forneça números específicos baseados nos dados reais
- Use emojis com moderação para destacar pontos importantes
- Formate respostas em Markdown quando apropriado
- Considere uma reserva de emergência de 3 meses de despesas ao recomendar distribuição de lucros

${financialContext}`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione mais créditos para continuar." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("Erro ao processar sua mensagem");
    }

    // Stream the response
    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("financial-advisor error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
