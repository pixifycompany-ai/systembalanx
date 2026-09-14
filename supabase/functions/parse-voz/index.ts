import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Converte valor em número tratando decimal brasileiro:
// "573,41" -> 573.41 · "1.234,56" -> 1234.56 · "573.41" -> 573.41 · 320 -> 320
function parseValor(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v ?? "").trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) {
    // Vírgula = decimal (BR); pontos são separador de milhar → remover.
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// Corrige o caso da transcrição de voz onde a vírgula dos centavos vira " e ":
// falar "305,22" costuma virar o texto "305 e 22" (ou "305 reais e 22 centavos").
// Junta os centavos num único valor decimal, sem afetar itens distintos como
// "20 e 50 de uber".
function normalizarCentavosFalados(texto: string): string {
  let s = String(texto ?? "");
  // (1) Forma com a palavra "centavos" explícita — inequívoca. Aceita "reais"
  // opcional no meio: "305 e 22 centavos" / "305 reais e 22 centavos" -> "305,22".
  // Centavos de 1-2 dígitos, completados com zero à esquerda ("5 centavos" -> 05).
  s = s.replace(
    /(\d[\d.]*)\s*(?:reais?\s+)?e\s+(\d{1,2})\s+centavos?\b/gi,
    (_m, reais, cent) => `${reais},${String(cent).padStart(2, "0")}`,
  );
  // (2) Sem a palavra "centavos": só junta "<reais> e <2 dígitos>" quando está num
  // limite de valor (fim, pontuação ou "reais"), pra não quebrar "20 e 50 de uber".
  s = s.replace(
    /(\d[\d.]*)\s*(?:reais?\s+)?e\s+(\d{2})(?=\s*(?:reais?\b|[.,;:!?)]|$))/gi,
    (_m, reais, cent) => `${reais},${cent}`,
  );
  return s;
}

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

    const { transcript: transcriptRaw } = await req.json();
    if (!transcriptRaw || !String(transcriptRaw).trim()) {
      return new Response(JSON.stringify({ itens: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // "305 e 22" (vírgula falada) -> "305,22" antes de mandar pra IA.
    const transcript = normalizarCentavosFalados(String(transcriptRaw));

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
- "valor" em reais como número com ponto decimal (ex.: "trezentos e vinte reais" -> 320; "573,41" -> 573.41). Sem símbolo e sem separador de milhar.
- DECIMAIS/CENTAVOS: vírgula é decimal. "573,41" é UM valor = 573.41. Falado "quinhentos e setenta e três e quarenta e um" (ou "...e quarenta e um centavos") também é 573.41 — o "e quarenta e um" são os CENTAVOS, NUNCA um segundo valor. JAMAIS divida um único valor em dois lançamentos.
- CENTAVOS COM "E" (transcrição de voz): a vírgula falada costuma virar " e " no texto. "<reais> e <dois dígitos>" SEM nova ação/descrição depois é UM único valor (reais e centavos): "305 e 22" = 305.22; "305 e 22 centavos" = 305.22; "305 reais e 22 centavos" = 305.22; "1250 e 05" = 1250.05; "trezentos e cinco e vinte e dois" = 305.22. A palavra "centavos" depois do segundo número confirma que é UM valor só. Só vira DOIS lançamentos se depois do "e" houver outra ação/coisa (ex.: "20 e 50 de uber" = duas despesas).
- Se o MESMO valor aparecer em dígitos e por extenso (ex.: "573,41 (quinhentos e setenta e três e quarenta e um)"), é o mesmo valor: crie APENAS UM lançamento.
- Um lançamento por ação/verbo. Só crie vários itens quando houver claramente vários gastos/recebimentos distintos (ex.: "paguei 20 de mercado e 50 de uber").
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
        valor: parseValor(i.valor),
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
