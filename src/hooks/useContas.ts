import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type ContaTipo = 'corrente' | 'poupanca' | 'investimento' | 'cartao_credito' | 'cartao_debito';

export interface ContaDB {
  id: string;
  user_id: string;
  nome: string;
  banco: string | null;
  tipo: ContaTipo;
  saldo_inicial: number;
  cor: string;
  ativa: boolean;
  created_at: string;
  updated_at: string;
  saldo_atual?: number;
  // Cartão de crédito
  limite?: number | null;
  dia_fechamento?: number | null;
  dia_vencimento?: number | null;
  vencimento_anchor?: string | null;
  bandeira?: string | null;
  conta_pagamento_padrao_id?: string | null;
}

export interface ContaFormData {
  nome: string;
  banco?: string;
  tipo: ContaTipo;
  saldo_inicial: number;
  cor: string;
  ativa: boolean;
  limite?: number | null;
  dia_fechamento?: number | null;
  dia_vencimento?: number | null;
  vencimento_anchor?: string | null;
  bandeira?: string | null;
  conta_pagamento_padrao_id?: string | null;
}

const calculateAccountBalance = async (
  contaId: string,
  saldoInicial: number,
  tipo: ContaTipo
): Promise<number> => {
  try {
    if (tipo === 'cartao_credito') {
      const { data: faturas } = await supabase
        .from('cartao_faturas' as any)
        .select('valor_total, valor_pago')
        .eq('cartao_id', contaId)
        .neq('status', 'paga');
      const total = (faturas || []).reduce(
        (sum: number, f: any) => sum + (Number(f.valor_total) - Number(f.valor_pago)),
        0
      );
      return -total;
    }

    const [{ data: receitas }, { data: despesas }, { data: transferenciasOut }, { data: transferenciasIn }] = await Promise.all([
      supabase.from('receitas').select('valor').eq('conta_id', contaId).eq('status', 'recebido'),
      supabase.from('despesas').select('valor').eq('conta_id', contaId).eq('status', 'pago').is('fatura_id', null),
      supabase.from('transferencias').select('valor').eq('conta_origem_id', contaId),
      supabase.from('transferencias').select('valor').eq('conta_destino_id', contaId),
    ]);

    const totalReceitas = (receitas || []).reduce((sum, r) => sum + Number(r.valor), 0);
    const totalDespesas = (despesas || []).reduce((sum, d) => sum + Number(d.valor), 0);
    const totalOut = (transferenciasOut || []).reduce((sum, t) => sum + Number(t.valor), 0);
    const totalIn = (transferenciasIn || []).reduce((sum, t) => sum + Number(t.valor), 0);

    return saldoInicial + totalReceitas - totalDespesas - totalOut + totalIn;
  } catch (err) {
    console.error('Error calculating balance:', err);
    return saldoInicial;
  }
};

const fetchContasWithBalances = async (): Promise<ContaDB[]> => {
  const { data, error } = await supabase
    .from('contas')
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw error;

  return Promise.all(
    (data || []).map(async (conta: any) => {
      const saldo = await calculateAccountBalance(conta.id, conta.saldo_inicial, conta.tipo);
      return { ...conta, saldo_atual: saldo } as ContaDB;
    })
  );
};

