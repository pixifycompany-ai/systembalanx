// Unified Transaction Types for Cash Flow

export interface TransacaoUnificada {
  id: string;
  tipo: 'entrada' | 'saida';
  tabela_origem: 'receitas' | 'despesas' | 'transferencia';
  descricao: string;
  valor: number;
  data_competencia: string;
  data_vencimento: string;
  data_efetivacao: string | null; // data_recebimento ou data_pagamento
  status: string;
  status_display: string;
  categoria_id: string | null;
  categoria?: { id: string; nome: string; cor: string } | null;
  
  // Campos específicos de receitas
  cliente_id?: string | null;
  cliente?: { id: string; nome: string; empresa_fonte?: string | null } | null;
  forma_pagamento?: string | null;
  contrato_id?: string | null;
  
  // Campos específicos de despesas
  fornecedor?: string | null;
  tipo_despesa?: 'fixa' | 'variavel';
  
  // Campo comum
  conta_id?: string | null;
  recurrence_group_id?: string | null;

  // Campos específicos de transferência (ambas as pernas compartilham o mesmo id da transferencia)
  conta_destino_id?: string | null;
  conta_destino?: { id: string; nome: string; cor: string } | null;
  conta_origem?: { id: string; nome: string; cor: string } | null;
}

export type TipoTransacao = 'todas' | 'entrada' | 'saida';

export const STATUS_UNIFICADO = {
  pendente: { label: 'Pendente', variant: 'warning' as const },
  recebido: { label: 'Recebido', variant: 'success' as const },
  pago: { label: 'Pago', variant: 'success' as const },
  atrasado: { label: 'Atrasado', variant: 'destructive' as const },
  transferido: { label: 'Transferido', variant: 'secondary' as const },
} as const;

export const TIPO_TRANSACAO_OPTIONS = [
  { value: 'todas', label: 'Todas' },
  { value: 'entrada', label: 'Entradas' },
  { value: 'saida', label: 'Saídas' },
] as const;

// Map unified status for filtering
export const getUnifiedStatusOptions = (tipoFilter: TipoTransacao) => {
  const options = [
    { value: 'pendente', label: 'Pendente' },
    { value: 'atrasado', label: 'Atrasado' },
  ];
  
  if (tipoFilter === 'entrada') {
    options.push({ value: 'recebido', label: 'Recebido' });
  } else if (tipoFilter === 'saida') {
    options.push({ value: 'pago', label: 'Pago' });
  } else {
    options.push({ value: 'efetivado', label: 'Efetivado' }); // recebido + pago
  }
  
  return options;
};
