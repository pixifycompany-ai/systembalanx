import { supabase } from '@/integrations/supabase/client';
import { parseISO, startOfMonth, endOfMonth, min, max, subDays, addDays, format } from 'date-fns';

export interface DuplicateMatch {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  status: string;
  tipo: 'receita' | 'despesa';
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  match?: DuplicateMatch;
}

export interface TransactionToCheck {
  data: string;
  valor: number;
  descricao: string;
  tipo: 'receita' | 'despesa';
}

export interface TransactionWithDuplicate extends TransactionToCheck {
  isDuplicate: boolean;
  duplicateMatch?: DuplicateMatch;
}

// Normalize string for comparison
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

// Calculate similarity between two strings (0-100)
export function calculateSimilarity(str1: string, str2: string): number {
  const a = normalizeString(str1);
  const b = normalizeString(str2);

  // Exact match
  if (a === b) return 100;

  // One contains the other
  if (a.includes(b) || b.includes(a)) return 90;

  // Token-based comparison
  const tokensA = a.split(' ').filter(t => t.length > 2);
  const tokensB = b.split(' ').filter(t => t.length > 2);
  
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const commonTokens = tokensA.filter(t => tokensB.includes(t));
  const maxLength = Math.max(tokensA.length, tokensB.length);
  
  return Math.round((commonTokens.length / maxLength) * 100);
}

export function useDuplicateDetection() {
  const SIMILARITY_THRESHOLD = 70;

  // Check for duplicate receita
  const checkReceita = async (
    dataVencimento: string,
    valor: number,
    descricao?: string
  ): Promise<DuplicateCheckResult> => {
    try {
      const targetDate = parseISO(dataVencimento);
      const monthStart = format(startOfMonth(targetDate), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(targetDate), 'yyyy-MM-dd');

      const { data: existingReceitas, error } = await supabase
        .from('receitas')
        .select('id, data_vencimento, valor, descricao, status')
        .gte('data_vencimento', monthStart)
        .lte('data_vencimento', monthEnd);

      if (error) throw error;

      for (const receita of existingReceitas || []) {
        // Check date and value match
        if (receita.data_vencimento === dataVencimento && receita.valor === valor) {
          // If no description provided, consider it a match based on date+value
          if (!descricao) {
            return {
              isDuplicate: true,
              match: {
                id: receita.id,
                data: receita.data_vencimento,
                descricao: receita.descricao,
                valor: receita.valor,
                status: receita.status,
                tipo: 'receita',
              },
            };
          }

          // Check description similarity
          const similarity = calculateSimilarity(receita.descricao, descricao);
          if (similarity >= SIMILARITY_THRESHOLD) {
            return {
              isDuplicate: true,
              match: {
                id: receita.id,
                data: receita.data_vencimento,
                descricao: receita.descricao,
                valor: receita.valor,
                status: receita.status,
                tipo: 'receita',
              },
            };
          }
        }
      }

      return { isDuplicate: false };
    } catch (err) {
      console.error('Error checking receita duplicate:', err);
      return { isDuplicate: false };
    }
  };

  // Check for duplicate despesa
  const checkDespesa = async (
    dataVencimento: string,
    valor: number,
    descricao?: string
  ): Promise<DuplicateCheckResult> => {
    try {
      const targetDate = parseISO(dataVencimento);
      const monthStart = format(startOfMonth(targetDate), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(targetDate), 'yyyy-MM-dd');

      const { data: existingDespesas, error } = await supabase
        .from('despesas')
        .select('id, data_vencimento, valor, descricao, status')
        .gte('data_vencimento', monthStart)
        .lte('data_vencimento', monthEnd);

      if (error) throw error;

      for (const despesa of existingDespesas || []) {
        // Check date and value match
        if (despesa.data_vencimento === dataVencimento && despesa.valor === valor) {
          // If no description provided, consider it a match based on date+value
          if (!descricao) {
            return {
              isDuplicate: true,
              match: {
                id: despesa.id,
                data: despesa.data_vencimento,
                descricao: despesa.descricao,
                valor: despesa.valor,
                status: despesa.status,
                tipo: 'despesa',
              },
            };
          }

          // Check description similarity
          const similarity = calculateSimilarity(despesa.descricao, descricao);
          if (similarity >= SIMILARITY_THRESHOLD) {
            return {
              isDuplicate: true,
              match: {
                id: despesa.id,
                data: despesa.data_vencimento,
                descricao: despesa.descricao,
                valor: despesa.valor,
                status: despesa.status,
                tipo: 'despesa',
              },
            };
          }
        }
      }

      return { isDuplicate: false };
    } catch (err) {
      console.error('Error checking despesa duplicate:', err);
      return { isDuplicate: false };
    }
  };

  // Check a batch of transactions for duplicates
  const checkBatch = async (
    transactions: TransactionToCheck[]
  ): Promise<TransactionWithDuplicate[]> => {
    if (transactions.length === 0) return [];

    try {
      // Get date range from transactions
      const dates = transactions.map(t => parseISO(t.data));
      const minDate = format(subDays(min(dates), 1), 'yyyy-MM-dd');
      const maxDate = format(addDays(max(dates), 1), 'yyyy-MM-dd');

      // Fetch existing records in parallel
      const [{ data: receitas }, { data: despesas }] = await Promise.all([
        supabase
          .from('receitas')
          .select('id, data_vencimento, valor, descricao, status')
          .gte('data_vencimento', minDate)
          .lte('data_vencimento', maxDate),
        supabase
          .from('despesas')
          .select('id, data_vencimento, valor, descricao, status')
          .gte('data_vencimento', minDate)
          .lte('data_vencimento', maxDate),
      ]);

      // Check each transaction
      return transactions.map(transaction => {
        const existingRecords = transaction.tipo === 'receita' ? receitas : despesas;

        for (const record of existingRecords || []) {
          if (record.data_vencimento === transaction.data && record.valor === transaction.valor) {
            const similarity = calculateSimilarity(record.descricao, transaction.descricao);
            if (similarity >= SIMILARITY_THRESHOLD) {
              return {
                ...transaction,
                isDuplicate: true,
                duplicateMatch: {
                  id: record.id,
                  data: record.data_vencimento,
                  descricao: record.descricao,
                  valor: record.valor,
                  status: record.status,
                  tipo: transaction.tipo,
                },
              };
            }
          }
        }

        return {
          ...transaction,
          isDuplicate: false,
        };
      });
    } catch (err) {
      console.error('Error checking batch duplicates:', err);
      return transactions.map(t => ({ ...t, isDuplicate: false }));
    }
  };

  return {
    checkReceita,
    checkDespesa,
    checkBatch,
    calculateSimilarity,
  };
}
