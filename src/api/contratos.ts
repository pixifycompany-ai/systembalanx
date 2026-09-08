// Pixify Company - Contratos API

import { apiGet, apiPost, apiDelete } from './config';
import type { Contrato, ContratoFormData } from '@/types/finance';

/**
 * Fetch all contratos
 */
export async function fetchContratos(): Promise<Contrato[]> {
  return apiGet<Contrato[]>('/contratos');
}

/**
 * Fetch recurring contratos only
 */
export async function fetchContratosRecorrentes(): Promise<Contrato[]> {
  return apiGet<Contrato[]>('/contratos/recorrentes');
}

/**
 * Create a new contrato
 */
export async function createContrato(data: ContratoFormData): Promise<Contrato> {
  return apiPost<Contrato>('/contratos', {
    action: 'create',
    ...data,
  });
}

/**
 * Update an existing contrato
 */
export async function updateContrato(id: string, data: Partial<ContratoFormData>): Promise<Contrato> {
  return apiPost<Contrato>('/contratos', {
    action: 'update',
    id,
    ...data,
  });
}

/**
 * Delete a contrato
 */
export async function deleteContrato(id: string): Promise<void> {
  return apiDelete(`/contratos/${id}`);
}

/**
 * Generate next contract number
 */
export function generateContratoNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `CONT-${year}-${random}`;
}

// Mock data for development
export const MOCK_CONTRATOS: Contrato[] = [
  {
    id: '1',
    cliente_id: '1',
    cliente: { id: '1', nome: 'Tech Solutions Ltda', email: 'contato@techsolutions.com.br', telefone: '11999998888', cpf_cnpj: '12345678000100', tipo: 'PJ', status: 'ativo' },
    numero_contrato: 'CONT-2025-001',
    descricao: 'Gestão completa de redes sociais e marketing digital',
    tipo: 'recorrente',
    valor_mensal: 2700,
    valor_total: 32400,
    data_inicio: '2025-01-01',
    dia_vencimento: 10,
    status: 'ativo',
  },
  {
    id: '2',
    cliente_id: '2',
    cliente: { id: '2', nome: 'Marketing Pro', email: 'financeiro@marketingpro.com', telefone: '11988887777', cpf_cnpj: '98765432000100', tipo: 'PJ', status: 'ativo' },
    numero_contrato: 'CONT-2025-002',
    descricao: 'Campanha de performance Google Ads',
    tipo: 'projeto',
    valor_mensal: 0,
    valor_total: 8500,
    data_inicio: '2025-01-15',
    data_fim: '2025-03-15',
    status: 'ativo',
  },
  {
    id: '3',
    cliente_id: '3',
    cliente: { id: '3', nome: 'Startup Hub', email: 'hello@startuphub.io', telefone: '21977776666', cpf_cnpj: '45678912000100', tipo: 'PJ', status: 'ativo' },
    numero_contrato: 'CONT-2024-089',
    descricao: 'Gestão de mídias sociais + criação de conteúdo',
    tipo: 'recorrente',
    valor_mensal: 1800,
    valor_total: 21600,
    data_inicio: '2024-06-01',
    dia_vencimento: 5,
    status: 'ativo',
  },
  {
    id: '4',
    cliente_id: '4',
    cliente: { id: '4', nome: 'E-commerce Brasil', email: 'contato@ecommercebr.com.br', telefone: '31966665555', cpf_cnpj: '78912345000100', tipo: 'PJ', status: 'ativo' },
    numero_contrato: 'CONT-2024-075',
    descricao: 'Desenvolvimento de e-commerce + SEO',
    tipo: 'projeto',
    valor_mensal: 0,
    valor_total: 25000,
    data_inicio: '2024-10-01',
    data_fim: '2025-02-28',
    status: 'ativo',
  },
  {
    id: '5',
    cliente_id: '5',
    cliente: { id: '5', nome: 'Digital Agency', email: 'team@digitalagency.com', telefone: '41955554444', cpf_cnpj: '32165498000100', tipo: 'PJ', status: 'inativo' },
    numero_contrato: 'CONT-2024-050',
    descricao: 'Consultoria de marketing digital',
    tipo: 'avulso',
    valor_mensal: 0,
    valor_total: 3500,
    data_inicio: '2024-08-01',
    data_fim: '2024-08-31',
    status: 'encerrado',
  },
];
