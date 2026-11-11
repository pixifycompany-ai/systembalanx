// "Estender recorrência" para séries soltas (lançadas à mão, sem contrato):
// acha os lançamentos da série, descobre a frequência e cria os próximos,
// renumerando "(n/m)" na série toda (ex.: (12/12) vira (12/24) e entram (13/24)…).
import { addDays, addMonths, addYears, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export type Frequencia = 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

const PARCELA = /\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)\s*/;

export function lerParcela(descricao: string): { base: string; prefixo: string; n: number; total: number } | null {
  const m = descricao.match(PARCELA);
  if (!m) return null;
  return {
    base: descricao.replace(PARCELA, ' ').replace(/\s+/g, ' ').trim(),
    // Texto antes do "(n/m)": é o que identifica a série ("Mensalidade X (5/8) - 8 usuários").
    prefixo: descricao.slice(0, m.index).replace(/\s+/g, ' ').trim(),
    n: Number(m[1]),
    total: Number(m[2]),
  };
}

/** Troca o "(n/m)" da descrição; sem marcador, acrescenta no fim. */
export function comParcela(descricao: string, n: number, total: number): string {
  return PARCELA.test(descricao) ? descricao.replace(/\(\s*\d+\s*\/\s*\d+\s*\)/, `(${n}/${total})`) : `${descricao.trim()} (${n}/${total})`;
}

/** Frequência pela mediana dos intervalos entre os vencimentos. */
export function inferirFrequencia(datas: string[]): Frequencia {
  const ord = [...datas].sort();
  const gaps: number[] = [];
  for (let i = 1; i < ord.length; i++) gaps.push(differenceInCalendarDays(parseISO(ord[i]), parseISO(ord[i - 1])));
  if (!gaps.length) return 'mensal';
  gaps.sort((a, b) => a - b);
  const g = gaps[Math.floor(gaps.length / 2)];
  if (g <= 10) return 'semanal';
  if (g <= 20) return 'quinzenal';
  if (g <= 45) return 'mensal';
  if (g <= 75) return 'bimestral';
  if (g <= 120) return 'trimestral';
  if (g <= 240) return 'semestral';
  return 'anual';
}

const MESES: Partial<Record<Frequencia, number>> = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6 };

/**
 * k-ésima data depois de `primeira` (k=0 é a própria). Mensais contam a partir da
 * primeira data, para não "escorregar" o dia depois de fevereiro (31 → 28 → 28…).
 */
export function dataNaSerie(primeira: string, freq: Frequencia, k: number): string {
  const d = parseISO(primeira);
  const meses = MESES[freq];
  const r = meses ? addMonths(d, k * meses)
    : freq === 'anual' ? addYears(d, k)
    : addDays(d, k * (freq === 'semanal' ? 7 : 14));
  return format(r, 'yyyy-MM-dd');
}

export interface ItemSerie {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_competencia: string;
  status: string;
}

export interface PlanoExtensao {
  freq: Frequencia;
  totalAtual: number;
  totalNovo: number;
  renomear: { id: string; descricao: string }[];
  novos: { descricao: string; data_vencimento: string; data_competencia: string; valor: number }[];
}

export function planejarExtensao(itens: ItemSerie[], quantos: number): PlanoExtensao {
  const ord = [...itens].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  const freq = inferirFrequencia(ord.map((i) => i.data_vencimento));
  const ultimo = ord[ord.length - 1];
  const p = lerParcela(ultimo.descricao);
  const totalAtual = Math.max(p?.total ?? 0, p?.n ?? 0, ord.length);
  const totalNovo = totalAtual + quantos;
  // Dia/âncora: a primeira da série; o índice de cada uma é a posição (n-1).
  const nUltimo = p?.n ?? ord.length;
  const offsetComp = differenceInCalendarDays(parseISO(ultimo.data_competencia), parseISO(ultimo.data_vencimento));
  const ancora = ord.find((i) => (lerParcela(i.descricao)?.n ?? 0) === 1)?.data_vencimento;
  const base = (k: number) => (ancora ? dataNaSerie(ancora, freq, nUltimo - 1 + k) : dataNaSerie(ultimo.data_vencimento, freq, k));

  const renomear = p
    ? ord.map((i) => {
        const pi = lerParcela(i.descricao);
        return pi && pi.total !== totalNovo ? { id: i.id, descricao: comParcela(i.descricao, pi.n, totalNovo) } : null;
      }).filter((x): x is { id: string; descricao: string } => !!x)
    : [];
  const novos = Array.from({ length: quantos }, (_, j) => {
    const venc = base(j + 1);
    return {
      descricao: p ? comParcela(ultimo.descricao, nUltimo + j + 1, totalNovo) : ultimo.descricao,
      data_vencimento: venc,
      data_competencia: format(addDays(parseISO(venc), offsetComp), 'yyyy-MM-dd'),
      valor: Number(ultimo.valor),
    };
  });
  return { freq, totalAtual, totalNovo, renomear, novos };
}

