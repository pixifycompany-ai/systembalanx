// Cruzamento da fatura do banco (linhas lidas do PDF) com os itens da fatura no BALANX.
// Puro (sem banco), para dar para testar: conferir_test.ts.
// deno-lint-ignore-file no-explicit-any
const norm = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const r2c = (x: number) => Math.round(x * 100) / 100;

/** Mesmo critério de "descrição parecida" usado no cruzamento (0 a 1). */
export function parecido(x: string, y: string): number {
  const tok = (s: string) => new Set(norm(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w)));
  const A = tok(x), B = tok(y); if (!A.size || !B.size) return 0;
  let n = 0; A.forEach((w) => { if ([...B].some((v) => v.startsWith(w) || w.startsWith(v))) n++; });
  return n / Math.min(A.size, B.size);
}

export function cruzarFatura(pdf: any[], bal: any[], fech: string) {
  const tok = (s: string) => new Set(norm(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w)));
  const sim = (x: string, y: string) => {
    const A = tok(x), B = tok(y); if (!A.size || !B.size) return 0;
    let n = 0; A.forEach((w) => { if ([...B].some((v) => v.startsWith(w) || w.startsWith(v))) n++; });
    return n / Math.min(A.size, B.size);
  };
  const dias = (d1: string | null, d2: string | null) => (d1 && d2 ? Math.abs(Date.parse(d1) - Date.parse(d2)) / 86400000 : 99);
  const descBal = (b: any) => `${b.fornecedor || ""} ${b.descricao || ""}`;
  const parcBal = (b: any) => (b.parcela ? String(b.parcela).replace(/\s+/g, "") : null);

  // 1ª passada: mesmo valor (centavo) — pontua por parcela igual, data próxima e descrição parecida.
  const pares: { p: any; b: any; score: number }[] = [];
  pdf.forEach((p: any) => bal.forEach((b: any, j: number) => {
    if (Math.abs(p.valor - b.valor) > 0.009) return;
    let score = 10;
    if (p.parcela && parcBal(b) === p.parcela) score += 6;
    const dd = dias(p.data, b.data); score += dd <= 1 ? 4 : dd <= 4 ? 2 : (p.parcela ? 0 : -2);
    score += sim(p.descricao, descBal(b)) * 5;
    pares.push({ p, b: { ...b, j }, score });
  }));
  pares.sort((x, y) => y.score - x.score);
  const usadoP = new Set<number>(), usadoB = new Set<number>();
  const conferidos: any[] = [];
  for (const pr of pares) {
    if (usadoP.has(pr.p.i) || usadoB.has(pr.b.j)) continue;
    usadoP.add(pr.p.i); usadoB.add(pr.b.j); conferidos.push(pr);
  }
  // 2ª passada: mesma compra com valor diferente (descrição parecida e data perto).
  const valorDiferente: any[] = [];
  const restoP = pdf.filter((p: any) => !usadoP.has(p.i));
  for (const p of restoP) {
    let melhor: any = null, ms = 0;
    bal.forEach((b: any, j: number) => {
      if (usadoB.has(j)) return;
      const s = sim(p.descricao, descBal(b)) + (p.parcela && parcBal(b) === p.parcela ? 0.5 : 0);
      if (s >= 0.6 && dias(p.data, b.data) <= 4 && s > ms) { ms = s; melhor = { ...b, j }; }
    });
    if (melhor) {
      usadoP.add(p.i); usadoB.add(melhor.j);
      valorDiferente.push({ no_pdf: { data: p.data, descricao: p.descricao, valor: p.valor, parcela: p.parcela }, no_balanx: { data: melhor.data, descricao: descBal(melhor).trim(), valor: melhor.valor, categoria: melhor.categoria }, diferenca: r2c(p.valor - melhor.valor) });
    }
  }
  // Ciclo desta fatura: compras depois do fechamento anterior até o fechamento.
  const fechAnt = (() => { const [y, m, d] = fech.split("-").map(Number); const t = new Date(Date.UTC(y, m - 2, 1)); const ult = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, ult)).padStart(2, "0")}`; })();
  const dataParaLancar = (d: string | null) => (d && d > fechAnt && d <= fech ? d : new Date(Date.parse(fech) - 86400000).toISOString().slice(0, 10));
  const faltam = pdf.filter((p: any) => !usadoP.has(p.i)).map((p: any) => ({
    data: p.data, descricao: p.descricao, valor: p.valor, parcela: p.parcela,
    data_para_lancar: dataParaLancar(p.data),
    obs: p.valor < 0 ? "estorno/crédito: lance como RECEITA no cartão ou ajuste o item original" : undefined,
  }));
  const sobram = bal.filter((_: any, j: number) => !usadoB.has(j)).map((b: any) => {
    const gemeo = conferidos.find((c) => Math.abs(c.b.valor - b.valor) < 0.01 && sim(descBal(c.b), descBal(b)) >= 0.6);
    return { data: b.data, descricao: descBal(b).trim(), valor: b.valor, parcela: b.parcela, categoria: b.categoria, possivel_duplicado: gemeo ? true : undefined };
  });

  return { faltam, sobram, valorDiferente, conferidos };
}
