// Conferência do saldo de uma conta com o extrato do banco.
// Saldo do sistema numa data = saldo inicial + recebidas − pagas ± transferências
// até aquela data (mesma regra do saldo da tela de Contas). A diferença para o
// banco vira uma lista de causas prováveis, da mais para a menos certeira.
import { supabase } from '@/integrations/supabase/client';

export type Tabela = 'receitas' | 'despesas' | 'transferencias';

export interface Movimento {
  id: string;
  tabela: Tabela;
  descricao: string;
  /** Efeito no saldo: + entra, − sai. */
  valor: number;
  data: string;
  status: string;
  conta_id: string | null;
  quem?: string | null;
}

export type TipoCausa = 'exato' | 'combinacao' | 'nao-baixado' | 'sem-conta' | 'duplicado';

export interface Causa {
  tipo: TipoCausa;
  titulo: string;
  detalhe: string;
  itens: Movimento[];
  /** Quanto a diferença muda se a causa for corrigida (mesmo sinal da diferença). */
  efeito: number;
}

const cent = (v: number) => Math.round(v * 100);
const igual = (a: number, b: number) => Math.abs(cent(a) - cent(b)) <= 1;

/** "12.345,67" | "-1.234,5" | "12345.67" | "R$ 10" → número (NaN se inválido). */
export function parseValorBR(txt: string): number {
  let s = String(txt || '').replace(/[R$\s]/g, '').trim();
  if (!s) return NaN;
  const neg = s.startsWith('-') || s.endsWith('-');
  s = s.replace(/-/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  else if (/^\d{1,3}\.\d{3}$/.test(s)) s = s.replace('.', '');
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
}

export function saldoNaData(saldoInicial: number, efetivados: Movimento[], data: string): number {
  return Math.round((saldoInicial + efetivados.filter((m) => m.data <= data).reduce((s, m) => s + m.valor, 0)) * 100) / 100;
}

const base = (d: string) => d.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)/g, '').trim().toLowerCase();
const dias = (a: string, b: string) => Math.abs(new Date(a + 'T12:00:00Z').getTime() - new Date(b + 'T12:00:00Z').getTime()) / 86400000;

/**
 * diferenca = banco − sistema.
 * - naoBaixados: lançamentos em aberto, vencidos até a data, desta conta ou sem conta
 *   (o dinheiro pode ter entrado/saído e ninguém deu baixa).
 * - semConta: efetivados sem conta (podem ter sido desta conta).
 * - daConta: efetivados desta conta (para achar lançamento em dobro).
 */
export function causasProvaveis(diferenca: number, naoBaixados: Movimento[], semConta: Movimento[], daConta: Movimento[]): Causa[] {
  if (igual(diferenca, 0)) return [];
  const causas: Causa[] = [];
  // Só o que mexe na direção da diferença: banco com mais → falta entrada (ou sobra saída) no sistema.
  const ajuda = (m: Movimento) => Math.sign(m.valor) === Math.sign(diferenca);
  const candidatos = [...naoBaixados, ...semConta].filter(ajuda);

  // Lançamento em dobro na conta: some do sistema algo que entrou/saiu uma vez só.
  const duplicados: Movimento[][] = [];
  const vistos = new Set<string>();
  const ordenados = [...daConta].sort((a, b) => a.data.localeCompare(b.data));
  for (let i = 0; i < ordenados.length; i++) {
    const a = ordenados[i];
    if (vistos.has(a.id) || Math.sign(a.valor) !== -Math.sign(diferenca)) continue;
    for (let j = i + 1; j < ordenados.length; j++) {
      const b = ordenados[j];
      if (dias(a.data, b.data) > 3) break;
      if (vistos.has(b.id) || !igual(a.valor, b.valor) || base(a.descricao) !== base(b.descricao) || a.tabela !== b.tabela) continue;
      duplicados.push([a, b]);
      vistos.add(a.id); vistos.add(b.id);
      break;
    }
  }
  const dupCands = duplicados.map(([, b]) => ({ ...b, valor: -b.valor }));

  // 1) Um lançamento só explica a diferença inteira.
  const todos = [...candidatos, ...dupCands];
  for (const m of todos) {
    if (!igual(m.valor, diferenca)) continue;
    const dup = duplicados.find((p) => p[1].id === m.id);
    causas.push({
      tipo: 'exato',
      titulo: 'Bate exatamente com a diferença',
      detalhe: dup ? 'Lançado duas vezes na conta' : motivo(m, naoBaixados),
      itens: dup ?? [m],
      efeito: m.valor,
    });
  }

  // 2) Dois lançamentos somados explicam a diferença.
  if (!causas.length && todos.length <= 80) {
    for (let i = 0; i < todos.length && causas.length < 3; i++) {
      for (let j = i + 1; j < todos.length && causas.length < 3; j++) {
        if (igual(todos[i].valor + todos[j].valor, diferenca)) {
          causas.push({ tipo: 'combinacao', titulo: 'Dois lançamentos somam a diferença', detalhe: 'Confira os dois no extrato.', itens: [todos[i], todos[j]], efeito: diferenca });
        }
      }
    }
  }

  const usados = new Set(causas.flatMap((c) => c.itens.map((i) => i.id)));
  const resto = (l: Movimento[]) => l.filter((m) => ajuda(m) && !usados.has(m.id));
  const soma = (l: Movimento[]) => l.reduce((s, m) => s + m.valor, 0);

  const nb = resto(naoBaixados);
  if (nb.length) {
    causas.push({
      tipo: 'nao-baixado',
      titulo: diferenca > 0 ? 'Recebimentos que podem não ter sido baixados' : 'Pagamentos que podem não ter sido baixados',
      detalhe: 'Venceram até a data do extrato e continuam em aberto no sistema.',
      itens: nb, efeito: soma(nb),
    });
  }
  const sc = resto(semConta);
  if (sc.length) {
    causas.push({
      tipo: 'sem-conta',
      titulo: diferenca > 0 ? 'Recebidos sem conta informada' : 'Pagos sem conta informada',
      detalhe: 'Foram baixados sem conta e não entram no saldo de nenhuma. Se foram desta conta, informe a conta.',
      itens: sc, efeito: soma(sc),
    });
  }
  const dp = duplicados.filter((p) => !usados.has(p[1].id));
  if (dp.length) {
    causas.push({
      tipo: 'duplicado',
      titulo: 'Possíveis lançamentos em dobro',
      detalhe: 'Mesmo valor e descrição, com até 3 dias de distância. Se só aconteceu uma vez, exclua um deles.',
      itens: dp.flat(), efeito: -soma(dp.map((p) => p[1])),
    });
  }
  return causas;
}

