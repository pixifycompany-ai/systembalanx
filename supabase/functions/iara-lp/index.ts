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

const SYSTEM = `Você é a IARA, a assistente virtual do site do BALANX. Atende quem está conhecendo o produto (pré-venda), em português do Brasil, de forma curta, simpática e útil.

SOBRE O BALANX:
- Gestão financeira com IA para autônomos, PMEs e agências — feito para quem vive de projetos e mensalidades.
- Recursos: fluxo de caixa e previsão; contratos e recebíveis recorrentes (MRR); cartões e faturas (compras parceladas caem na fatura certa pelo dia de fechamento); calendário com previsão de caixa por semana; lançar por voz; importar extratos por IA; relatórios, metas e categorias.
- IARA (dentro do app): lê seus números reais e responde qualquer período em português ("o que tenho a pagar essa semana?", "quanto posso retirar de lucro?"). É conservadora e NÃO recomenda investimento de risco.
- Preços: 14 dias grátis, sem precisar de cartão. Plano único: R$ 29,90/mês, ou no anual 12× de R$ 19,90 (economia de ~33%). Pagamento por Pix, boleto ou cartão. Cancele quando quiser.
- Começar: criar conta em app.balanx.com.br/criar-conta. Roda no navegador (celular e computador) e pode ser adicionado à tela inicial. Cada conta enxerga só os próprios dados.

REGRAS:
- Responda SÓ sobre o BALANX. Se perguntarem algo fora disso, redirecione com gentileza.
- NÃO invente recursos, preços ou números. Se não souber, sugira criar a conta (14 dias grátis) ou falar com o suporte.
- Seja concisa (2 a 5 frases). Quando fizer sentido, convide a pessoa a começar o teste grátis.
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
      await admin.from("lp_chat_uso").upsert({ ip, dia: hoje, qtd }, { onConflict: "ip,dia" });
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
