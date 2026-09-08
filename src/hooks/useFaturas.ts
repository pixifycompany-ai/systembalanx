import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  calcularCompetenciaFatura,
  calcularDatasFatura,
  calcularDatasFaturaComAnchor,
  rotuloCompetencia,
  toISODate,
} from '@/utils/faturaCalculator';
import type { ContaDB } from './useContas';

export type FaturaStatus = 'aberta' | 'fechada' | 'paga' | 'parcialmente_paga';

export interface FaturaDB {
  id: string;
  user_id: string;
  cartao_id: string;
  competencia: string;
  data_fechamento: string;
  data_vencimento: string;
  status: FaturaStatus;
  despesa_id: string | null;
  valor_total: number;
  valor_pago: number;
  created_at: string;
  updated_at: string;
}

export interface FaturaPagamentoDB {
  id: string;
  user_id: string;
  fatura_id: string;
  conta_id: string;
  valor: number;
  data_pagamento: string;
  despesa_id: string | null;
  created_at: string;
}

const INVALIDATE = ['contas', 'cartao-faturas', 'fluxo-caixa', 'dashboard', 'calendario'];

/**
 * Garante que a despesa-fatura (despesa "a pagar" do mês) exista e esteja
 * com o valor/data corretos. Retorna o id da despesa.
 */
