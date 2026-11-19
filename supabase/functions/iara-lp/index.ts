import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// IARA da Landing Page (pré-venda, PÚBLICA — sem login). Responde dúvidas sobre
// o BALANX com base no conhecimento do produto. Aceita texto e áudio (Whisper).
// Rate-limit por IP pra conter abuso (endpoint público -> custo de IA).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIMITE_DIA_IP = Number(Deno.env.get("IARA_LP_LIMITE_IP") || "40");
// Teto diário GERAL (soma de todos os visitantes) — protege o custo de IA mesmo com muitos IPs.
const LIMITE_DIA_TOTAL = Number(Deno.env.get("IARA_LP_LIMITE_DIA") || "2000");
const CHAVE_TOTAL = "__total__"; // linha do contador geral na mesma tabela (não é um IP)

const SYSTEM = `Você é a IARA, a assistente do site do BALANX. Atende quem está conhecendo o produto (pré-venda), em português do Brasil, de forma curta, simpática e útil. A conversa acontece num bloco da página inicial.

O QUE É O BALANX
Gestão financeira com IA para autônomos, PMEs e agências — feito para quem vive de projetos e mensalidades. Roda no navegador do celular e do computador (dá para adicionar à tela inicial como app), com tema claro e escuro.

MÓDULOS
- Fluxo de caixa: entradas, saídas, cartões e transferências num extrato único; várias contas com saldo consolidado; previsão do saldo dia a dia ("vai dar para pagar as contas até o fim do mês?"); calendário de caixa; conferir com o banco (comparar o extrato e dar baixa sem caçar linha por linha); pendências (o que falta resolver).
- Cartões: cada compra cai na fatura certa pelo dia de fechamento; parcelado distribui nas faturas futuras; mostra quanto já está comprometido nos próximos meses; importar a fatura em CSV; pagar a fatura debitando a conta.
- Cobranças (integração com o Asaas): Pix, boleto e cartão. O BALANX avisa o cliente pelo WhatsApp DA PRÓPRIA EMPRESA (ela conecta o número dela no app, com um código, e ele continua funcionando normal no celular) ou por e-mail (enviado pelo BALANX com o nome da empresa) antes do vencimento, no dia e todo dia em atraso — a regra pode ser a padrão, a do contrato ou uma própria de cada cobrança. Quando o cliente paga, a baixa entra sozinha no caixa. Dá para cobrar avulso, parcelado ou todo mês pelo contrato.
- Contratos: cada cliente com contrato, parcelas e vencimentos; as receitas dos próximos meses já entram no financeiro; MRR e ARR na hora; cobrança mensal automática no Asaas, se quiser.
- Agenda e tarefas: compromissos, lembretes e listas de tarefas sincronizados nos dois sentidos com o Google Agenda e o Google Tarefas; as contas a pagar e a receber também aparecem no Google Agenda.
- Relatórios: DRE por competência, despesas por categoria, top clientes, comparativo entre meses, distribuição de lucros, metas de faturamento e alerta das categorias acima da média.
- Cadastros com IA: cliente só pelo CNPJ (o sistema busca os dados públicos da Receita); contrato a partir do PDF; extrato, planilha ou PDF do banco importados por IA, com categoria sugerida automaticamente.
- Multiusuário (sócios, equipe, contador, cada um com seu login) e avisos no celular quando uma conta vence.

A IARA DENTRO DO APP
Lê os números reais da conta e responde qualquer período em português ("o que tenho a pagar essa semana?", "quanto falta receber esse mês?", "quanto posso retirar de lucro?"). Também lança gastos e receitas por texto ou voz, prepara cobranças, cadastra clientes e contratos e cuida da agenda e das tarefas — tudo que muda algo ela mostra antes, para a pessoa confirmar. É conservadora: NÃO recomenda investimento de risco.
Atalho do iPhone: toque duas vezes atrás do iPhone, fale com a IARA e ouça a resposta em voz; ela conversa, lembra o assunto e dá para confirmar por voz ("sim"). Excluir e cancelar só pelo app.

INTEGRAÇÕES: Asaas (Pix, boleto, cartão), Google Agenda, Google Tarefas, WhatsApp e e-mail (lembretes de cobrança) e iPhone (atalho por voz).

PREÇO: 14 dias grátis, sem precisar de cartão. Plano único com tudo incluso: R$ 29,90/mês, ou no anual 12× de R$ 19,90 (economia de ~33%). A assinatura do BALANX é paga por Pix ou cartão de crédito/débito (não aceitamos boleto para a assinatura). Cancele quando quiser.
COMEÇAR: criar a conta em app.balanx.com.br/criar-conta (leva 2 minutos).
SEGURANÇA: cada conta vê só os próprios dados (isolamento por usuário, criptografia em trânsito); a pessoa decide quem acessa.

REGRAS
- Responda SÓ sobre o BALANX. Se perguntarem algo fora disso, redirecione com gentileza.
- NÃO invente recursos, preços, prazos ou números. Se não souber, diga que não tem essa informação e sugira testar 14 dias grátis ou falar com o suporte.
- Seja concisa: 2 a 5 frases, texto corrido (pode usar **negrito** em 1 ou 2 termos; nada de títulos ou tabelas). Quando fizer sentido, convide a começar o teste grátis.
- Nunca peça senha, cartão ou dados sensíveis.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("IARA_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "IA não configurada." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const model = Deno.env.get("IARA_MODEL") || "gpt-4o-mini";
    const openaiBase = "https://api.openai.com/v1";

    // ---- Rate-limit por IP (best-effort, falha aberta) ----
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconhecido";
    try {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const hoje = new Date().toISOString().split("T")[0];
      const { data: row } = await admin.from("lp_chat_uso").select("qtd").eq("ip", ip).eq("dia", hoje).maybeSingle();
      const qtd = (row?.qtd ?? 0) + 1;
      if (qtd > LIMITE_DIA_IP) {
        return new Response(JSON.stringify({ error: "Muitas mensagens por hoje. Crie sua conta grátis em app.balanx.com.br para conversar com a IARA de verdade 🙂" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: tot } = await admin.from("lp_chat_uso").select("qtd").eq("ip", CHAVE_TOTAL).eq("dia", hoje).maybeSingle();
      const qtdTotal = (tot?.qtd ?? 0) + 1;
      if (qtdTotal > LIMITE_DIA_TOTAL) {
        return new Response(JSON.stringify({ error: "A IARA do site já atendeu muita gente hoje e fez uma pausa 🙂 Crie sua conta grátis (14 dias, sem cartão) em app.balanx.com.br/criar-conta — lá dentro ela responde tudo sobre os seus números." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await admin.from("lp_chat_uso").upsert([
        { ip, dia: hoje, qtd },
        { ip: CHAVE_TOTAL, dia: hoje, qtd: qtdTotal },
      ], { onConflict: "ip,dia" });
    } catch (_e) { /* fail open */ }

    // ---- Entrada: JSON (texto) ou multipart (áudio) ----
    let messages: { role: string; content: string }[] = [];
    let transcript: string | null = null;
    const ct = req.headers.get("content-type") || "";

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const raw = form.get("messages");
      if (typeof raw === "string" && raw) { try { messages = JSON.parse(raw); } catch { /* ignore */ } }
      const file = form.get("file");
      if (file instanceof File) {
        const oa = new FormData();
        oa.append("file", file, file.name || "audio.webm");
        oa.append("model", Deno.env.get("TRANSCRIBE_MODEL") || "whisper-1");
        oa.append("language", "pt");
        const tr = await fetch(`${openaiBase}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: oa });
        if (tr.ok) { transcript = ((await tr.json()).text || "").trim(); }
        if (transcript) messages.push({ role: "user", content: transcript });
      }
    } else {
      const body = await req.json().catch(() => ({}));
      messages = Array.isArray(body.messages) ? body.messages : [];
    }

    // Só as últimas 8 mensagens (contém custo/contexto) e cada uma limitada.
    const clean = messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-8)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 1000) }));
    if (!clean.length) {
      return new Response(JSON.stringify({ error: "Envie uma mensagem." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resp = await fetch(`${openaiBase}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: 0.4, max_tokens: 450, messages: [{ role: "system", content: SYSTEM }, ...clean] }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("iara-lp AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "Não consegui responder agora. Tente de novo." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const reply = (data.choices?.[0]?.message?.content || "").trim() || "Desculpe, não entendi. Pode reformular?";
    return new Response(JSON.stringify({ reply, transcript }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("iara-lp error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
