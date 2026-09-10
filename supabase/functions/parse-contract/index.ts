import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Constants for validation
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

interface ParsedContract {
  objeto_contrato: string;
  valor_mensal: number;
  valor_total: number | null;
  tipo_recorrencia: 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'unico';
  data_inicio: string;
  data_fim: string | null;
  contratante_nome: string;
  contratante_cnpj: string;
  contratante_email: string;
  contratante_telefone: string;
}

interface ParseRequest {
  file_content: string;
  file_type: string;
}

// Clean CNPJ/CPF to only numbers
function cleanDocument(doc: string): string {
  return (doc || '').replace(/\D/g, '');
}

// Format CNPJ for display
function formatCNPJ(cnpj: string): string {
  const clean = cleanDocument(cnpj);
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return clean;
}

// Sanitize error for client response
function sanitizeError(error: unknown): string {
  console.error('Internal error:', error);
  return 'Ocorreu um erro ao processar o contrato. Tente novamente.';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
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
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { file_content, file_type }: ParseRequest = await req.json();
    
    // Input validation
    if (!file_content) {
      return new Response(
        JSON.stringify({ success: false, error: 'Conteúdo do arquivo é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size (base64 is ~1.37x original size)
    if (file_content.length > MAX_FILE_SIZE * 1.4) {
      return new Response(
        JSON.stringify({ success: false, error: 'Arquivo muito grande. Máximo permitido: 10MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type
    const mediaType = file_type?.includes('pdf') ? 'application/pdf' : 
                      file_type?.includes('png') ? 'image/png' :
                      file_type?.includes('jpg') || file_type?.includes('jpeg') ? 'image/jpeg' : null;
    
    if (!mediaType || !ALLOWED_TYPES.includes(mediaType)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tipo de arquivo não suportado. Use PDF, PNG ou JPG.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('IARA_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração de IA não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Analyzing contract with AI for user:', user.id);
    
    const prompt = `Você é um especialista em análise de contratos brasileiros.
Analise este documento de contrato e extraia as seguintes informações em formato JSON:

{
  "objeto_contrato": "descrição do serviço ou objeto do contrato",
  "valor_mensal": 0.00 (valor numérico mensal, sem símbolos de moeda),
  "valor_total": null ou número (valor total do contrato se mencionado),
  "tipo_recorrencia": "mensal" | "trimestral" | "semestral" | "anual" | "unico",
  "data_inicio": "YYYY-MM-DD" (data de início da vigência),
  "data_fim": "YYYY-MM-DD" ou null (data de término, null se indeterminado),
  "contratante_nome": "nome completo da empresa ou pessoa contratante",
  "contratante_cnpj": "apenas números do CNPJ ou CPF",
  "contratante_email": "email se disponível",
  "contratante_telefone": "telefone se disponível"
}

Regras para tipo_recorrencia:
- Se menciona pagamento mensal, "por mês", "ao mês" → "mensal"
- Se menciona trimestral, "a cada 3 meses" → "trimestral"  
- Se menciona semestral, "a cada 6 meses" → "semestral"
- Se menciona anual, "por ano" → "anual"
- Se é pagamento único, projeto fechado → "unico"

Se algum campo não for encontrado:
- valor_mensal: use 0
- valor_total: use null
- data_fim: use null
- emails e telefones: use string vazia ""

Retorne APENAS o JSON, sem markdown ou explicação.`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('IARA_MODEL') || 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${file_content}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2048,
      }),
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Limite de requisições atingido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Serviço temporariamente indisponível.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const error = await response.text();
      console.error('AI API error:', error);
      throw new Error('Failed to analyze contract');
    }
    
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '{}';
    
    // Extract JSON from response
    let jsonStr = content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    let parsed: ParsedContract;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse contract data');
    }
    
    // Clean and validate the data
    const contract: ParsedContract = {
      objeto_contrato: parsed.objeto_contrato || '',
      valor_mensal: typeof parsed.valor_mensal === 'number' ? parsed.valor_mensal : parseFloat(String(parsed.valor_mensal).replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
      valor_total: parsed.valor_total || null,
      tipo_recorrencia: ['mensal', 'trimestral', 'semestral', 'anual', 'unico'].includes(parsed.tipo_recorrencia) 
        ? parsed.tipo_recorrencia 
        : 'mensal',
      data_inicio: parsed.data_inicio || new Date().toISOString().split('T')[0],
      data_fim: parsed.data_fim || null,
      contratante_nome: parsed.contratante_nome || '',
      contratante_cnpj: cleanDocument(parsed.contratante_cnpj || ''),
      contratante_email: parsed.contratante_email || '',
      contratante_telefone: parsed.contratante_telefone || '',
    };
    
    console.log('Contract parsed successfully for user:', user.id);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        contract,
        formatted: {
          ...contract,
          contratante_cnpj_formatted: formatCNPJ(contract.contratante_cnpj),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: sanitizeError(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
