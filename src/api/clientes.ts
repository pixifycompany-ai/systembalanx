// Pixify Company - Clientes API

import { apiGet, apiPost, apiDelete } from './config';
import type { Cliente, ClienteFormData } from '@/types/finance';

/**
 * Fetch all clientes
 */
export async function fetchClientes(): Promise<Cliente[]> {
  return apiGet<Cliente[]>('/clientes');
}

/**
 * Fetch cliente details with financial summary
 */
export async function fetchClienteDetalhes(id: string): Promise<{
  cliente: Cliente;
  resumo: {
    total_recebido: number;
    total_pendente: number;
    num_transacoes: number;
  };
  contratos: unknown[];
  receitas: unknown[];
}> {
  return apiGet(`/clientes/${id}/detalhes`);
}

/**
 * Create a new cliente
 */
export async function createCliente(data: ClienteFormData): Promise<Cliente> {
  return apiPost<Cliente>('/clientes', {
    action: 'create',
    ...data,
  });
}

/**
 * Update an existing cliente
 */
export async function updateCliente(id: string, data: Partial<ClienteFormData>): Promise<Cliente> {
  return apiPost<Cliente>('/clientes', {
    action: 'update',
    id,
    ...data,
  });
}

/**
 * Delete a cliente
 */
export async function deleteCliente(id: string): Promise<void> {
  return apiDelete(`/clientes/${id}`);
}

// Mock data for development
export const MOCK_CLIENTES: Cliente[] = [
  {
    id: '1',
    nome: 'Tech Solutions Ltda',
    email: 'contato@techsolutions.com.br',
    telefone: '11999998888',
    cpf_cnpj: '12345678000100',
    tipo: 'PJ',
    status: 'ativo',
    endereco: 'Av. Paulista, 1000 - São Paulo, SP',
  },
  {
    id: '2',
    nome: 'Marketing Pro',
    email: 'financeiro@marketingpro.com',
    telefone: '11988887777',
    cpf_cnpj: '98765432000100',
    tipo: 'PJ',
    status: 'ativo',
    endereco: 'Rua Augusta, 500 - São Paulo, SP',
  },
  {
    id: '3',
    nome: 'Startup Hub',
    email: 'hello@startuphub.io',
    telefone: '21977776666',
    cpf_cnpj: '45678912000100',
    tipo: 'PJ',
    status: 'ativo',
    endereco: 'Praia de Botafogo, 300 - Rio de Janeiro, RJ',
  },
  {
    id: '4',
    nome: 'E-commerce Brasil',
    email: 'contato@ecommercebr.com.br',
    telefone: '31966665555',
    cpf_cnpj: '78912345000100',
    tipo: 'PJ',
    status: 'ativo',
  },
  {
    id: '5',
    nome: 'Digital Agency',
    email: 'team@digitalagency.com',
    telefone: '41955554444',
    cpf_cnpj: '32165498000100',
    tipo: 'PJ',
    status: 'inativo',
  },
  {
    id: '6',
    nome: 'João Silva',
    email: 'joao.silva@email.com',
    telefone: '11944443333',
    cpf_cnpj: '12345678901',
    tipo: 'PF',
    status: 'ativo',
  },
];
