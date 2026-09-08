import { supabase } from '@/integrations/supabase/client';

/**
 * Creates auxiliary transactions for juros/multa and tarifa bancária
 * when settling (paying/receiving) a transaction.
 *
 * When `origem_id` and `origem_tipo` are provided, the auxiliary rows are
 * linked back to the source transaction via origem_receita_id / origem_despesa_id,
 * so they appear in the origin's history.
 */
export async function createAuxiliaryTransactions({
  tipo,
  descricaoOrigem,
  valorJuros,
  valorTarifa,
  data_competencia,
  data_vencimento,
  conta_id,
  cliente_id,
  user_id,
  origem_id,
  origem_tipo,
}: {
  tipo: 'receita' | 'despesa';
  descricaoOrigem: string;
  valorJuros: number;
  valorTarifa: number;
  data_competencia: string;
  data_vencimento: string;
  conta_id?: string;
  cliente_id?: string;
  user_id: string;
  origem_id?: string;
  origem_tipo?: 'receita' | 'despesa';
}) {
  if (valorJuros <= 0 && valorTarifa <= 0) return;

  const linkFields = (() => {
    if (!origem_id || !origem_tipo) return {} as Record<string, string>;
    return origem_tipo === 'receita'
      ? { origem_receita_id: origem_id }
      : { origem_despesa_id: origem_id };
  })();

  const { data: categoriasData } = await supabase
    .from('categorias')
    .select('id, nome, tipo')
    .eq('is_padrao', true)
    .in('nome', ['Juros/Multa', 'Tarifa Bancária']);

  const catJurosReceita = categoriasData?.find(c => c.nome === 'Juros/Multa' && c.tipo === 'receita');
  const catJurosDespesa = categoriasData?.find(c => c.nome === 'Juros/Multa' && c.tipo === 'despesa');
  const catTarifa = categoriasData?.find(c => c.nome === 'Tarifa Bancária' && c.tipo === 'despesa');

  const today = new Date().toISOString().split('T')[0];

  if (tipo === 'receita') {
    if (valorJuros > 0 && catJurosReceita) {
      await supabase.from('receitas').insert({
        user_id,
        descricao: `Juros/Multa - ${descricaoOrigem}`,
        valor: valorJuros,
        categoria_id: catJurosReceita.id,
        conta_id: conta_id || null,
        cliente_id: cliente_id || null,
        data_competencia,
        data_vencimento,
        data_recebimento: today,
        status: 'recebido',
        ...linkFields,
      } as never);
    }
    if (valorTarifa > 0 && catTarifa) {
      await supabase.from('despesas').insert({
        user_id,
        descricao: `Tarifa Bancária - ${descricaoOrigem}`,
        valor: valorTarifa,
        categoria_id: catTarifa.id,
        conta_id: conta_id || null,
        data_competencia,
        data_vencimento,
        data_pagamento: today,
        status: 'pago',
        tipo: 'variavel',
        ...linkFields,
      } as never);
    }
  } else {
    if (valorJuros > 0 && catJurosDespesa) {
      await supabase.from('despesas').insert({
        user_id,
        descricao: `Juros/Multa - ${descricaoOrigem}`,
        valor: valorJuros,
        categoria_id: catJurosDespesa.id,
        conta_id: conta_id || null,
        data_competencia,
        data_vencimento,
        data_pagamento: today,
        status: 'pago',
        tipo: 'variavel',
        ...linkFields,
      } as never);
    }
    if (valorTarifa > 0 && catTarifa) {
      await supabase.from('despesas').insert({
        user_id,
        descricao: `Tarifa Bancária - ${descricaoOrigem}`,
        valor: valorTarifa,
        categoria_id: catTarifa.id,
        conta_id: conta_id || null,
        data_competencia,
        data_vencimento,
        data_pagamento: today,
        status: 'pago',
        tipo: 'variavel',
        ...linkFields,
      } as never);
    }
  }
}
