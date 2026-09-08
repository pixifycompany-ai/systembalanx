import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { transcript } = await req.json();
    if (!transcript || !String(transcript).trim()) {
      return new Response(JSON.stringify({ itens: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Categorias do usuário (pra sugerir uma real)
    const { data: cats } = await supabase.from("categorias").select("id, nome, tipo");
    const categorias = (cats || []) as { id: string; nome: string; tipo: string }[];

    const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("IARA_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "IA não configurada (OPENAI_API_KEY)." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const apiBase = (Deno.env.get("IARA_API_BASE") || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = Deno.env.get("IARA_MODEL") || "gpt-4o-mini";
    const hoje = new Date().toISOString().split("T")[0];

    const sys = `Você extrai lançamentos financeiros de uma fala em português do Brasil. HOJE é ${hoje}.
Retorne SOMENTE JSON no formato: {"itens":[{"tipo":"receita"|"despesa","descricao":string,"valor":number,"categoria_id":string|null,"categoria_nome":string|null,"data":"YYYY-MM-DD"}]}.
Regras:
- Cada item é uma receita (entrada/recebi/ganhei) ou despesa (paguei/gastei/comprei/saída). Na dúvida entre entrada e saída, use o verbo.
- "valor" em reais como número (ex.: "trezentos e vinte reais" -> 320). Sem símbolo.
- "data": interprete "hoje", "ontem", "amanhã", "dia 5" etc. a partir de ${hoje}. Se não disser, use ${hoje}.
- "categoria_id": escolha o id da lista de categorias que melhor casa com a descrição E com o tipo; se nenhuma casar, use null e preencha "categoria_nome" com um nome sugerido.
- Se a fala não contiver nenhum lançamento, retorne {"itens":[]}.
CATEGORIAS DISPONÍVEIS (id · nome · tipo):
${categorias.map((c) => `${c.id} · ${c.nome} · ${c.tipo}`).join("\n") || "(nenhuma)"}`;

    const resp = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: String(transcript) },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("parse-voz AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "Erro ao interpretar a fala." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    let parsed: any = {};
    try { parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}"); } catch { parsed = {}; }
    const itens = Array.isArray(parsed.itens) ? parsed.itens : [];

    // Normaliza + valida categoria_id contra as reais
    const idset = new Set(categorias.map((c) => c.id));
    const clean = itens
      .filter((i: any) => i && (i.tipo === "receita" || i.tipo === "despesa"))
      .map((i: any) => ({
        tipo: i.tipo,
        descricao: String(i.descricao || "").slice(0, 200) || "Lançamento",
        valor: Number(i.valor) || 0,
        categoria_id: i.categoria_id && idset.has(i.categoria_id) ? i.categoria_id : null,
        categoria_nome: i.categoria_nome || null,
        data: /^\d{4}-\d{2}-\d{2}$/.test(i.data) ? i.data : hoje,
      }))
      .filter((i: any) => i.valor > 0);

    return new Response(JSON.stringify({ itens: clean }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("parse-voz error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