export function useContas() {
  const queryClient = useQueryClient();

  const { data: contas = [], isLoading, error, refetch } = useQuery({
    queryKey: ['contas'],
    queryFn: fetchContasWithBalances,
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contas'] });

  const createConta = async (formData: ContaFormData): Promise<ContaDB | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('contas')
        .insert({
          user_id: user.id,
          nome: formData.nome,
          banco: formData.banco || null,
          tipo: formData.tipo,
          saldo_inicial: formData.saldo_inicial,
          cor: formData.cor,
          ativa: formData.ativa,
          ...(formData.tipo === 'cartao_credito' && {
            limite: formData.limite ?? null,
            dia_fechamento: formData.dia_fechamento ?? null,
            dia_vencimento: formData.dia_vencimento ?? null,
            vencimento_anchor: formData.vencimento_anchor ?? null,
            bandeira: formData.bandeira ?? null,
            conta_pagamento_padrao_id: formData.conta_pagamento_padrao_id ?? null,
          }),
        } as any)
        .select()
        .single();

      if (error) throw error;

      await invalidate();
      toast({ title: formData.tipo === 'cartao_credito' ? 'Cartão criado com sucesso!' : 'Conta criada com sucesso!' });
      return { ...(data as any), saldo_atual: data.saldo_inicial } as ContaDB;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return null;
    }
  };

  const updateConta = async (id: string, formData: Partial<ContaFormData>): Promise<ContaDB | null> => {
    try {
      // Snapshot prévio para detectar mudança nos campos do cartão
      const { data: anterior } = await supabase
        .from('contas')
        .select('tipo, dia_fechamento, dia_vencimento, vencimento_anchor')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('contas')
        .update({
          nome: formData.nome,
          banco: formData.banco || null,
          tipo: formData.tipo,
          saldo_inicial: formData.saldo_inicial,
          cor: formData.cor,
          ativa: formData.ativa,
          limite: formData.limite ?? null,
          dia_fechamento: formData.dia_fechamento ?? null,
          dia_vencimento: formData.dia_vencimento ?? null,
          vencimento_anchor: formData.vencimento_anchor ?? null,
          bandeira: formData.bandeira ?? null,
          conta_pagamento_padrao_id: formData.conta_pagamento_padrao_id ?? null,
        } as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const atualizadoTipo = (data as any).tipo as ContaTipo;
      const cicloMudou =
        atualizadoTipo === 'cartao_credito' &&
        anterior &&
        (
          (anterior as any).dia_fechamento !== (data as any).dia_fechamento ||
          (anterior as any).dia_vencimento !== (data as any).dia_vencimento ||
          (anterior as any).vencimento_anchor !== (data as any).vencimento_anchor
        );

      if (cicloMudou) {
        const { recalcularDatasFaturasAbertas } = await import('./useFaturas');
        await recalcularDatasFaturasAbertas(data as unknown as ContaDB);
        queryClient.invalidateQueries({ queryKey: ['cartao-faturas'] });
        queryClient.invalidateQueries({ queryKey: ['fluxo-caixa'] });
        queryClient.invalidateQueries({ queryKey: ['calendario'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }

      await invalidate();
      toast({ title: 'Atualizado com sucesso!' });
      const saldo = await calculateAccountBalance(data.id, data.saldo_inicial, atualizadoTipo);
      return { ...(data as any), saldo_atual: saldo } as ContaDB;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar conta';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return null;
    }
  };

  const countContaLinks = async (id: string) => {
    const [receitas, despesas, transfOut, transfIn] = await Promise.all([
      supabase.from('receitas').select('id', { count: 'exact', head: true }).eq('conta_id', id),
      supabase.from('despesas').select('id', { count: 'exact', head: true }).eq('conta_id', id),
      supabase.from('transferencias').select('id', { count: 'exact', head: true }).eq('conta_origem_id', id),
      supabase.from('transferencias').select('id', { count: 'exact', head: true }).eq('conta_destino_id', id),
    ]);
    return {
      receitas: receitas.count || 0,
      despesas: despesas.count || 0,
      transferencias: (transfOut.count || 0) + (transfIn.count || 0),
    };
  };

  const deleteConta = async (id: string): Promise<boolean> => {
    try {
      const links = await countContaLinks(id);

      if (links.transferencias > 0) {
        toast({
          title: 'Não é possível excluir',
          description: `Esta conta possui ${links.transferencias} transferência(s) vinculada(s). Exclua ou edite as transferências antes.`,
          variant: 'destructive',
        });
        return false;
      }

      // Desvincular receitas/despesas (manter histórico, sem conta)
      if (links.receitas > 0) {
        const { error: rErr } = await supabase.from('receitas').update({ conta_id: null }).eq('conta_id', id);
        if (rErr) throw rErr;
      }
      if (links.despesas > 0) {
        const { error: dErr } = await supabase.from('despesas').update({ conta_id: null }).eq('conta_id', id);
        if (dErr) throw dErr;
      }

      // Limpar referências de conta_pagamento_padrao em cartões
      await supabase.from('contas').update({ conta_pagamento_padrao_id: null } as any).eq('conta_pagamento_padrao_id', id);

      const { error } = await supabase.from('contas').delete().eq('id', id);
      if (error) throw error;

      await invalidate();
      queryClient.invalidateQueries({ queryKey: ['fluxo-caixa'] });
      queryClient.invalidateQueries({ queryKey: ['receitas'] });
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['calendario'] });

      const desvinculados = links.receitas + links.despesas;
      toast({
        title: 'Conta excluída!',
        description: desvinculados > 0 ? `${desvinculados} lançamento(s) desvinculado(s).` : undefined,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  /**
   * Exclui um cartão de crédito e TODOS os lançamentos vinculados:
   *  - cartao_fatura_pagamentos das faturas
   *  - despesas com fatura_id em (...) (lançamentos individuais)
   *  - despesas-sombra (fornecedor='[fatura]') ligadas via despesa_id
   *  - cartao_faturas do cartão
   *  - despesas de pagamento ('[pagamento-fatura]') com conta_id = cartaoId
   *  - despesas remanescentes com conta_id = cartaoId
   *  - a conta (cartão) em si
   */
  const deleteCartao = async (cartaoId: string): Promise<boolean> => {
    try {
      const { data: faturas, error: fErr } = await supabase
        .from('cartao_faturas' as any)
        .select('id, despesa_id')
        .eq('cartao_id', cartaoId);
      if (fErr) throw fErr;

      const faturaIds = (faturas || []).map((f: any) => f.id);
      const despesaSombraIds = (faturas || []).map((f: any) => f.despesa_id).filter(Boolean);

      if (faturaIds.length > 0) {
        await supabase.from('cartao_fatura_pagamentos' as any).delete().in('fatura_id', faturaIds);
        await supabase.from('despesas').delete().in('fatura_id', faturaIds);
        await supabase.from('cartao_faturas' as any).delete().in('id', faturaIds);
      }
      if (despesaSombraIds.length > 0) {
        await supabase.from('despesas').delete().in('id', despesaSombraIds);
      }
      // Pagamentos de fatura e quaisquer despesas remanescentes vinculadas ao cartão
      await supabase.from('despesas').delete().eq('conta_id', cartaoId);

      const { error: cErr } = await supabase.from('contas').delete().eq('id', cartaoId);
      if (cErr) throw cErr;

      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['cartao-faturas'] });
      queryClient.invalidateQueries({ queryKey: ['fluxo-caixa'] });
      queryClient.invalidateQueries({ queryKey: ['calendario'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Cartão e lançamentos excluídos!' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir cartão';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  const getActiveContas = useCallback(() => contas.filter(c => c.ativa), [contas]);
  const getBankAccounts = useCallback(() => contas.filter(c => c.tipo !== 'cartao_credito'), [contas]);
  const getCreditCards = useCallback(() => contas.filter(c => c.tipo === 'cartao_credito'), [contas]);
  const getTotalBalance = useCallback(
    () => contas.filter(c => c.tipo !== 'cartao_credito').reduce((sum, c) => sum + (c.saldo_atual || 0), 0),
    [contas]
  );

  return {
    contas,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    createConta,
    updateConta,
    deleteConta,
    countContaLinks,
    deleteCartao,
    getActiveContas,
    getBankAccounts,
    getCreditCards,
    getTotalBalance,
  };
}

/**
 * Returns a map { 'YYYY-MM-DD' -> closing balance } for a given bank account,
 * considering ONLY effectivated transactions (recebido / pago / transferencias)
 * up to and including each date. Useful to render a bank-statement-style running
 * balance in the cash flow table.
 */
export function useAccountRunningBalance(contaId: string | null) {
  return useQuery({
    queryKey: ['account-running-balance', contaId],
    enabled: !!contaId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!contaId) return { byDate: new Map<string, number>(), saldoInicial: 0 };

      const { data: conta } = await supabase
        .from('contas')
        .select('saldo_inicial, tipo')
        .eq('id', contaId)
        .maybeSingle();

      const saldoInicial = Number(conta?.saldo_inicial || 0);

      const [{ data: receitas }, { data: despesas }, { data: trOut }, { data: trIn }] = await Promise.all([
        supabase.from('receitas').select('valor, data_recebimento').eq('conta_id', contaId).eq('status', 'recebido').not('data_recebimento', 'is', null),
        supabase.from('despesas').select('valor, data_pagamento').eq('conta_id', contaId).eq('status', 'pago').is('fatura_id', null).not('data_pagamento', 'is', null),
        supabase.from('transferencias').select('valor, data_transferencia').eq('conta_origem_id', contaId),
        supabase.from('transferencias').select('valor, data_transferencia').eq('conta_destino_id', contaId),
      ]);

      // Aggregate deltas per date
      const deltaByDate = new Map<string, number>();
      const add = (date: string | null, value: number) => {
        if (!date) return;
        deltaByDate.set(date, (deltaByDate.get(date) || 0) + value);
      };
      (receitas || []).forEach(r => add(r.data_recebimento, Number(r.valor)));
      (despesas || []).forEach(d => add(d.data_pagamento, -Number(d.valor)));
      (trOut || []).forEach(t => add(t.data_transferencia, -Number(t.valor)));
      (trIn || []).forEach(t => add(t.data_transferencia, Number(t.valor)));

      // Build closing-balance map (sorted ascending)
      const sortedDates = Array.from(deltaByDate.keys()).sort();
      const byDate = new Map<string, number>();
      let running = saldoInicial;
      for (const d of sortedDates) {
        running += deltaByDate.get(d)!;
        byDate.set(d, running);
      }

      return { byDate, saldoInicial, sortedDates };
    },
  });
}
