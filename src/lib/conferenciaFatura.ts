// Ações do quadro da conferência de fatura: excluir do BALANX o que não está na fatura do
// banco e corrigir valor diferente. Depois recalcula o total da fatura do cartão.
import { supabase } from '@/integrations/supabase/client';
import { recalcularFatura } from '@/hooks/useFaturas';

export async function excluirDaFatura(ids: string[], faturaId?: string): Promise<number> {
  if (!ids.length) return 0;
  const { data, error } = await supabase.from('despesas').delete().in('id', ids).select('id');
  if (error) throw error;
  if (faturaId) await recalcularFatura(faturaId);
  return data?.length ?? 0;
}

export async function corrigirValorNaFatura(id: string, valor: number, faturaId?: string): Promise<void> {
  const { data, error } = await supabase.from('despesas').update({ valor } as never).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('não achei o lançamento');
  if (faturaId) await recalcularFatura(faturaId);
}
