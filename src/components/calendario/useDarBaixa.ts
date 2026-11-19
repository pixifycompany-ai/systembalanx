// Baixa rápida (recebido/pago) de um lançamento do calendário.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { DayItem } from '@/hooks/useCalendario';

// Caches derivados que dependem de receitas/despesas — invalidar após a baixa
// para saldo/calendário/relatórios atualizarem na hora.
const DERIVED_KEYS = ['calendario', 'dashboard', 'fluxo-caixa', 'contas', 'account-running-balance', 'analises', 'relatorios', 'cartao-faturas'];

export const isPendente = (status: string) => status === 'pendente' || status === 'atrasado';

export function useDarBaixa() {
  const queryClient = useQueryClient();
  const [processando, setProcessando] = useState<Set<string>>(new Set());

  /** Data da baixa = o próprio dia do lançamento (o vencimento exibido no calendário). */
  const darBaixa = async (item: DayItem, data: string) => {
    setProcessando((prev) => new Set(prev).add(item.id));
    try {
      const { error } = item.tipo === 'receita'
        ? await supabase.from('receitas').update({ status: 'recebido', data_recebimento: data }).eq('id', item.id)
        : await supabase.from('despesas').update({ status: 'pago', data_pagamento: data }).eq('id', item.id);
      if (error) throw error;
      DERIVED_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast({ title: item.tipo === 'receita' ? 'Recebimento confirmado!' : 'Pagamento confirmado!' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao dar baixa';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setProcessando((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  return { darBaixa, processando };
}
