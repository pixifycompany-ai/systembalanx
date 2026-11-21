import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planilhaParaCsv, PlanilhaNaoSuportada } from './planilhaTexto';

const arquivo = (bytes: Uint8Array | string, _nome: string) => (typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes).slice().buffer;

describe('planilhaParaCsv', () => {
  it('lê .xlsx compactado: textos (inclusive rich text), datas formatadas, números e células vazias', async () => {
    const buf = readFileSync(resolve(__dirname, '__fixtures__/fatura-exemplo.xlsx'));
    const csv = await planilhaParaCsv(arquivo(new Uint8Array(buf), 'fatura.xlsx'));
    expect(csv).toBe([
      '### Aba: Fatura Novembro',
      'Data;Descrição;Valor;Parcela',
      '02/11/2026;UBER *TRIP;32,9',
      '03/11/2026;"IFOOD *RESTAURANTE; CENTRO";-10,5;2/10',
      ';;22,4',
    ].join('\n'));
  });

  it('lê ".xls" que na verdade é uma tabela HTML (exportação comum de banco)', async () => {
    const html = '<html><body><table><tr><th>Data</th><th>Lançamento</th><th>Valor</th></tr><tr><td>05/11/2026</td><td>NETFLIX</td><td>55,90</td></tr></table></body></html>';
    expect(await planilhaParaCsv(arquivo(html, 'extrato.xls'))).toBe('Data;Lançamento;Valor\n05/11/2026;NETFLIX;55,90');
  });

  it('recusa o .xls binário antigo com mensagem clara', async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    await expect(planilhaParaCsv(arquivo(ole, 'velho.xls'))).rejects.toBeInstanceOf(PlanilhaNaoSuportada);
  });
});