function motivo(m: Movimento, naoBaixados: Movimento[]): string {
  if (naoBaixados.some((n) => n.id === m.id)) return m.valor > 0 ? 'Venceu e não foi dado como recebido' : 'Venceu e não foi dado como pago';
  return 'Foi baixado sem conta informada';
}

// ---------- Busca no banco ----------

export interface DadosConferencia {
  saldoInicial: number;
  efetivados: Movimento[];
  naoBaixados: Movimento[];
  semConta: Movimento[];
}

export async function carregarConferencia(contaId: string, data: string): Promise<DadosConferencia> {
  const desde = new Date(new Date(data + 'T12:00:00Z').getTime() - 120 * 86400000).toISOString().slice(0, 10);
  const [conta, rec, desp, trOut, trIn, recAb, despAb, recSc, despSc] = await Promise.all([
    supabase.from('contas').select('saldo_inicial').eq('id', contaId).maybeSingle(),
    supabase.from('receitas').select('id, descricao, valor, data_recebimento, data_vencimento, status, conta_id, clientes(nome)').eq('conta_id', contaId).eq('status', 'recebido'),
    supabase.from('despesas').select('id, descricao, valor, data_pagamento, data_vencimento, status, conta_id, fornecedor').eq('conta_id', contaId).eq('status', 'pago').is('fatura_id', null),
    supabase.from('transferencias').select('id, descricao, valor, data_transferencia').eq('conta_origem_id', contaId),
    supabase.from('transferencias').select('id, descricao, valor, data_transferencia').eq('conta_destino_id', contaId),
    supabase.from('receitas').select('id, descricao, valor, data_vencimento, status, conta_id, clientes(nome)').in('status', ['pendente', 'atrasado'])
      .lte('data_vencimento', data).gte('data_vencimento', desde).or(`conta_id.eq.${contaId},conta_id.is.null`),
    supabase.from('despesas').select('id, descricao, valor, data_vencimento, status, conta_id, fornecedor').in('status', ['pendente', 'atrasado']).is('fatura_id', null)
      .lte('data_vencimento', data).gte('data_vencimento', desde).or(`conta_id.eq.${contaId},conta_id.is.null`),
    supabase.from('receitas').select('id, descricao, valor, data_recebimento, data_vencimento, status, conta_id, clientes(nome)').eq('status', 'recebido').is('conta_id', null)
      .gte('data_vencimento', desde),
    supabase.from('despesas').select('id, descricao, valor, data_pagamento, data_vencimento, status, conta_id, fornecedor').eq('status', 'pago').is('conta_id', null).is('fatura_id', null)
      .gte('data_vencimento', desde),
  ]);
  for (const r of [conta, rec, desp, trOut, trIn, recAb, despAb, recSc, despSc]) if (r.error) throw r.error;

  type Row = Record<string, unknown> & { id: string; descricao: string | null; valor: number | string; status?: string; conta_id?: string | null };
  const cli = (r: Row) => (r.clientes as { nome?: string } | null)?.nome ?? null;
  const ehFatura = (r: Row) => r.fornecedor === '[fatura]';
  const receita = (r: Row, d: unknown): Movimento => ({ id: r.id, tabela: 'receitas', descricao: r.descricao || 'Receita', valor: Number(r.valor), data: String(d), status: String(r.status), conta_id: r.conta_id ?? null, quem: cli(r) });
  const despesa = (r: Row, d: unknown): Movimento => ({ id: r.id, tabela: 'despesas', descricao: r.descricao || 'Despesa', valor: -Number(r.valor), data: String(d), status: String(r.status), conta_id: r.conta_id ?? null, quem: (r.fornecedor as string) || null });
  const transf = (r: Row, sinal: 1 | -1): Movimento => ({ id: r.id, tabela: 'transferencias', descricao: r.descricao || 'Transferência', valor: sinal * Number(r.valor), data: String(r.data_transferencia), status: 'efetivado', conta_id: contaId });

  const efetivados: Movimento[] = [
    ...((rec.data || []) as Row[]).map((r) => receita(r, r.data_recebimento || r.data_vencimento)),
    ...((desp.data || []) as Row[]).map((r) => despesa(r, r.data_pagamento || r.data_vencimento)),
    ...((trOut.data || []) as Row[]).map((r) => transf(r, -1)),
    ...((trIn.data || []) as Row[]).map((r) => transf(r, 1)),
  ];
  const naoBaixados: Movimento[] = [
    ...((recAb.data || []) as Row[]).filter((r) => Number(r.valor) > 0).map((r) => receita(r, r.data_vencimento)),
    ...((despAb.data || []) as Row[]).filter((r) => Number(r.valor) > 0 && !ehFatura(r) && r.fornecedor !== '[pagamento-fatura]').map((r) => despesa(r, r.data_vencimento)),
  ];
  const semConta: Movimento[] = [
    ...((recSc.data || []) as Row[]).filter((r) => Number(r.valor) > 0).map((r) => receita(r, r.data_recebimento || r.data_vencimento)),
    ...((despSc.data || []) as Row[]).filter((r) => Number(r.valor) > 0 && !ehFatura(r)).map((r) => despesa(r, r.data_pagamento || r.data_vencimento)),
  ].filter((m) => m.data <= data);

  return { saldoInicial: Number(conta.data?.saldo_inicial || 0), efetivados, naoBaixados, semConta };
}

