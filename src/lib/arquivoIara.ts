// Arquivos que a IARA gera na conversa (PDF ou Excel) a partir de uma tabela pronta
// vinda do servidor (mesmos números das telas). PDF = página de impressão (como a fatura);
// Excel = CSV com BOM (abre direto no Excel), mesmo formato do botão "Excel" dos relatórios.
import { formatCurrency } from '@/utils/formatters';

export interface ColunaArquivo { chave: string; rotulo: string; tipo?: 'moeda' | 'data' | 'texto' | 'pct' }
export interface ArquivoIara {
  id: string;
  formato: 'pdf' | 'excel';
  nome_arquivo: string;
  titulo: string;
  subtitulo: string;
  resumo: { rotulo: string; valor: number | string; tipo?: string }[];
  colunas: ColunaArquivo[];
  linhas: Record<string, unknown>[];
  gerado_em: string;
}

const dataBR = (v: unknown) => { const s = String(v ?? ''); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : s; };
function celula(v: unknown, tipo?: string): string {
  if (v === null || v === undefined || v === '') return '';
  if (tipo === 'moeda' && typeof v === 'number') return formatCurrency(v);
  if (tipo === 'pct' && typeof v === 'number') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  if (tipo === 'data') return dataBR(v);
  return String(v);
}
const resumoTxt = (r: ArquivoIara['resumo'][number]) => (r.tipo === 'moeda' && typeof r.valor === 'number' ? formatCurrency(r.valor) : String(r.valor));
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Excel: número com vírgula decimal (sem "R$") para dar para somar na planilha. */
function baixarExcel(a: ArquivoIara) {
  const num = (v: unknown, tipo?: string) => {
    if ((tipo === 'moeda' || tipo === 'pct') && typeof v === 'number') return v.toFixed(2).replace('.', ',');
    return celula(v, tipo);
  };
  const q = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const linhas = [
    a.colunas.map((c) => q(c.rotulo)).join(';'),
    ...a.linhas.map((l) => a.colunas.map((c) => q(num(l[c.chave], c.tipo))).join(';')),
  ];
  const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url; el.download = `${a.nome_arquivo}.csv`;
  document.body.appendChild(el); el.click(); el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function baixarPdf(a: ArquivoIara): boolean {
  const num = (c: ColunaArquivo) => c.tipo === 'moeda' || c.tipo === 'pct';
  const corpo = a.linhas.map((l) => `<tr>${a.colunas.map((c) => {
    const v = l[c.chave];
    const neg = c.tipo === 'moeda' && typeof v === 'number' && v < 0;
    return `<td class="${num(c) ? 'r' : ''}${neg ? ' neg' : ''}">${esc(celula(v, c.tipo))}</td>`;
  }).join('')}</tr>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(a.nome_arquivo)}</title>
    <style>
      *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:32px}
      h1{font-size:18px;margin:0 0 2px} .sub{color:#6b7280;font-size:12px;margin:0 0 16px}
      .cards{display:flex;gap:10px;margin:0 0 18px;flex-wrap:wrap}
      .card{border:1px solid #e5e7eb;border-radius:10px;padding:10px 14px;min-width:140px}
      .card .l{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280}
      .card .v{font-size:15px;font-weight:bold;margin-top:2px}
      table{width:100%;border-collapse:collapse;font-size:11.5px}
      th,td{text-align:left;padding:7px 9px;border-bottom:1px solid #eceef2;vertical-align:top}
      th{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;border-bottom:1px solid #d1d5db}
      td.r,th.r{text-align:right;white-space:nowrap} .neg{color:#b91c1c}
      .rod{margin-top:14px;color:#9ca3af;font-size:10px}
      @media print{body{margin:12mm}}
    </style></head><body>
    <h1>${esc(a.titulo)}</h1><p class="sub">${esc(a.subtitulo)}</p>
    ${a.resumo.length ? `<div class="cards">${a.resumo.map((r) => `<div class="card"><div class="l">${esc(r.rotulo)}</div><div class="v">${esc(resumoTxt(r))}</div></div>`).join('')}</div>` : ''}
    <table><thead><tr>${a.colunas.map((c) => `<th class="${num(c) ? 'r' : ''}">${esc(c.rotulo)}</th>`).join('')}</tr></thead><tbody>${corpo}</tbody></table>
    <p class="rod">Gerado pela IARA · BALANX · ${esc(dataBR(a.gerado_em))}</p>
    <script>window.onload=function(){window.focus();window.print();}</script>
    </body></html>`;
  const w = window.open('', '_blank', 'width=960,height=1000');
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}

/** Baixa o arquivo. Devolve false se o navegador bloqueou a janela do PDF. */
export function baixarArquivoIara(a: ArquivoIara): boolean {
  if (a.formato === 'excel') { baixarExcel(a); return true; }
  return baixarPdf(a);
}
