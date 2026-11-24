// Valor digitado como no app do banco: cada dígito entra pela direita e a vírgula/ponto
// aparecem sozinhos. 3 → 0,03 · 34 → 0,34 · 3498 → 34,98 · 349800 → 3.498,00.

/** Texto do campo → valor em reais. Com `negativo`, um "-" em qualquer lugar deixa negativo. */
export function digitarMoeda(texto: string, negativo = false): number {
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);
  const v = Number(digitos || '0') / 100;
  return negativo && texto.includes('-') ? -v : v;
}

/** Valor → texto do campo ("" quando zero, para mostrar o placeholder). */
export function mostrarMoeda(n: number | null | undefined): string {
  const v = Number(n) || 0;
  if (!v) return '';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Aceita número, "1234.56", "1.234,56" ou "123,45" e devolve o número. */
export function valorNumero(v: string | number | null | undefined): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim();
  if (!s) return 0;
  const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
  return Number.isFinite(n) ? n : 0;
}