export interface ConferenciaSalva { id: string; data: string; saldo_banco: number; saldo_sistema: number; diferenca: number; created_at: string }

export async function salvarConferencia(contaId: string, data: string, saldoBanco: number, saldoSistema: number) {
  const { data: { user } } = await supabase.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('conferencias_saldo').insert({ conta_id: contaId, data, saldo_banco: saldoBanco, saldo_sistema: saldoSistema, user_id: user?.id });
  if (error) throw error;
}

export async function historicoConferencias(contaId: string): Promise<ConferenciaSalva[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from('conferencias_saldo').select('id, data, saldo_banco, saldo_sistema, diferenca, created_at')
    .eq('conta_id', contaId).order('created_at', { ascending: false }).limit(5);
  if (error) return [];
  return (data || []).map((c: ConferenciaSalva) => ({ ...c, saldo_banco: Number(c.saldo_banco), saldo_sistema: Number(c.saldo_sistema), diferenca: Number(c.diferenca) }));
}

/** Lançamento de ajuste (receita ou despesa já efetivada) para o sistema bater com o banco. */
export async function lancarAjuste(contaId: string, data: string, diferenca: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada. Entre de novo.');
  const descricao = 'Ajuste de saldo (conferência com o banco)';
  const valor = Math.abs(Math.round(diferenca * 100) / 100);
  const { error } = diferenca > 0
    ? await supabase.from('receitas').insert({ user_id: user.id, conta_id: contaId, descricao, valor, status: 'recebido', data_vencimento: data, data_competencia: data, data_recebimento: data } as never)
    : await supabase.from('despesas').insert({ user_id: user.id, conta_id: contaId, descricao, valor, status: 'pago', tipo: 'variavel', data_vencimento: data, data_competencia: data, data_pagamento: data } as never);
  if (error) throw error;
}