// ---------- Banco ----------

type Tabela = 'receitas' | 'despesas';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface LancamentoBase {
  id: string;
  tabela_origem: string;
  descricao: string;
  recurrence_group_id?: string | null;
  contrato_id?: string | null;
  cliente_id?: string | null;
  fornecedor?: string | null;
}

/** Pode estender? (série solta: nem contrato, nem item/parcela de cartão). */
export function podeEstender(t: LancamentoBase & { fatura_id?: string | null }): boolean {
  if (t.tabela_origem !== 'receitas' && t.tabela_origem !== 'despesas') return false;
  if (t.contrato_id || t.fatura_id) return false;
  if (t.fornecedor === '[fatura]' || t.fornecedor === '[pagamento-fatura]') return false;
  return !!t.recurrence_group_id || !!lerParcela(t.descricao);
}

export async function carregarSerie(t: LancamentoBase): Promise<(ItemSerie & Record<string, unknown>)[]> {
  const tabela = t.tabela_origem as Tabela;
  let q = db.from(tabela).select('*');
  if (t.recurrence_group_id) {
    q = q.eq('recurrence_group_id', t.recurrence_group_id);
  } else {
    const p = lerParcela(t.descricao)!;
    q = q.ilike('descricao', `${p.prefixo.replace(/[%_]/g, '\\$&')}%`);
    if (tabela === 'receitas') q = t.cliente_id ? q.eq('cliente_id', t.cliente_id) : q.is('cliente_id', null);
    else q = t.fornecedor ? q.eq('fornecedor', t.fornecedor) : q.is('fornecedor', null);
  }
  const { data, error } = await q.order('data_vencimento');
  if (error) throw error;
  const alvo = lerParcela(t.descricao);
  return (data || []).filter((r: { descricao: string; contrato_id?: string | null; fatura_id?: string | null; parcela_grupo_id?: string | null }) => {
    if (r.contrato_id || r.fatura_id || r.parcela_grupo_id) return false;
    if (t.recurrence_group_id || !alvo) return true;
    const p = lerParcela(r.descricao);
    return !!p && p.prefixo.toLowerCase() === alvo.prefixo.toLowerCase() && p.total === alvo.total;
  });
}

const COPIAR: Record<Tabela, string[]> = {
  receitas: ['user_id', 'tenant_id', 'cliente_id', 'categoria_id', 'conta_id', 'forma_pagamento', 'empresa_fonte'],
  despesas: ['user_id', 'tenant_id', 'cliente_id', 'fornecedor', 'categoria_id', 'conta_id', 'forma_pagamento', 'empresa_fonte', 'tipo'],
};

export async function estenderSerie(t: LancamentoBase, serie: (ItemSerie & Record<string, unknown>)[], quantos: number) {
  const tabela = t.tabela_origem as Tabela;
  const plano = planejarExtensao(serie, quantos);
  const ultimo = [...serie].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)).at(-1)!;
  const grupo = (t.recurrence_group_id || (ultimo.recurrence_group_id as string | null)) ?? crypto.randomUUID();

  const linhas = plano.novos.map((n) => {
    const l: Record<string, unknown> = { ...n, status: 'pendente', recurrence_group_id: grupo };
    for (const c of COPIAR[tabela]) if (ultimo[c] !== undefined) l[c] = ultimo[c];
    return l;
  });
  const { error } = await db.from(tabela).insert(linhas);
  if (error) throw error;

  for (const r of plano.renomear) {
    await db.from(tabela).update({ descricao: r.descricao, recurrence_group_id: grupo }).eq('id', r.id);
  }
  // Marca a série toda com o mesmo grupo (as próximas extensões ficam exatas).
  const semGrupo = serie.filter((s) => !s.recurrence_group_id && !plano.renomear.some((r) => r.id === s.id)).map((s) => s.id);
  if (semGrupo.length) await db.from(tabela).update({ recurrence_group_id: grupo }).in('id', semGrupo);
  return plano;
}
