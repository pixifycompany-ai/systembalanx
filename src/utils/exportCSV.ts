/**
 * Export data to CSV file and trigger download
 */
export function exportToCSV<T extends object>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
): void {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Determine columns from data keys or use provided columns
  const columnConfig = columns || Object.keys(data[0]).map(key => ({
    key: key as keyof T,
    label: formatHeader(key),
  }));

  // Build CSV header
  const header = columnConfig.map(col => escapeCSVValue(col.label)).join(',');

  // Build CSV rows
  const rows = data.map(item =>
    columnConfig
      .map(col => {
        const value = item[col.key];
        return escapeCSVValue(formatValue(value));
      })
      .join(',')
  );

  // Combine header and rows
  const csvContent = [header, ...rows].join('\n');

  // Add BOM for Excel compatibility with UTF-8
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${formatDateForFilename(new Date())}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Escape CSV value (handle commas, quotes, newlines)
 */
function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format value for CSV
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (value instanceof Date) {
    return value.toLocaleDateString('pt-BR');
  }
  
  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR');
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return String(value);
}

/**
 * Format header from camelCase/snake_case to Title Case
 */
function formatHeader(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Format date for filename
 */
function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Export helper for Receitas
 */
export interface ReceitaExport {
  cliente: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
}

export function exportReceitas(receitas: ReceitaExport[]): void {
  exportToCSV(receitas, 'receitas', [
    { key: 'cliente', label: 'Cliente' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'valor', label: 'Valor' },
    { key: 'data_vencimento', label: 'Vencimento' },
    { key: 'status', label: 'Status' },
  ]);
}

/**
 * Export helper for Despesas
 */
export interface DespesaExport {
  fornecedor: string;
  descricao: string;
  valor: number;
  categoria: string;
  data_vencimento: string;
  status: string;
}

export function exportDespesas(despesas: DespesaExport[]): void {
  exportToCSV(despesas, 'despesas', [
    { key: 'fornecedor', label: 'Fornecedor' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'valor', label: 'Valor' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'data_vencimento', label: 'Vencimento' },
    { key: 'status', label: 'Status' },
  ]);
}

/**
 * Export helper for Clientes
 */
export interface ClienteExport {
  nome: string;
  email: string;
  telefone: string;
  cpf_cnpj: string;
  tipo: string;
  status: string;
}

export function exportClientes(clientes: ClienteExport[]): void {
  exportToCSV(clientes, 'clientes', [
    { key: 'nome', label: 'Nome' },
    { key: 'email', label: 'Email' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'cpf_cnpj', label: 'CPF/CNPJ' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'status', label: 'Status' },
  ]);
}

/**
 * Export helper for Contratos
 */
export interface ContratoExport {
  numero_contrato: string;
  cliente: string;
  tipo: string;
  valor_mensal: number;
  data_inicio: string;
  status: string;
}

export function exportContratos(contratos: ContratoExport[]): void {
  exportToCSV(contratos, 'contratos', [
    { key: 'numero_contrato', label: 'Nº Contrato' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'valor_mensal', label: 'Valor Mensal' },
    { key: 'data_inicio', label: 'Data Início' },
    { key: 'status', label: 'Status' },
  ]);
}

/**
 * Export helper for Fluxo de Caixa
 */
export interface FluxoCaixaExport {
  data: string;
  tipo: string;
  descricao: string;
  origem: string;
  valor: number;
  status: string;
  categoria: string;
}

export function exportFluxoCaixa(transacoes: FluxoCaixaExport[]): void {
  exportToCSV(transacoes, 'fluxo-caixa', [
    { key: 'data', label: 'Data' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'origem', label: 'Cliente/Fornecedor' },
    { key: 'valor', label: 'Valor' },
    { key: 'status', label: 'Status' },
    { key: 'categoria', label: 'Categoria' },
  ]);
}
