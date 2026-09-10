import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface ParsedTransaction {
  data: string;
  descricao: string;
  valor: number;
  tipo: 'receita' | 'despesa';
  conta_pagamento: string;
  categoria_sugerida: string;
  subcategoria: string;
  ignorar: boolean;
  motivo_ignorar?: string;
  is_transfer?: boolean;
  transfer_type?: 'enviada' | 'recebida';
  transfer_match_key?: string;
  fornecedor?: string;
  cliente?: string;
  source_file?: string;
  forma_pagamento?: string;
}

interface ParseRequest {
  file_content?: string;
  file_type?: string;
  file_name?: string;
  files?: Array<{
    content: string;
    type: string;
    name: string;
  }>;
}

function sanitizeError(error: unknown): string {
  console.error('Internal error:', error);
  return 'Ocorreu um erro ao processar o arquivo. Tente novamente.';
}

// Parse Brazilian date formats including DD/MM/YY
function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  const trimmed = dateStr.trim();
  
  // Handle DD/MM/YY (2-digit year)
  const brShortMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (brShortMatch) {
    const [, day, month, year] = brShortMatch;
    const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Handle DD/MM/YYYY
  const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Handle YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;
  
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  
  return new Date().toISOString().split('T')[0];
}

// Parse Brazilian currency format
function parseValue(valueStr: string | number): number {
  if (typeof valueStr === 'number') return valueStr;
  if (!valueStr) return 0;
  
  let cleaned = String(valueStr).trim();
  cleaned = cleaned.replace(/R\$\s*/g, '');
  
  const isNegative = cleaned.startsWith('-') || cleaned.startsWith('(');
  cleaned = cleaned.replace(/[()]/g, '').replace(/^-/, '').trim();
  
  // Handle Brazilian format: 1.234,56
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  
  const value = parseFloat(cleaned) || 0;
  return isNegative ? -value : value;
}

// Detect forma_pagamento from description
function detectFormaPagamento(descricao: string): string | undefined {
  const lower = descricao.toLowerCase();
  if (lower.includes('pix')) return 'pix';
  if (lower.includes('boleto')) return 'boleto';
  if (lower.includes('cartão') || lower.includes('cartao') || lower.includes('visa') || lower.includes('mastercard') || lower.includes('nubank')) return 'cartao';
  if (lower.includes('ted') || lower.includes('transferência') || lower.includes('transferencia')) return 'transferencia';
  if (lower.includes('dinheiro') || lower.includes('espécie') || lower.includes('especie')) return 'dinheiro';
  return undefined;
}

// Check if transaction is a transfer
function analyzeTransfer(descricao: string): { 
  ignore: boolean; 
  reason?: string;
  is_transfer: boolean;
  transfer_type?: 'enviada' | 'recebida';
} {
  const lowerDesc = descricao.toLowerCase();
  
  const sendPatterns = ['transferência enviada', 'transferencia enviada', 'ted enviada'];
  const receivePatterns = ['transferência recebida', 'transferencia recebida', 'ted recebida'];
  
  for (const pattern of sendPatterns) {
    if (lowerDesc.includes(pattern)) {
      return { ignore: true, reason: 'Transferência entre contas', is_transfer: true, transfer_type: 'enviada' };
    }
  }
  
  for (const pattern of receivePatterns) {
    if (lowerDesc.includes(pattern)) {
      return { ignore: true, reason: 'Transferência entre contas', is_transfer: true, transfer_type: 'recebida' };
    }
  }
  
  if (lowerDesc.includes('transferência entre contas') || lowerDesc.includes('transferencia entre contas')) {
    return { ignore: true, reason: 'Transferência entre contas', is_transfer: true };
  }
  
  return { ignore: false, is_transfer: false };
}

