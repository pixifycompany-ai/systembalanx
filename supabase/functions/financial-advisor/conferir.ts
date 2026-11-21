// Cruzamento da fatura do banco (linhas lidas do PDF) com os itens da fatura no BALANX.
// Puro (sem banco), para dar para testar: conferir_test.ts.
// deno-lint-ignore-file no-explicit-any
const norm = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const r2c = (x: number) => Math.round(x * 100) / 100;

/** Mesmo critério de "descrição parecida" usado no cruzamento (0 a 1). */
const tokens = (s: string) => new Set(norm(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w)));
const prefixo = (a: string, b: string) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
const casa = (w: string, v: string) => v.startsWith(w) || w.startsWith(v) || prefixo(w, v) >= Math.max(4, Math.ceil(Math.min(w.length, v.length) * 0.7));
export function parecido(x: string, y: string): number {
  const A = tokens(x), B = tokens(y); if (!A.size || !B.size) return 0;
  let n = 0; A.forEach((w) => { if ([...B].some((v) => casa(w, v))) n++; });
  let r = n / Math.min(A.size, B.size);
  // "OPEN AI" x "OPENAI", "IFD*ARMANDO" x "IFood Armando": compara também tudo junto.
  const cx = norm(x).replace(/[^a-z0-9]/g, ""), cy = norm(y).replace(/[^a-z0-9]/g, "");
  if (r < 0.6 && cx.length >= 4 && cy.length >= 4 && (cx.includes(cy.slice(0, 6)) || cy.includes(cx.slice(0, 6)))) r = 0.6;
  return r;
}

/** Subconjunto (2+ itens) de `cands` cuja soma é exatamente `alvo` (centavos). Prefere os primeiros (mais parecidos). */
function somaExata(cands: { k: number; v: number }[], alvo: number): number[] | null {
  const t = Math.round(alvo * 100);
  if (t <= 0 || cands.length < 2) return null;
  const somas = new Map<number, number[]>([[0, []]]);
  for (const c of cands.slice(0, 24)) {
    const v = Math.round(c.v * 100); if (v <= 0 || v > t) continue;
    for (const [s, lst] of [...somas]) {
      const n = s + v; if (n > t || somas.has(n)) continue;
      somas.set(n, [...lst, c.k]);
      if (n === t && lst.length >= 1) return somas.get(n)!;
    }
  }
  const r = somas.get(t); return r && r.length >= 2 ? r : null;
}

export function cruzarFatura(pdf: any[], bal: any[], fech: string) {
  const sim = parecido;
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
  // 2ª passada: lançamentos SOMADOS. Um item do BALANX que é a soma de várias linhas do
  // arquivo (ex.: "IOF de novembro" = 6 linhas de IOF; "OpenAI" = 27,85 + 27,85) ou uma linha
  // do arquivo dividida em vários itens no BALANX. Só junta descrições parecidas e soma exata.
  const agrupados: any[] = [];
  const balOrd = bal.map((b: any, j: number) => ({ ...b, j })).filter((b: any) => !usadoB.has(b.j)).sort((x: any, y: any) => y.valor - x.valor);
  for (const b of balOrd) {
    const cands = pdf.filter((p: any) => !usadoP.has(p.i) && p.valor > 0 && dias(p.data, b.data) <= 35)
      .map((p: any) => ({ p, s: sim(p.descricao, descBal(b)) })).filter((x: any) => x.s >= 0.6)
      .sort((x: any, y: any) => y.s - x.s || dias(x.p.data, b.data) - dias(y.p.data, b.data));
    const sub = somaExata(cands.map((x: any) => ({ k: x.p.i, v: x.p.valor })), b.valor);
    if (!sub) continue;
    sub.forEach((i) => usadoP.add(i)); usadoB.add(b.j);
    agrupados.push({ tipo: "somado_no_balanx", valor: b.valor,
      balanx: [{ id: b.id, data: b.data, descricao: descBal(b).trim(), valor: b.valor, categoria: b.categoria }],
      arquivo: sub.map((i) => pdf.find((p: any) => p.i === i)).map((p: any) => ({ data: p.data, descricao: p.descricao, valor: p.valor, parcela: p.parcela })) });
  }
  for (const p of pdf.filter((x: any) => !usadoP.has(x.i) && x.valor > 0).sort((x: any, y: any) => y.valor - x.valor)) {
    const cands = bal.map((b: any, j: number) => ({ b: { ...b, j }, s: sim(p.descricao, descBal(b)) }))
      .filter((x: any) => !usadoB.has(x.b.j) && x.s >= 0.6 && dias(p.data, x.b.data) <= 35)
      .sort((x: any, y: any) => y.s - x.s || dias(x.b.data, p.data) - dias(y.b.data, p.data));
    const sub = somaExata(cands.map((x: any) => ({ k: x.b.j, v: x.b.valor })), p.valor);
    if (!sub) continue;
    usadoP.add(p.i); sub.forEach((j) => usadoB.add(j));
    agrupados.push({ tipo: "dividido_no_balanx", valor: p.valor,
      balanx: sub.map((j) => bal[j]).map((b: any) => ({ id: b.id, data: b.data, descricao: descBal(b).trim(), valor: b.valor, categoria: b.categoria })),
      arquivo: [{ data: p.data, descricao: p.descricao, valor: p.valor, parcela: p.parcela }] });
  }

  // 3ª passada: mesma compra com valor diferente (descrição parecida e data perto).
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
      valorDiferente.push({ no_pdf: { data: p.data, descricao: p.descricao, valor: p.valor, parcela: p.parcela }, no_balanx: { id: melhor.id, data: melhor.data, descricao: descBal(melhor).trim(), valor: melhor.valor, categoria: melhor.categoria }, diferenca: r2c(p.valor - melhor.valor) });
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
  const ultimaPdf = pdf.map((p: any) => p.data).filter(Boolean).sort().pop() || null;
  const sobram = bal.filter((_: any, j: number) => !usadoB.has(j)).map((b: any) => {
    const gemeo = conferidos.find((c) => Math.abs(c.b.valor - b.valor) < 0.01 && sim(descBal(c.b), descBal(b)) >= 0.6);
    // Sugestão de exclusão: duplicado ou compra comum que não está no arquivo. Parcela não:
    // costuma entrar no banco só quando a fatura fecha.
    return { id: b.id, data: b.data, descricao: descBal(b).trim(), valor: b.valor, parcela: b.parcela, categoria: b.categoria,
      possivel_duplicado: gemeo ? true : undefined,
      proxima_fatura: !gemeo && ultimaPdf && b.data && b.data > ultimaPdf ? true : undefined,
      sugerir_excluir: !!gemeo || (!b.parcela && !(ultimaPdf && b.data && b.data > ultimaPdf)) };
  });

  return { faltam, sobram, valorDiferente, conferidos, agrupados };
}
