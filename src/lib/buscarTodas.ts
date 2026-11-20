// O Supabase (PostgREST) devolve no máximo 1.000 linhas por consulta. Contas com mais
// lançamentos que isso perdiam linhas em silêncio — e saldos/totais saíam errados
// (ex.: saldo da Início ≠ saldo de /contas). Este helper busca em páginas até trazer tudo.
//
// Uso: troque `supabase.from('x').select(...).eq(...)` por
//      `buscarTodas(() => supabase.from('x').select(...).eq(...))` — o retorno é o mesmo { data, error }.
// A função precisa montar a consulta do zero a cada página (o builder não pode ser reaproveitado).

const PAGINA = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builder = any;

export async function buscarTodas<T = any>(montar: () => Builder): Promise<{ data: T[]; error: { message: string } | null }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: T[] = [];
  for (let de = 0; de < 200_000; de += PAGINA) {
    // id como desempate deixa a paginação estável mesmo quando a ordem principal tem empates.
    const { data, error } = await montar().order('id', { ascending: true }).range(de, de + PAGINA - 1);
    if (error) return { data: out, error };
    const lote = (data || []) as T[];
    out.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return { data: out, error: null };
}
