// Pixify Company - Receitas API

import { apiGet, apiPost, apiDelete } from './config';
import type { Receita, ReceitaFormData } from '@/types/finance';

/**
 * Fetch all receitas
 */
export async function fetchReceitas(): Promise<Receita[]> {
  return apiGet<Receita[]>('/receitas');
}

/**
 * Fetch pending receitas only
 */
export async function fetchReceitasPendentes(): Promise<Receita[]> {
  return apiGet<Receita[]>('/receitas/pendentes');
}

/**
 * Create a new receita
 */
export async function createReceita(data: ReceitaFormData): Promise<Receita> {
  return apiPost<Receita>('/receitas', {
    action: 'create',
    ...data,
  });
}

/**
 * Update an existing receita
 */
export async function updateReceita(id: string, data: Partial<ReceitaFormData>): Promise<Receita> {
  return apiPost<Receita>('/receitas', {
    action: 'update',
    id,
    ...data,
  });
}

/**
 * Delete a receita
 */
export async function deleteReceita(id: string): Promise<void> {
  return apiDelete(`/receitas/${id}`);
}

// Mock data for development
export const MOCK_RECEITAS: Receita[] = [
  {
    id: '1',
    cliente_id: '1',
    cliente: { id: '1', nome: 'Tech Solutions Ltda', email: 'contato@techsolutions.com.br', telefone: '11999998888', cpf_cnpj: '12345678000100', tipo: 'PJ', status: 'ativo' },
    descricao: 'Gestão de Redes Sociais - Janeiro',
    valor: 2700,
    data_competencia: '2025-01-01',
    data_vencimento: '2025-01-10',
    data_recebimento: '2025-01-09',
    status: 'recebido',
    forma_pagamento: 'PIX',
  },
  {
    id: '2',
    cliente_id: '2',
    cliente: { id: '2', nome: 'Marketing Pro', email: 'financeiro@marketingpro.com', telefone: '11988887777', cpf_cnpj: '98765432000100', tipo: 'PJ', status: 'ativo' },
    descricao: 'Campanha Google Ads',
    valor: 1500,
    data_competencia: '2025-01-15',
    data_vencimento: '2025-01-20',
    status: 'pendente',
    forma_pagamento: 'Boleto',
  },
  {
    id: '3',
    cliente_id: '3',
    cliente: { id: '3', nome: 'Startup Hub', email: 'hello@startuphub.io', telefone: '21977776666', cpf_cnpj: '45678912000100', tipo: 'PJ', status: 'ativo' },
    descricao: 'Landing Page + SEO',
    valor: 3100,
    data_competencia: '2025-01-01',
    data_vencimento: '2025-01-05',
    status: 'atrasado',
    forma_pagamento: 'Transferência',
  },
  {
    id: '4',
    cliente_id: '1',
    cliente: { id: '1', nome: 'Tech Solutions Ltda', email: 'contato@techsolutions.com.br', telefone: '11999998888', cpf_cnpj: '12345678000100', tipo: 'PJ', status: 'ativo' },
    descricao: 'Projeto Website Institucional',
    valor: 4500,
    data_competencia: '2025-01-20',
    data_vencimento: '2025-01-25',
    data_recebimento: '2025-01-24',
    status: 'recebido',
    forma_pagamento: 'PIX',
  },
];
