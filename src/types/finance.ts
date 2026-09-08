// Pixify Company - Financial Types

export interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf_cnpj: string;
  tipo: 'PF' | 'PJ';
  endereco?: string;
  observacoes?: string;
  status: 'ativo' | 'inativo' | 'suspenso';
  created_at?: string;
  updated_at?: string;
}

export interface CategoriaReceita {
  id: string;
  nome: string;
  cor: string;
}

export interface CategoriaDespesa {
  id: string;
  nome: string;
  cor: string;
}

export interface Receita {
  id: string;
  cliente_id: string;
  cliente?: Cliente;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_vencimento: string;
  data_recebimento?: string;
  status: 'pendente' | 'recebido' | 'atrasado' | 'cancelado';
  forma_pagamento?: 'PIX' | 'Boleto' | 'Cartão' | 'Transferência' | 'Dinheiro';
  categoria_id?: string;
  categoria?: CategoriaReceita;
  created_at?: string;
  updated_at?: string;
}

export interface Despesa {
  id: string;
  categoria_id: string;
  categoria?: CategoriaDespesa;
  fornecedor: string;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_vencimento?: string;
  data_pagamento?: string;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  tipo: 'fixa' | 'variavel' | 'investimento';
  forma_pagamento?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Contrato {
  id: string;
  cliente_id: string;
  cliente?: Cliente;
  numero_contrato: string;
  descricao?: string;
  tipo: 'recorrente' | 'projeto' | 'avulso';
  valor_mensal: number;
  valor_total: number;
  data_inicio: string;
  data_fim?: string;
  dia_vencimento?: number;
  status: 'ativo' | 'cancelado' | 'encerrado';
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Servico {
  id: string;
  nome: string;
  descricao?: string;
  valor_base: number;
  tipo_cobranca: 'mensal' | 'projeto' | 'hora';
}

export interface Meta {
  id: string;
  tipo: 'faturamento' | 'lucro' | 'clientes';
  periodo: string;
  valor_meta: number;
  valor_realizado: number;
}

// Dashboard Types
export interface DashboardResumo {
  caixa_total: number;
  faturamento_mes: number;
  despesas_mes: number;
  lucro_mensal: number;
  lucro_mensal_percentual: string;
  receitas_pendentes: number;
  despesas_pendentes: number;
  receita_anual_projetada: number;
}

export interface MetaFaturamento {
  valor_meta: number;
  valor_realizado: number;
  percentual_atingido: number;
}

export interface MRRHistorico {
  mes: string;
  valor: number;
}

export interface FaturamentoVsDespesas {
  mes: string;
  receita: number;
  despesa: number;
}

export interface TopCliente {
  cliente: string;
  cliente_id: string;
  receita_total: number;
}

export interface DashboardData {
  resumo: DashboardResumo;
  meta_faturamento: MetaFaturamento;
  mrr: {
    historico: MRRHistorico[];
    projecao: MRRHistorico[];
  };
  faturamento_vs_despesas: FaturamentoVsDespesas[];
  top_clientes: TopCliente[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// Form Types
export type ReceitaFormData = Omit<Receita, 'id' | 'cliente' | 'categoria' | 'created_at' | 'updated_at'>;
export type DespesaFormData = Omit<Despesa, 'id' | 'categoria' | 'created_at' | 'updated_at'>;
export type ClienteFormData = Omit<Cliente, 'id' | 'created_at' | 'updated_at'>;
export type ContratoFormData = Omit<Contrato, 'id' | 'cliente' | 'created_at' | 'updated_at'>;

// Status Options
export const RECEITA_STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'atrasado', label: 'Atrasado' },
  { value: 'cancelado', label: 'Cancelado' },
] as const;

export const DESPESA_STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
  { value: 'atrasado', label: 'Atrasado' },
  { value: 'cancelado', label: 'Cancelado' },
] as const;

export const FORMA_PAGAMENTO_OPTIONS = [
  { value: 'PIX', label: 'PIX' },
  { value: 'Boleto', label: 'Boleto' },
  { value: 'Cartão Débito', label: 'Cartão Débito' },
  { value: 'Cartão Crédito', label: 'Cartão Crédito' },
  { value: 'Transferência', label: 'Transferência' },
  { value: 'Dinheiro', label: 'Dinheiro' },
] as const;

export const CLIENTE_TIPO_OPTIONS = [
  { value: 'PF', label: 'Pessoa Física' },
  { value: 'PJ', label: 'Pessoa Jurídica' },
] as const;

export const CONTRATO_TIPO_OPTIONS = [
  { value: 'recorrente', label: 'Recorrente' },
  { value: 'projeto', label: 'Projeto' },
  { value: 'avulso', label: 'Avulso' },
] as const;

export const DESPESA_TIPO_OPTIONS = [
  { value: 'fixa', label: 'Fixa' },
  { value: 'variavel', label: 'Variável' },
  { value: 'investimento', label: 'Investimento' },
] as const;
