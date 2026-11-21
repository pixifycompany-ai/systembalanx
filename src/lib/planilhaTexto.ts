// Converte planilhas para texto CSV (";") para a IARA ler, sem biblioteca externa:
// - .xlsx: é um ZIP com XML dentro; descompacta com DecompressionStream e lê as abas.
// - ".xls" que na verdade é HTML ou XML (muito comum em extrato/fatura de banco): lê a tabela.
// - .xls binário antigo (Excel 97–2003): não suportado → pede para salvar como .xlsx ou .csv.

export class PlanilhaNaoSuportada extends Error {}

const q = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

// ---------------------------------------------------------------- ZIP (só leitura)
async function lerZip(buf: ArrayBuffer): Promise<Map<string, () => Promise<string>>> {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new PlanilhaNaoSuportada('arquivo não é uma planilha .xlsx válida');
  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const arquivos = new Map<string, () => Promise<string>>();
  for (let k = 0; k < total && dv.getUint32(p, true) === 0x02014b50; k++) {
    const metodo = dv.getUint16(p + 10, true);
    const tam = dv.getUint32(p + 20, true);
    const nLen = dv.getUint16(p + 28, true), xLen = dv.getUint16(p + 30, true), cLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nome = dec.decode(u8.subarray(p + 46, p + 46 + nLen));
    p += 46 + nLen + xLen + cLen;
    arquivos.set(nome, async () => {
      const ini = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const dados = u8.subarray(ini, ini + tam);
      if (metodo === 0) return dec.decode(dados);
      if (metodo !== 8) throw new PlanilhaNaoSuportada('compressão não suportada');
      const stream = new Response(dados).body!.pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    });
  }
  return arquivos;
}

// ---------------------------------------------------------------- XLSX
const colIdx = (ref: string) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
const DATAS_PADRAO = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
function serialParaData(n: number, comHora: boolean) {
  const ms = Math.round((n - 25569) * 86400000);
  const d = new Date(ms);
  const dd = String(d.getUTCDate()).padStart(2, '0'), mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const base = `${dd}/${mm}/${d.getUTCFullYear()}`;
  return comHora && (d.getUTCHours() || d.getUTCMinutes()) ? `${base} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` : base;
}

