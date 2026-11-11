// Pixify Company - Formatting Utilities

/**
 * Format number as Brazilian Real currency
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Format date to Brazilian format (DD/MM/YYYY)
 */
export function formatDate(date: string | Date): string {
  if (!date) return '-';
  // "yyyy-MM-dd" é dia local; timestamp completo usa só a parte da data.
  const d = typeof date === 'string' ? new Date(date.slice(0, 10) + 'T00:00:00') : date;
  return d.toLocaleDateString('pt-BR');
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  // Dia local (toISOString é UTC e vira o dia seguinte depois das 21h).
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/**
 * Format phone number with mask
 */
export function formatPhone(phone: string): string {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * Format CPF with mask
 */
export function formatCPF(cpf: string): string {
  if (!cpf) return '-';
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
  }
  return cpf;
}

/**
 * Format CNPJ with mask
 */
export function formatCNPJ(cnpj: string): string {
  if (!cnpj) return '-';
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length === 14) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
  }
  return cnpj;
}

/**
 * Format CPF or CNPJ based on length
 */
export function formatCPFCNPJ(value: string): string {
  if (!value) return '-';
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 11) return formatCPF(cleaned);
  if (cleaned.length === 14) return formatCNPJ(cleaned);
  return value;
}

/**
 * Máscara progressiva de CPF/CNPJ para inputs ao vivo.
 * Aceita valor com pontuação (paste), remove tudo que não é dígito,
 * limita ao tamanho do tipo e aplica a máscara parcial conforme digita.
 */
export function maskCpfCnpj(value: string, tipo: 'PF' | 'PJ'): string {
  const d = (value || '').replace(/\D/g, '').slice(0, tipo === 'PJ' ? 14 : 11);
  if (tipo === 'PJ') {
    return d
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/** Só os dígitos de um CPF/CNPJ (para armazenar/comparar). */
export function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

/**
 * Format number as percentage
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}

/**
 * Format number with thousands separator
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

/**
 * Abbreviate large currency values (K, M, B)
 */
export function formatCurrencyShort(value: number): string {
  const abs = Math.abs(value);
  const sinal = value < 0 ? '-' : '';
  const curto = (n: number, sufixo: string) => `${sinal}R$ ${n.toFixed(1).replace('.', ',').replace(/,0$/, '')}${sufixo}`;
  if (abs >= 1_000_000_000) return curto(abs / 1_000_000_000, 'B');
  if (abs >= 1_000_000) return curto(abs / 1_000_000, 'M');
  if (abs >= 1_000) return curto(abs / 1_000, 'K');
  return formatCurrency(value);
}

/**
 * Get month name abbreviation in Portuguese
 */
export function getMonthNameShort(monthIndex: number): string {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return months[monthIndex] || '';
}

/**
 * Get full month name in Portuguese
 */
export function getMonthNameFull(monthIndex: number): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[monthIndex] || '';
}

/**
 * Parse Brazilian date string to Date object
 */
export function parseBRDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [day, month, year] = dateStr.split('/').map(Number);
  if (!day || !month || !year) return null;
  const d = new Date(year, month - 1, day);
  // Data que não existe (31/02) "transborda" para o mês seguinte: inválida.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  // Base negativa (prejuízo): sair de -100 para -50 é melhora (+50%).
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Get relative time description
 */
export function getRelativeTime(date: string | Date): string {
  // Conta por dia do calendário (local), não por blocos de 24h.
  const d = typeof date === 'string' ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? date + 'T00:00:00' : date) : date;
  const dia = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round((dia(new Date()) - dia(d)) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas atrás`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} meses atrás`;
  return `${Math.floor(diffDays / 365)} anos atrás`;
}

/**
 * Check if a date is overdue
 */
export function isOverdue(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Get days until due date
 */
export function getDaysUntilDue(dateStr: string): number {
  if (!dateStr) return 0;
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