// Normalize header name for mapping
function normalizeHeader(header: string): string {
  return header.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Parse CSV with smart header detection
function parseCSV(content: string): ParsedTransaction[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  // Detect separator
  const firstLine = lines[0];
  const separator = firstLine.includes(';') ? ';' : ',';
  
  // Parse header
  const rawHeaders = firstLine.split(separator).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const headers = rawHeaders.map(normalizeHeader);
  
  // Check if first line is actually a header
  const hasHeader = headers.some(h => 
    h.includes('data') || h.includes('date') || h.includes('descri') || 
    h.includes('titulo') || h.includes('valor') || h.includes('value')
  );
  
  if (!hasHeader) {
    // No header - fallback to positional parsing
    return lines.map(line => {
      const parts = line.split(separator).map(p => p.trim().replace(/^["']|["']$/g, ''));
      const data = parts[0] || '';
      const descricao = parts[1] || '';
      const valorStr = parts[parts.length > 3 ? 3 : parts.length - 1] || '0';
      const valor = parseValue(valorStr);
      const transferInfo = analyzeTransfer(descricao);
      const matchKey = transferInfo.is_transfer ? `${parseDate(data)}_${Math.abs(valor).toFixed(2)}` : undefined;
      
      return {
        data: parseDate(data),
        descricao,
        valor: Math.abs(valor),
        tipo: (valor >= 0 ? 'receita' : 'despesa') as 'receita' | 'despesa',
        conta_pagamento: '',
        categoria_sugerida: '',
        subcategoria: '',
        ignorar: transferInfo.ignore,
        motivo_ignorar: transferInfo.reason,
        is_transfer: transferInfo.is_transfer,
        transfer_type: transferInfo.transfer_type,
        transfer_match_key: matchKey,
        forma_pagamento: detectFormaPagamento(descricao),
      };
    }).filter(t => t.descricao);
  }
  
  // Map columns by header name
  const colMap = {
    data: headers.findIndex(h => h === 'data' || h === 'date' || h.includes('data')),
    hora: headers.findIndex(h => h === 'hora' || h === 'time' || h === 'horario'),
    descricao: headers.findIndex(h => h.includes('descri') || h.includes('titulo') || h === 'historico' || h === 'lancamento'),
    valor: headers.findIndex(h => h === 'valor' || h === 'value' || h === 'quantia' || h === 'amount'),
    saldo: headers.findIndex(h => h === 'saldo' || h === 'balance'),
    categoria: headers.findIndex(h => h.includes('categori')),
    subcategoria: headers.findIndex(h => h.includes('subcategori')),
    conta: headers.findIndex(h => h.includes('conta') || h.includes('account')),
  };
  
  // If both 'valor' and 'saldo' exist, use 'valor'. If only 'saldo', use that.
  const valorCol = colMap.valor >= 0 ? colMap.valor : colMap.saldo;
  const descCol = colMap.descricao >= 0 ? colMap.descricao : -1;
  const dataCol = colMap.data >= 0 ? colMap.data : -1;
  
  if (dataCol < 0 && descCol < 0) {
    console.warn('Could not map CSV columns, falling back to positional');
    return [];
  }
  
  const dataLines = lines.slice(1);
  
  return dataLines.map(line => {
    const parts = line.split(separator).map(p => p.trim().replace(/^["']|["']$/g, ''));
    
    const data = dataCol >= 0 ? parts[dataCol] || '' : '';
    const descricao = descCol >= 0 ? parts[descCol] || '' : '';
    const valorStr = valorCol >= 0 ? parts[valorCol] || '0' : '0';
    const categoria = colMap.categoria >= 0 ? parts[colMap.categoria] || '' : '';
    const subcategoria = colMap.subcategoria >= 0 ? parts[colMap.subcategoria] || '' : '';
    const conta = colMap.conta >= 0 ? parts[colMap.conta] || '' : '';
    
    const valor = parseValue(valorStr);
    const transferInfo = analyzeTransfer(descricao);
    const parsedDate = parseDate(data);
    const matchKey = transferInfo.is_transfer ? `${parsedDate}_${Math.abs(valor).toFixed(2)}` : undefined;
    
    // Extract fornecedor from "Pix enviado para XXXX" or "Pix recebido de XXXX"
    let fornecedor = '';
    let cliente = '';
    const paraMatch = descricao.match(/(?:para|destinatário|destinatario)\s+(.+)/i);
    const deMatch = descricao.match(/(?:recebido de|de)\s+(.+)/i);
    
    if (valor < 0 && paraMatch) {
      fornecedor = paraMatch[1].trim();
    } else if (valor >= 0 && deMatch) {
      cliente = deMatch[1].trim();
    }
    
    return {
      data: parsedDate,
      descricao,
      valor: Math.abs(valor),
      tipo: (valor < 0 ? 'despesa' : 'receita') as 'receita' | 'despesa',
      conta_pagamento: conta,
      categoria_sugerida: categoria,
      subcategoria,
      ignorar: transferInfo.ignore,
      motivo_ignorar: transferInfo.reason,
      is_transfer: transferInfo.is_transfer,
      transfer_type: transferInfo.transfer_type,
      transfer_match_key: matchKey,
      fornecedor,
      cliente,
      forma_pagamento: detectFormaPagamento(descricao),
    } as ParsedTransaction;
  }).filter(t => t.descricao);
}

// Parse XLSX content
function parseXLSX(base64Content: string): ParsedTransaction[] {
  try {
    const binaryStr = atob(base64Content);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    
    const workbook = XLSX.read(bytes, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
    
    if (data.length < 2) return [];
    
    let headerIndex = 0;
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i];
      if (row && row.some((cell: any) => {
        const str = String(cell || '').toLowerCase();
        return str.includes('data') || str.includes('titulo') || str.includes('valor');
      })) {
        headerIndex = i;
        break;
      }
    }
    
    const headerRow = data[headerIndex];
    if (!headerRow || headerRow.length === 0) {
      throw new Error('Could not find header row in XLSX file');
    }
    
    const headers = headerRow.map((h: any) => String(h ?? '').toLowerCase().trim());
    const dataRows = data.slice(headerIndex + 1);
    
    const colMap = {
      data: headers.findIndex((h: string) => h && h.includes('data')),
      titulo: headers.findIndex((h: string) => h && (h.includes('titulo') || h.includes('título') || h.includes('descri'))),
      categoria: headers.findIndex((h: string) => h && (h === 'categoria' || h.includes('categoria'))),
      subcategoria: headers.findIndex((h: string) => h && h.includes('subcategoria')),
      conta: headers.findIndex((h: string) => h && h.includes('conta')),
      valor: headers.findIndex((h: string) => h && h.includes('valor')),
    };
    
    return dataRows.map((row: any[]) => {
      if (!row || row.length === 0) return null;
      
      const data = colMap.data >= 0 ? String(row[colMap.data] || '') : '';
      const descricao = colMap.titulo >= 0 ? String(row[colMap.titulo] || '') : '';
      const categoria = colMap.categoria >= 0 ? String(row[colMap.categoria] || '') : '';
      const subcategoria = colMap.subcategoria >= 0 ? String(row[colMap.subcategoria] || '') : '';
      const conta = colMap.conta >= 0 ? String(row[colMap.conta] || '') : '';
      const valorRaw = colMap.valor >= 0 ? row[colMap.valor] : 0;
      
      const valor = parseValue(valorRaw);
      const transferInfo = analyzeTransfer(descricao);
      const parsedDate = parseDate(data);
      const matchKey = transferInfo.is_transfer ? `${parsedDate}_${Math.abs(valor).toFixed(2)}` : undefined;
      
      return {
        data: parsedDate,
        descricao,
        valor: Math.abs(valor),
        tipo: valor >= 0 ? 'receita' : 'despesa',
        conta_pagamento: conta,
        categoria_sugerida: categoria,
        subcategoria,
        ignorar: transferInfo.ignore,
        motivo_ignorar: transferInfo.reason,
        is_transfer: transferInfo.is_transfer,
        transfer_type: transferInfo.transfer_type,
        transfer_match_key: matchKey,
        forma_pagamento: detectFormaPagamento(descricao),
      } as ParsedTransaction;
    }).filter((t): t is ParsedTransaction => t !== null && !!t.descricao);
  } catch (error) {
    console.error('Error parsing XLSX:', error);
    throw new Error('Failed to parse XLSX file');
  }
}

// Parse PDF/Image using AI
async function parseWithAI(base64Content: string, fileType: string, fileName?: string): Promise<ParsedTransaction[]> {
  const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('IARA_API_KEY');
  if (!apiKey) throw new Error('Configuração de IA não encontrada');
  
  const mediaType = fileType.includes('pdf') ? 'application/pdf' : fileType.includes('png') ? 'image/png' : 'image/jpeg';
  
  const prompt = `Analyze this financial document and extract all transactions.
Return a JSON array with the following structure for each transaction:
{
  "data": "YYYY-MM-DD",
  "descricao": "description of the transaction",
  "valor": 123.45 (positive for income, negative for expenses),
  "conta_pagamento": "bank or account name if visible",
  "categoria_sugerida": "suggested category based on the transaction description",
  "fornecedor": "supplier/vendor name if visible (for expenses)",
  "cliente": "client name if visible (for income)"
}

Rules:
- Positive values are income (receitas)
- Negative values are expenses (despesas)
- Convert Brazilian date format (DD/MM/YYYY or DD/MM/YY) to YYYY-MM-DD
- Convert Brazilian currency (R$ 1.234,56) to number (1234.56)
- Include ALL visible transactions
- If conta_pagamento is not visible, use empty string
- For categoria_sugerida, use one of these when applicable:
  - For income: Serviços Prestados, Projetos, Consultoria, Licenças/Assinaturas, Comissões, Outros
  - For expenses: Ferramentas e Software, Marketing e Publicidade, Infraestrutura, Pessoal/Salários, Impostos, Serviços Terceirizados, Materiais, Outros

Return ONLY the JSON array, no markdown or explanation.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('IARA_MODEL') || 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64Content}` } },
        ],
      }],
      max_tokens: 16000,
    }),
  });
  
  if (!response.ok) {
    if (response.status === 429) throw new Error('Limite de requisições atingido. Tente novamente em alguns minutos.');
    if (response.status === 402) throw new Error('Serviço temporariamente indisponível.');
    const error = await response.text();
    console.error('AI API error:', error);
    throw new Error('Failed to analyze document with AI');
  }
  
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || '[]';
  const finishReason = result.choices?.[0]?.finish_reason;
  
  // Strip markdown code fences if present
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  
  // Try direct parse first
  let parsed: any[] | null = null;
  try {
    const m = cleaned.match(/\[[\s\S]*\]/);
    parsed = JSON.parse(m ? m[0] : cleaned);
  } catch {
    // Fallback: salvage truncated JSON by cutting at last complete object
    const start = cleaned.indexOf('[');
    if (start >= 0) {
      const body = cleaned.slice(start + 1);
      const lastClose = body.lastIndexOf('}');
      if (lastClose >= 0) {
        const repaired = '[' + body.slice(0, lastClose + 1) + ']';
        try {
          parsed = JSON.parse(repaired);
          console.log(`Recovered ${parsed?.length ?? 0} transactions from truncated AI response (finish_reason=${finishReason})`);
        } catch (e) {
          console.error('JSON repair failed:', e);
        }
      }
    }
  }
  
  if (!parsed) {
    console.error('Failed to parse AI response:', content);
    if (finishReason === 'length') {
      throw new Error('Documento muito grande para análise em uma só leitura. Divida o PDF em partes menores (ex: por mês) e envie novamente.');
    }
    throw new Error('Failed to parse AI response');
  }
  
  return parsed.map((item: any) => {
      const valor = parseValue(item.valor);
      const transferInfo = analyzeTransfer(item.descricao || '');
      const parsedDate = parseDate(item.data || '');
      const matchKey = transferInfo.is_transfer ? `${parsedDate}_${Math.abs(valor).toFixed(2)}` : undefined;
      
      return {
        data: parsedDate,
        descricao: item.descricao || '',
        valor: Math.abs(valor),
        tipo: valor >= 0 ? 'receita' : 'despesa',
        conta_pagamento: item.conta_pagamento || '',
        categoria_sugerida: item.categoria_sugerida || '',
        subcategoria: '',
        ignorar: transferInfo.ignore,
        motivo_ignorar: transferInfo.reason,
        is_transfer: transferInfo.is_transfer,
        transfer_type: transferInfo.transfer_type,
        transfer_match_key: matchKey,
        fornecedor: item.fornecedor || '',
        cliente: item.cliente || '',
        source_file: fileName || '',
        forma_pagamento: detectFormaPagamento(item.descricao || ''),
      } as ParsedTransaction;
    }).filter((t: ParsedTransaction) => t.descricao);
}

