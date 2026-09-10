import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RawRow {
  index: number;
  data: string; // ISO yyyy-mm-dd
  descricao: string;
  valor: number; // positive
}

interface CategoriaInput {
  id: string;
  nome: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { rows, categorias }: { rows: RawRow[]; categorias: CategoriaInput[] } = await req.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ enriched: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("IARA_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ enriched: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const catList = categorias.map(c => `"${c.id}": "${c.nome}"`).join(", ");
    const batch = rows.slice(0, 100);
    const txList = batch
      .map(r => `${r.index}: "${r.descricao}" (R$ ${r.valor.toFixed(2)})`)
      .join("\n");

    const prompt = `Você analisa lançamentos de cartão de crédito de uma agência. Para cada lançamento, retorne:
- categoria_id (use APENAS os IDs abaixo; se nada se encaixa, retorne null)
- fornecedor: nome limpo do estabelecimento (ex: "UBER *TRIP HELP.UBER.C" -> "Uber"; "PG *NETFLIX.COM" -> "Netflix"; "MERCADOPAGO*IFOOD" -> "iFood"; remova prefixos de adquirente como "PG*", "MERCADOPAGO*", códigos de cidade no fim, etc.)
- tipo_despesa: "fixa" se for assinatura/serviço recorrente mensal típico (Netflix, Spotify, Google, software, telefonia, internet), senão "variavel"

CATEGORIAS: {${catList}}

LANÇAMENTOS:
${txList}

Retorne APENAS um JSON array. Sem markdown, sem explicação:
[{"index": 0, "categoria_id": "uuid-ou-null", "fornecedor": "Nome", "tipo_despesa": "fixa|variavel"}, ...]`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("IARA_MODEL") || "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você categoriza lançamentos de cartão de crédito. Responda apenas com JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      return new Response(JSON.stringify({ enriched: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "[]";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;

    try {
      const parsed = JSON.parse(jsonStr);
      const validIds = new Set(categorias.map(c => c.id));
      const enriched = parsed
        .filter((s: any) => typeof s.index === "number")
        .map((s: any) => ({
          index: s.index,
          categoria_id: s.categoria_id && validIds.has(s.categoria_id) ? s.categoria_id : null,
          fornecedor: typeof s.fornecedor === "string" ? s.fornecedor.trim().slice(0, 120) : null,
          tipo_despesa: s.tipo_despesa === "fixa" ? "fixa" : "variavel",
        }));

      return new Response(JSON.stringify({ enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ enriched: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("enrich-card-csv error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