async function syncDespesaFatura(
  fatura: FaturaDB,
  cartao: ContaDB,
  userId: string
): Promise<string | null> {
  const restante = Number(fatura.valor_total) - Number(fatura.valor_pago);
  const descricao = `Fatura ${cartao.nome} – ${rotuloCompetencia(fatura.competencia)}`;
  const status: 'pendente' | 'pago' = restante <= 0 ? 'pago' : 'pendente';

  if (fatura.despesa_id) {
    const { error } = await supabase
      .from('despesas')
      .update({
        descricao,
        valor: Math.max(restante, 0),
        data_vencimento: fatura.data_vencimento,
        data_competencia: fatura.competencia,
        status,
        fornecedor: '[fatura]',
        tipo: 'fixa',
      })
      .eq('id', fatura.despesa_id);
    if (error) console.error('updateDespesaFatura', error);
    return fatura.despesa_id;
  }

  if (restante <= 0) return null;

  const { data, error } = await supabase
    .from('despesas')
    .insert({
      user_id: userId,
      descricao,
      valor: restante,
      data_vencimento: fatura.data_vencimento,
      data_competencia: fatura.competencia,
      status: 'pendente',
      tipo: 'fixa',
      fornecedor: '[fatura]',
      conta_id: null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('createDespesaFatura', error);
    return null;
  }

  await supabase
    .from('cartao_faturas' as any)
    .update({ despesa_id: data.id })
    .eq('id', fatura.id);

  return data.id;
}

/**
 * Encontra/cria a fatura de um cartão para uma COMPETÊNCIA (mês) específica.
 * Base do parcelamento: cada parcela cai na fatura do seu mês.
 */
export async function ensureFaturaForCompetencia(
  cartao: ContaDB,
  competencia: Date,
  userId: string
): Promise<FaturaDB | null> {
  if (
    cartao.tipo !== 'cartao_credito' ||
    !cartao.dia_fechamento ||
    !cartao.dia_vencimento
  ) {
    return null;
  }

  const anchorStr = (cartao as any).vencimento_anchor as string | null | undefined;
  const { data_fechamento, data_vencimento } = anchorStr
    ? calcularDatasFaturaComAnchor(
        competencia,
        cartao.dia_fechamento,
        new Date(`${anchorStr}T00:00:00`)
      )
    : calcularDatasFatura(
        competencia,
        cartao.dia_fechamento,
        cartao.dia_vencimento
      );
  const competenciaISO = toISODate(competencia);

  // Buscar existente
  const { data: existente } = await supabase
    .from('cartao_faturas' as any)
    .select('*')
    .eq('cartao_id', cartao.id)
    .eq('competencia', competenciaISO)
    .maybeSingle();

  if (existente) return existente as unknown as FaturaDB;

  const { data: nova, error } = await supabase
    .from('cartao_faturas' as any)
    .insert({
      user_id: userId,
      cartao_id: cartao.id,
      competencia: competenciaISO,
      data_fechamento: toISODate(data_fechamento),
      data_vencimento: toISODate(data_vencimento),
      status: 'aberta',
      valor_total: 0,
      valor_pago: 0,
    })
    .select('*')
    .single();

  if (error) {
    console.error('ensureFatura', error);
    return null;
  }

  return nova as unknown as FaturaDB;
}

/**
 * Encontra/cria a fatura de uma compra ÚNICA no cartão, derivando a
 * competência a partir da data da compra (regra do dia de fechamento).
 */
export async function ensureFaturaForLancamento(
  cartao: ContaDB,
  dataCompra: string,
  userId: string
): Promise<FaturaDB | null> {
  if (
    cartao.tipo !== 'cartao_credito' ||
    !cartao.dia_fechamento ||
    !cartao.dia_vencimento
  ) {
    return null;
  }
  const competencia = calcularCompetenciaFatura(dataCompra, cartao.dia_fechamento);
  return ensureFaturaForCompetencia(cartao, competencia, userId);
}

/**
 * Recalcula valor_total da fatura (soma das despesas com fatura_id) e
 * sincroniza a despesa-fatura.
 */
export async function recalcularFatura(faturaId: string): Promise<void> {
  const { data: fatura } = await supabase
    .from('cartao_faturas' as any)
    .select('*')
    .eq('id', faturaId)
    .single();
  if (!fatura) return;

  const { data: lancamentos } = await supabase
    .from('despesas')
    .select('valor')
    .eq('fatura_id', faturaId);

  const total = (lancamentos || []).reduce(
    (sum, l: any) => sum + Number(l.valor),
    0
  );

  const valor_pago = Number((fatura as any).valor_pago);
  let novoStatus: FaturaStatus = (fatura as any).status;
  if (total > 0 && valor_pago >= total) novoStatus = 'paga';
  else if (valor_pago > 0 && valor_pago < total) novoStatus = 'parcialmente_paga';
  else novoStatus = 'aberta';

  await supabase
    .from('cartao_faturas' as any)
    .update({ valor_total: total, status: novoStatus })
    .eq('id', faturaId);

  const { data: atualizada } = await supabase
    .from('cartao_faturas' as any)
    .select('*')
    .eq('id', faturaId)
    .single();

  const { data: cartao } = await supabase
    .from('contas')
    .select('*')
    .eq('id', (fatura as any).cartao_id)
    .single();

  if (atualizada && cartao) {
    await syncDespesaFatura(
      atualizada as unknown as FaturaDB,
      cartao as unknown as ContaDB,
      (fatura as any).user_id
    );
  }
}

/**
 * Recalcula data_fechamento e data_vencimento das faturas em aberto
 * (status <> 'paga') após mudança nos parâmetros do cartão (dia_fechamento,
 * dia_vencimento ou vencimento_anchor). Atualiza também a despesa-fatura
 * vinculada (data_vencimento e data_competencia) para refletir o novo mês
 * em contas a pagar/fluxo de caixa/calendário.
 */
export async function recalcularDatasFaturasAbertas(cartao: ContaDB): Promise<void> {
  if (cartao.tipo !== 'cartao_credito' || !cartao.dia_fechamento) return;

  const { data: faturas, error } = await supabase
    .from('cartao_faturas' as any)
    .select('id, competencia, despesa_id, status')
    .eq('cartao_id', cartao.id)
    .neq('status', 'paga');
  if (error) {
    console.error('recalcularDatasFaturasAbertas', error);
    return;
  }

  const anchorStr = cartao.vencimento_anchor;
  const anchor = anchorStr ? new Date(`${anchorStr}T00:00:00`) : null;

  for (const f of (faturas || []) as any[]) {
    const competencia = new Date(`${f.competencia}T00:00:00`);
    const { data_fechamento, data_vencimento } = anchor
      ? calcularDatasFaturaComAnchor(competencia, cartao.dia_fechamento, anchor)
      : calcularDatasFatura(competencia, cartao.dia_fechamento, cartao.dia_vencimento ?? anchor!.getDate());

    const novoFechamento = toISODate(data_fechamento);
    const novoVencimento = toISODate(data_vencimento);
    const novaCompetencia = toISODate(competencia);

    await supabase
      .from('cartao_faturas' as any)
      .update({ data_fechamento: novoFechamento, data_vencimento: novoVencimento })
      .eq('id', f.id);

    if (f.despesa_id) {
      await supabase
        .from('despesas')
        .update({ data_vencimento: novoVencimento, data_competencia: novaCompetencia })
        .eq('id', f.despesa_id);
    }
  }
}

export function useFaturas(cartaoId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [faturas, setFaturas] = useState<FaturaDB[]>([]);
  const [pagamentos, setPagamentos] = useState<FaturaPagamentoDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const invalidate = useCallback(() => {
    INVALIDATE.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
  }, [queryClient]);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      let q = supabase
        .from('cartao_faturas' as any)
        .select('*')
        .order('competencia', { ascending: false });
      if (cartaoId) q = q.eq('cartao_id', cartaoId);
      const { data: faturasData, error } = await q;
      if (error) throw error;
      setFaturas((faturasData || []) as unknown as FaturaDB[]);

      const { data: pagData } = await supabase
        .from('cartao_fatura_pagamentos' as any)
        .select('*')
        .order('data_pagamento', { ascending: false });
      setPagamentos((pagData || []) as unknown as FaturaPagamentoDB[]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, cartaoId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`faturas-rt-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cartao_faturas', filter: `user_id=eq.${user.id}` }, () => {
        fetch();
        invalidate();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cartao_fatura_pagamentos', filter: `user_id=eq.${user.id}` }, () => {
        fetch();
        invalidate();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, fetch, invalidate]);

  /**
   * Paga uma fatura usando 1+ contas (linhas).
   */
  const pagarFatura = async (
    fatura: FaturaDB,
    cartao: ContaDB,
    linhas: { conta_id: string; valor: number; data_pagamento: string }[]
  ): Promise<boolean> => {
    if (!user?.id) return false;
    const totalLinhas = linhas.reduce((s, l) => s + Number(l.valor), 0);
    const restante = Number(fatura.valor_total) - Number(fatura.valor_pago);
    if (totalLinhas <= 0) {
      toast({ title: 'Informe ao menos um pagamento', variant: 'destructive' });
      return false;
    }
    if (totalLinhas > restante + 0.001) {
      toast({ title: 'Valor maior que o saldo da fatura', variant: 'destructive' });
      return false;
    }

    try {
      for (const linha of linhas) {
        // 1. Cria despesa real na conta corrente
        const { data: despesa, error: dErr } = await supabase
          .from('despesas')
          .insert({
            user_id: user.id,
            descricao: `Pagamento Fatura ${cartao.nome} – ${rotuloCompetencia(fatura.competencia)}`,
            valor: Number(linha.valor),
            data_competencia: linha.data_pagamento,
            data_vencimento: linha.data_pagamento,
            data_pagamento: linha.data_pagamento,
            status: 'pago',
            tipo: 'variavel',
            conta_id: linha.conta_id,
            fornecedor: '[pagamento-fatura]',
          })
          .select('id')
          .single();
        if (dErr) throw dErr;

        // 2. Registra pagamento
        const { error: pErr } = await supabase
          .from('cartao_fatura_pagamentos' as any)
          .insert({
            user_id: user.id,
            fatura_id: fatura.id,
            conta_id: linha.conta_id,
            valor: Number(linha.valor),
            data_pagamento: linha.data_pagamento,
            despesa_id: despesa?.id ?? null,
          });
        if (pErr) throw pErr;
      }

      // 3. Atualiza fatura: valor_pago e status
      const novoPago = Number(fatura.valor_pago) + totalLinhas;
      const novoStatus: FaturaStatus =
        novoPago >= Number(fatura.valor_total) - 0.001 ? 'paga' : 'parcialmente_paga';
      await supabase
        .from('cartao_faturas' as any)
        .update({ valor_pago: novoPago, status: novoStatus })
        .eq('id', fatura.id);

      // 4. Sync despesa-fatura
      const { data: faturaAtualizada } = await supabase
        .from('cartao_faturas' as any)
        .select('*')
        .eq('id', fatura.id)
        .single();
      if (faturaAtualizada) {
        await syncDespesaFatura(faturaAtualizada as unknown as FaturaDB, cartao, user.id);
      }

      toast({ title: 'Fatura paga com sucesso!' });
      invalidate();
      fetch();
      return true;
    } catch (e: any) {
      toast({ title: 'Erro ao pagar fatura', description: e.message, variant: 'destructive' });
      return false;
    }
  };

  return { faturas, pagamentos, isLoading, refetch: fetch, pagarFatura };
}