async function xlsxParaCsv(buf: ArrayBuffer): Promise<string> {
  const zip = await lerZip(buf);
  const xml = async (nome: string) => { const f = zip.get(nome); return f ? new DOMParser().parseFromString(await f(), 'application/xml') : null; };
  const [wb, rels, sst, sty] = await Promise.all([xml('xl/workbook.xml'), xml('xl/_rels/workbook.xml.rels'), xml('xl/sharedStrings.xml'), xml('xl/styles.xml')]);
  if (!wb) throw new PlanilhaNaoSuportada('planilha sem abas');
  const strings = sst ? [...sst.getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent || '').join('')) : [];
  // Estilos que são data (para mostrar 02/11/2026 em vez de 46328).
  const fmtData = new Set<number>(DATAS_PADRAO);
  if (sty) for (const nf of [...sty.getElementsByTagName('numFmt')]) {
    const cod = (nf.getAttribute('formatCode') || '').replace(/\[[^\]]*\]|"[^"]*"/g, '');
    if (/[dmy]/i.test(cod) && !/^[#0.,%]+$/.test(cod)) fmtData.add(Number(nf.getAttribute('numFmtId')));
  }
  const xfs = sty?.getElementsByTagName('cellXfs')[0];
  const estiloData = xfs ? [...xfs.getElementsByTagName('xf')].map((xf) => fmtData.has(Number(xf.getAttribute('numFmtId')))) : [];
  const alvo = new Map<string, string>();
  if (rels) for (const r of [...rels.getElementsByTagName('Relationship')]) alvo.set(r.getAttribute('Id') || '', r.getAttribute('Target') || '');

  const saida: string[] = [];
  for (const sh of [...wb.getElementsByTagName('sheet')]) {
    const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || '';
    let t = alvo.get(rid) || '';
    t = t.startsWith('/') ? t.slice(1) : `xl/${t}`;
    const doc = await xml(t);
    if (!doc) continue;
    const linhas: string[] = [];
    for (const row of [...doc.getElementsByTagName('row')]) {
      const cel: string[] = [];
      for (const c of [...row.getElementsByTagName('c')]) {
        const i = colIdx(c.getAttribute('r') || 'A1');
        const tipo = c.getAttribute('t');
        const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
        let txt = '';
        if (tipo === 's') txt = strings[Number(v)] ?? '';
        else if (tipo === 'inlineStr') txt = [...c.getElementsByTagName('t')].map((x) => x.textContent || '').join('');
        else if (tipo === 'b') txt = v === '1' ? 'VERDADEIRO' : 'FALSO';
        else if (tipo === 'str' || tipo === 'e') txt = v;
        else if (v !== '') {
          const n = Number(v);
          txt = estiloData[Number(c.getAttribute('s') || 0)] && n > 0 && n < 2958466 ? serialParaData(n, n % 1 !== 0) : String(n).replace('.', ',');
        }
        cel[i] = txt;
      }
      if (cel.some((x) => x && x.trim())) linhas.push(Array.from(cel, (x) => q(x ?? '')).join(';'));
    }
    if (linhas.length) saida.push(`### Aba: ${sh.getAttribute('name') || 'Planilha'}\n${linhas.join('\n')}`);
  }
  if (!saida.length) throw new PlanilhaNaoSuportada('planilha vazia');
  return saida.join('\n\n');
}

// ---------------------------------------------------------------- ".xls" que é HTML/XML
function tabelaHtmlParaCsv(texto: string): string {
  const doc = new DOMParser().parseFromString(texto, 'text/html');
  const linhas = [...doc.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((td) => q((td.textContent || '').replace(/\s+/g, ' ').trim())).join(';'));
  return linhas.filter((l) => l.replace(/;/g, '').trim()).join('\n');
}
function xmlPlanilhaParaCsv(texto: string): string {
  // Excel 2003 XML ("SpreadsheetML"): <Row><Cell><Data>…
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  const linhas = [...doc.getElementsByTagName('Row')].map((r) => [...r.getElementsByTagName('Cell')].map((c) => q((c.getElementsByTagName('Data')[0]?.textContent || '').trim())).join(';'));
  return linhas.filter((l) => l.replace(/;/g, '').trim()).join('\n');
}

/** Lê .xlsx ou .xls e devolve o conteúdo como CSV (";"). Lança PlanilhaNaoSuportada quando não dá. */
export async function planilhaParaCsv(buf: ArrayBuffer): Promise<string> {
  const u8 = new Uint8Array(buf, 0, Math.min(8, buf.byteLength));
  if (u8[0] === 0x50 && u8[1] === 0x4b) return xlsxParaCsv(buf); // "PK" = ZIP = .xlsx
  if (u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0) {
    throw new PlanilhaNaoSuportada('Esse .xls é do formato antigo do Excel. Abra e salve como .xlsx ou .csv (ou exporte em CSV no banco).');
  }
  let texto: string;
  try { texto = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { texto = new TextDecoder('windows-1252').decode(buf); }
  if (/<table[\s>]/i.test(texto)) { const c = tabelaHtmlParaCsv(texto); if (c) return c; }
  if (/<Workbook[\s>]/.test(texto)) { const c = xmlPlanilhaParaCsv(texto); if (c) return c; }
  if (/[;,\t]/.test(texto.slice(0, 2000))) return texto; // na verdade é CSV/TSV com extensão .xls
  throw new PlanilhaNaoSuportada('Não consegui ler essa planilha. Salve como .xlsx ou .csv e mande de novo.');
}