// Pair transfers
function pairTransfers(transactions: ParsedTransaction[]): { 
  remaining: ParsedTransaction[]; 
  paired: Array<{ enviada: ParsedTransaction; recebida: ParsedTransaction }>;
} {
  const transfers = transactions.filter(t => t.is_transfer && t.transfer_match_key);
  const nonTransfers = transactions.filter(t => !t.is_transfer || !t.transfer_match_key);
  
  const enviadas = transfers.filter(t => t.transfer_type === 'enviada');
  const recebidas = transfers.filter(t => t.transfer_type === 'recebida');
  
  const paired: Array<{ enviada: ParsedTransaction; recebida: ParsedTransaction }> = [];
  const usedRecebidas = new Set<number>();
  
  for (const env of enviadas) {
    const matchIdx = recebidas.findIndex((rec, idx) => 
      !usedRecebidas.has(idx) && rec.transfer_match_key === env.transfer_match_key
    );
    
    if (matchIdx >= 0) {
      paired.push({ enviada: env, recebida: recebidas[matchIdx] });
      usedRecebidas.add(matchIdx);
    } else {
      nonTransfers.push(env);
    }
  }
  
  recebidas.forEach((rec, idx) => {
    if (!usedRecebidas.has(idx)) nonTransfers.push(rec);
  });
  
  return { remaining: nonTransfers, paired };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { file_content, file_type, file_name, files }: ParseRequest = await req.json();
    const isMultipleFiles = files && Array.isArray(files) && files.length > 0;
    
    if (!isMultipleFiles && (!file_content || !file_type)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Conteúdo e tipo de arquivo são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isMultipleFiles && files!.length > 10) {
      return new Response(
        JSON.stringify({ success: false, error: 'Máximo de 10 arquivos permitidos por vez.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isMultipleFiles && file_content && file_content.length > MAX_FILE_SIZE * 1.4) {
      return new Response(
        JSON.stringify({ success: false, error: 'Arquivo muito grande. Máximo permitido: 10MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    let transactions: ParsedTransaction[] = [];
    
    if (isMultipleFiles) {
      console.log(`Processing ${files!.length} files for user: ${user.id}`);
      
      for (const file of files!) {
        if (file.content.length > MAX_FILE_SIZE * 1.4) {
          console.warn(`File ${file.name} too large, skipping`);
          continue;
        }
        if (!file.type.includes('image')) {
          console.warn(`File ${file.name} is not an image, skipping`);
          continue;
        }
        
        console.log(`Processing image: ${file.name}`);
        const fileTransactions = await parseWithAI(file.content, file.type, file.name);
        transactions.push(...fileTransactions);
      }
    } else {
      console.log(`Processing file: ${file_name}, type: ${file_type} for user: ${user.id}`);
      
      if (file_type!.includes('csv') || file_type === 'text/plain') {
        transactions = parseCSV(file_content!);
      } else if (file_type!.includes('spreadsheet') || file_type!.includes('excel') || file_name?.endsWith('.xlsx') || file_name?.endsWith('.xls')) {
        transactions = parseXLSX(file_content!);
      } else if (file_type!.includes('pdf') || file_type!.includes('image')) {
        transactions = await parseWithAI(file_content!, file_type!, file_name);
      } else {
        return new Response(
          JSON.stringify({ success: false, error: `Tipo de arquivo não suportado: ${file_type}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Pair transfers
    const { remaining, paired } = pairTransfers(transactions);
    
    console.log(`Parsed ${transactions.length} transactions, ${paired.length} transfer pairs for user: ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        transactions: remaining,
        paired_transfers: paired,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = sanitizeError(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
