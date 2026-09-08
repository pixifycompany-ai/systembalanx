// Pixify Company - Dashboard API

import { apiGet } from './config';
import type { DashboardData } from '@/types/finance';

/**
 * Fetch dashboard data
 */
export async function fetchDashboard(): Promise<DashboardData> {
  return apiGet<DashboardData>('/dashboard');
}

// Mock data for development/demo purposes
export const MOCK_DASHBOARD_DATA: DashboardData = {
  resumo: {
    caixa_total: 7582.50,
    faturamento_mes: 8500.28,
    despesas_mes: 8158.08,
    lucro_mensal: 342.20,
    lucro_mensal_percentual: "4.03",
    receitas_pendentes: 4600.00,
    despesas_pendentes: 2500.00,
    receita_anual_projetada: 60400.00,
  },
  meta_faturamento: {
    valor_meta: 15000.00,
    valor_realizado: 8500.28,
    percentual_atingido: 56.7,
  },
  mrr: {
    historico: [
      { mes: 'Ago', valor: 4200 },
      { mes: 'Set', valor: 4800 },
      { mes: 'Out', valor: 5200 },
      { mes: 'Nov', valor: 5500 },
      { mes: 'Dez', valor: 5800 },
      { mes: 'Jan', valor: 6200 },
    ],
    projecao: [
      { mes: 'Fev', valor: 6500 },
      { mes: 'Mar', valor: 6900 },
      { mes: 'Abr', valor: 7200 },
      { mes: 'Mai', valor: 7600 },
      { mes: 'Jun', valor: 8000 },
      { mes: 'Jul', valor: 8500 },
    ],
  },
  faturamento_vs_despesas: [
    { mes: 'Ago', receita: 6500, despesa: 5200 },
    { mes: 'Set', receita: 7200, despesa: 5800 },
    { mes: 'Out', receita: 8100, despesa: 6400 },
    { mes: 'Nov', receita: 7800, despesa: 6100 },
    { mes: 'Dez', receita: 9200, despesa: 7500 },
    { mes: 'Jan', receita: 8500, despesa: 8158 },
  ],
  top_clientes: [
    { cliente: 'Tech Solutions Ltda', cliente_id: '1', receita_total: 24500 },
    { cliente: 'Marketing Pro', cliente_id: '2', receita_total: 18200 },
    { cliente: 'Startup Hub', cliente_id: '3', receita_total: 15800 },
    { cliente: 'E-commerce Brasil', cliente_id: '4', receita_total: 12400 },
    { cliente: 'Digital Agency', cliente_id: '5', receita_total: 9800 },
  ],
};
