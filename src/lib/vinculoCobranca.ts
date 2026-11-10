import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

/** Uma opção no seletor de vínculo (cobrança para um lançamento, ou lançamento para uma cobrança). */
export interface OpcaoVinculo {
  id: string;
  titulo: string;
  cliente: string | null;
  valor: number;
  data: string;
  status: string;
  /** Já ligada a outro lançamento/cobrança: escolher move o vínculo para cá. */
  ocupada: boolean;
  mesmoCliente: boolean;
}

export interface CobrancaVinculada { id: string; descricao: string | null; valor: number; vencimento: string; status: string }

// cobrancas ainda não está nos tipos gerados
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const JANELA_DIAS = 120;

interface LinhaCobranca { id: string; descricao: string | null; valor: number | string; vencimento: string; status: string; receita_id: string | null; cliente_id: string | null; cliente: { nome: string } | null }
interface LinhaReceita { id: string; descricao: string; valor: number | string; data_vencimento: string; status: string; cliente_id: string | null; cliente: { nome: string } | null }

async function invocar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('asaas-cobranca', { body });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      const b = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
      if (b?.error) msg = b.error;
    } catch { /* mantém msg */ }
    throw new Error(msg);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error);
  return data as { anteriorApagado?: boolean; outrasSoltas?: number };
}

export const vincularCobrancaReceita = (cobranca_id: string, receita_id: string) =>
  invocar({ action: 'vincular-receita', cobranca_id, receita_id });
export const desvincularCobranca = (cobranca_id: string) =>
  invocar({ action: 'desvincular-receita', cobranca_id });

export async function cobrancaDaReceita(receitaId: string): Promise<CobrancaVinculada | null> {
  const { data } = await db.from('cobrancas').select('id, descricao, valor, vencimento, status')
    .eq('receita_id', receitaId).not('status', 'in', '(cancelado,estornado)').limit(1).maybeSingle();
  return data ? { ...data, valor: Number(data.valor) } : null;
}

// Mesmo cliente primeiro, depois livres, mesmo valor e data mais perto.
function ordenar(ops: OpcaoVinculo[], valor: number, data: string) {
  const nota = (o: OpcaoVinculo) =>
    (o.mesmoCliente ? 1000 : 0) + (o.ocupada ? 0 : 100) + (Math.abs(o.valor - valor) < 0.01 ? 50 : 0)
    - Math.min(Math.abs(differenceInCalendarDays(parseISO(o.data), parseISO(data))), 49);
  return ops.sort((a, b) => nota(b) - nota(a));
}

const janela = (data: string) => {
  const d = parseISO(data);
  return [format(addDays(d, -JANELA_DIAS), 'yyyy-MM-dd'), format(addDays(d, JANELA_DIAS), 'yyyy-MM-dd')];
};

/** Cobranças que podem ser ligadas a um lançamento (receita). */
export async function opcoesCobrancas(r: { id: string; cliente_id?: string | null; valor: number; data_vencimento: string }): Promise<OpcaoVinculo[]> {
  const [de, ate] = janela(r.data_vencimento);
  const { data } = await db.from('cobrancas')
    .select('id, descricao, valor, vencimento, status, receita_id, cliente_id, cliente:clientes(nome)')
    .not('status', 'in', '(cancelado,estornado)').gte('vencimento', de).lte('vencimento', ate).limit(400);
  const ops = ((data || []) as LinhaCobranca[])
    .filter((c) => c.receita_id !== r.id)
    .map((c): OpcaoVinculo => ({
      id: c.id, titulo: c.descricao || 'Cobrança', cliente: c.cliente?.nome ?? null, valor: Number(c.valor),
      data: c.vencimento, status: c.status, ocupada: !!c.receita_id, mesmoCliente: !!r.cliente_id && c.cliente_id === r.cliente_id,
    }));
  return ordenar(ops, Number(r.valor), r.data_vencimento);
}

/** Lançamentos (receitas) que podem ser ligados a uma cobrança. */
export async function opcoesReceitas(c: { id: string; cliente_id?: string | null; valor: number; vencimento: string; receita_id?: string | null }): Promise<OpcaoVinculo[]> {
  const [de, ate] = janela(c.vencimento);
  const [{ data: recs }, { data: ligadas }] = await Promise.all([
    supabase.from('receitas').select('id, descricao, valor, data_vencimento, status, cliente_id, cliente:clientes(nome)')
      .gte('data_vencimento', de).lte('data_vencimento', ate).limit(600),
    db.from('cobrancas').select('id, receita_id').not('receita_id', 'is', null).not('status', 'in', '(cancelado,estornado)'),
  ]);
  const dono = new Map<string, string>(((ligadas || []) as { id: string; receita_id: string }[]).map((l) => [l.receita_id, l.id]));
  const ops = ((recs || []) as unknown as LinhaReceita[])
    .filter((r) => r.id !== c.receita_id)
    .map((r): OpcaoVinculo => ({
      id: r.id, titulo: r.descricao, cliente: r.cliente?.nome ?? null, valor: Number(r.valor),
      data: r.data_vencimento, status: r.status, ocupada: !!dono.get(r.id) && dono.get(r.id) !== c.id,
      mesmoCliente: !!c.cliente_id && r.cliente_id === c.cliente_id,
    }));
  return ordenar(ops, Number(c.valor), c.vencimento);
}
