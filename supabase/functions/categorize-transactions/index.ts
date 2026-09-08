import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TransactionInput {
  index: number;
  descricao: string;
  valor: number;
  tipo: 'receita' | 'despesa';
}

interface CategoriaInput {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { transactions, categorias }: { transactions: TransactionInput[]; categorias: CategoriaInput[] } = await req.json();

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!categorias || categorias.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build category lists
    const receitaCats = categorias.filter(c => c.tipo === 'receita').map(c => `"${c.id}": "${c.nome}"`).join(', ');
    const despesaCats = categorias.filter(c => c.tipo === 'despesa').map(c => `"${c.id}": "${c.nome}"`).join(', ');

    // Build transaction list (limit to 50 to avoid token limits)
    const batch = transactions.slice(0, 50);
    const txList = batch.map(t => `${t.index}: [${t.tipo}] "${t.descricao}" (R$ ${t.valor.toFixed(2)})`).join('\n');

    const prompt = `Você é um categorizador financeiro. Dado uma lista de transações e categorias disponíveis, associe cada transação à categoria mais adequada.

CATEGORIAS DE RECEITA: {${receitaCats}}
CATEGORIAS DE DESPESA: {${despesaCats}}

TRANSAÇÕES:
${txList}

REGRAS:
- Para cada transação, retorne o index e o categoria_id mais adequado
- Use APENAS os IDs das categorias listadas acima
- Para receitas, use apenas categorias de receita; para despesas, apenas categorias de despesa
- Se nenhuma categoria se encaixa, omita a transação do resultado

Retorne APENAS um JSON array como: [{"index": 0, "categoria_id": "uuid-aqui"}, ...]
Sem markdown, sem explicação.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Você é um assistente que categoriza transações financeiras. Responda apenas com JSON.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errText = await response.text();
      console.error('AI error:', response.status, errText);
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '[]';

    let jsonStr = content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    try {
      const suggestions = JSON.parse(jsonStr);
      // Validate that all categoria_ids actually exist
      const validIds = new Set(categorias.map(c => c.id));
      const validSuggestions = suggestions.filter((s: any) => 
        typeof s.index === 'number' && validIds.has(s.categoria_id)
      );

      return new Response(
        JSON.stringify({ suggestions: validSuggestions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch {
      console.error('Failed to parse AI categorization response:', content);
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Categorize error:', error);
    return new Response(
      JSON.stringify({ suggestions: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
