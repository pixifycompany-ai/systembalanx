/**
 * Parser de CSV de fatura de cartão de crédito.
 * Suporta formatos comuns brasileiros (Nubank, Itaú, Bradesco, Inter, C6, Sicredi, etc.)
 * Auto-detecta delimitador, ignora preâmbulo e suporta múltiplos blocos de cartão.
 */

export interface ParsedCardRow {
  index: number;
  data: string; // ISO yyyy-mm-dd
  descricao: string;
  valor: number; // sempre positivo (despesa)
  parcela?: string;
}

const DATE_HEADERS = ['date', 'data', 'data da compra', 'data compra', 'dt', 'data lancamento', 'data lançamento'];
const DESC_HEADERS = ['title', 'descricao', 'descrição', 'description', 'historico', 'histórico', 'estabelecimento', 'memo', 'lancamento', 'lançamento'];
const AMOUNT_HEADERS = ['amount', 'valor', 'value', 'valor (r$)', 'valor brl', 'value (r$)', 'valor (brl)'];
const PARCELA_HEADERS = ['parcela', 'parcelas', 'installment'];

function detectDelimiter(line: string): string {
  const counts = [';', ',', '\t', '|'].map(d => ({ d, c: (line.match(new RegExp(`\\${d}`, 'g')) || []).length }));
  counts.sort((a, b) => b.c - a.c);
  return counts[0].c > 0 ? counts[0].d : ',';
}

function splitCsvLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      result.push(current);
      current = '';
    } else current += ch;
  }
  result.push(current);
  return result.map(s => s.trim());
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/^"|"$/g, '').trim();
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const norm = headers.map(normalizeHeader);
  for (const cand of candidates) {
    const idx = norm.findIndex(h => h === cand);
    if (idx >= 0) return idx;
  }
  for (const cand of candidates) {
    const idx = norm.findIndex(h => h.includes(cand));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/^"|"$/g, '');
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{2})$/);
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().replace(/^"|"$/g, '').replace(/"$/, '').replace(/r\$\s*/gi, '');
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()\s]/g, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}

function isHeaderRow(cells: string[]): { dateIdx: number; descIdx: number; amountIdx: number; parcelaIdx: number } | null {
  const dateIdx = findColumnIndex(cells, DATE_HEADERS);
  const descIdx = findColumnIndex(cells, DESC_HEADERS);
  const amountIdx = findColumnIndex(cells, AMOUNT_HEADERS);
  const parcelaIdx = findColumnIndex(cells, PARCELA_HEADERS);
  if (dateIdx >= 0 && descIdx >= 0 && amountIdx >= 0) {
    return { dateIdx, descIdx, amountIdx, parcelaIdx };
  }
  return null;
}

export function parseCardCsv(text: string): { rows: ParsedCardRow[]; warning?: string } {
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], warning: 'CSV vazio ou sem linhas de dados.' };

  // Detect delimiter using the line with the most candidate separators
  let delim = ',';
  let bestCount = 0;
  for (const ln of lines.slice(0, 20)) {
    const d = detectDelimiter(ln);
    const c = (ln.match(new RegExp(`\\${d}`, 'g')) || []).length;
    if (c > bestCount) { bestCount = c; delim = d; }
  }

  const rows: ParsedCardRow[] = [];
  let current: { dateIdx: number; descIdx: number; amountIdx: number; parcelaIdx: number } | null = null;
  const samples: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delim);

    // Try to detect a header row at any position
    const header = isHeaderRow(cells);
    if (header) {
      current = header;
      continue;
    }

    if (!current) {
      if (samples.length < 3) samples.push(lines[i]);
      continue;
    }

    const dateStr = parseDate(cells[current.dateIdx] || '');
    const desc = (cells[current.descIdx] || '').trim();
    const amount = parseAmount(cells[current.amountIdx] || '');

    if (!dateStr || !desc || amount === null) {
      // Could be a separator/section header inside the file — exit transaction mode
      // so we look for the next header.
      if (cells.some(c => /cart[ãa]o/i.test(c)) && cells.length > 1) {
        current = null;
      }
      continue;
    }

    const parcelaRaw = current.parcelaIdx >= 0 ? (cells[current.parcelaIdx] || '').trim() : '';
    const descricao = parcelaRaw ? `${desc} (Parcela ${parcelaRaw})` : desc;

    rows.push({
      index: rows.length,
      data: dateStr,
      descricao,
      valor: Math.abs(amount),
      parcela: parcelaRaw || undefined,
    });
  }

  if (rows.length === 0) {
    return {
      rows: [],
      warning: `Não foi possível identificar colunas. Esperado: data, descrição, valor. Amostra das primeiras linhas: ${samples.join(' | ') || lines[0]}`,
    };
  }

  return { rows };
}
