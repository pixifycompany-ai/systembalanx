// Pixify Company - Despesas API

import { apiGet, apiPost, apiDelete } from './config';
import type { Despesa, DespesaFormData, CategoriaDespesa } from '@/types/finance';

/**
 * Fetch all despesas
 */
export async function fetchDespesas(): Promise<Despesa[]> {
  return apiGet<Despesa[]>('/despesas');
}

/**
 * Fetch despesas grouped by category
 */
export async function fetchDespesasPorCategoria(): Promise<Record<string, Despesa[]>> {
  return apiGet<Record<string, Despesa[]>>('/despesas/por-categoria');
}

/**
 * Create a new despesa
 */
export async function createDespesa(data: DespesaFormData): Promise<Despesa> {
  return apiPost<Despesa>('/despesas', {
    action: 'create',
    ...data,
  });
}

/**
 * Update an existing despesa
 */
export async function updateDespesa(id: string, data: Partial<DespesaFormData>): Promise<Despesa> {
  return apiPost<Despesa>('/despesas', {
    action: 'update',
    id,
    ...data,
  });
}

/**
 * Delete a despesa
 */
export async function deleteDespesa(id: string): Promise<void> {
  return apiDelete(`/despesas/${id}`);
}

// Mock categories
export const MOCK_CATEGORIAS_DESPESA: CategoriaDespesa[] = [
  { id: '1', nome: 'Ferramentas', cor: '#3B82F6' },
  { id: '2', nome: 'Marketing', cor: '#8B5CF6' },
  { id: '3', nome: 'Infraestrutura', cor: '#F59E0B' },
  { id: '4', nome: 'Pessoal', cor: '#10B981' },
  { id: '5', nome: 'Impostos', cor: '#EF4444' },
  { id: '6', nome: 'Outros', cor: '#6B7280' },
];

// Mock data for development
export const MOCK_DESPESAS: Despesa[] = [
  {
    id: '1',
    categoria_id: '1',
    categoria: { id: '1', nome: 'Ferramentas', cor: '#3B82F6' },
    fornecedor: 'Adobe',
    descricao: 'Assinatura Creative Cloud',
    valor: 289.90,
    data_competencia: '2025-01-01',
    data_vencimento: '2025-01-05',
    data_pagamento: '2025-01-05',
    status: 'pago',
    tipo: 'fixa',
  },
  {
    id: '2',
    categoria_id: '2',
    categoria: { id: '2', nome: 'Marketing', cor: '#8B5CF6' },
    fornecedor: 'Google Ads',
    descricao: 'Créditos de Anúncio',
    valor: 1500,
    data_competencia: '2025-01-15',
    data_vencimento: '2025-01-20',
    status: 'pendente',
    tipo: 'variavel',
  },
  {
    id: '3',
    categoria_id: '3',
    categoria: { id: '3', nome: 'Infraestrutura', cor: '#F59E0B' },
    fornecedor: 'Vercel',
    descricao: 'Hospedagem Pro',
    valor: 120,
    data_competencia: '2025-01-01',
    data_vencimento: '2025-01-01',
    data_pagamento: '2025-01-01',
    status: 'pago',
    tipo: 'fixa',
  },
  {
    id: '4',
    categoria_id: '4',
    categoria: { id: '4', nome: 'Pessoal', cor: '#10B981' },
    fornecedor: 'Freelancer Design',
    descricao: 'Projeto UI/UX Cliente X',
    valor: 2500,
    data_competencia: '2025-01-10',
    data_vencimento: '2025-01-15',
    status: 'pendente',
    tipo: 'variavel',
  },
  {
    id: '5',
    categoria_id: '5',
    categoria: { id: '5', nome: 'Impostos', cor: '#EF4444' },
    fornecedor: 'Receita Federal',
    descricao: 'DAS Simples Nacional',
    valor: 850,
    data_competencia: '2025-01-20',
    data_vencimento: '2025-01-20',
    data_pagamento: '2025-01-20',
    status: 'pago',
    tipo: 'fixa',
  },
];
