import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { addMonths } from 'date-fns';

export interface ContratoParcela {
  id: string;
  contrato_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  status: 'pendente' | 'recebido' | 'atrasado';
  created_at: string;
}

export interface ParcelaFormData {
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  status?: 'pendente' | 'recebido' | 'atrasado';
}

/**
 * Generate installments automatically based on total value and number of installments
 */
export function gerarParcelas(
  valorTotal: number, 
  numParcelas: number, 
  primeiroVencimento: Date
): ParcelaFormData[] {
  if (numParcelas <= 0 || valorTotal <= 0) return [];
  
  const valorParcela = Math.floor((valorTotal / numParcelas) * 100) / 100;
  const resto = Math.round((valorTotal - (valorParcela * (numParcelas - 1))) * 100) / 100;
  
  return Array.from({ length: numParcelas }, (_, i) => ({
    numero_parcela: i + 1,
    valor: i === numParcelas - 1 ? resto : valorParcela,
    data_vencimento: addMonths(primeiroVencimento, i).toISOString().split('T')[0],
    status: 'pendente' as const,
  }));
}

export function useContratoParcelas() {
  const [parcelas, setParcelas] = useState<ContratoParcela[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchParcelas = useCallback(async (contratoId: string) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('contrato_parcelas')
        .select('*')
        .eq('contrato_id', contratoId)
        .order('numero_parcela', { ascending: true });

      if (error) throw error;
      
      // Cast the data to our interface since Supabase types might not be updated yet
      setParcelas((data || []) as unknown as ContratoParcela[]);
    } catch (err) {
      console.error('Error fetching parcelas:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createParcelas = async (contratoId: string, parcelasData: ParcelaFormData[]): Promise<boolean> => {
    try {
      const insertData = parcelasData.map(p => ({
        contrato_id: contratoId,
        numero_parcela: p.numero_parcela,
        valor: p.valor,
        data_vencimento: p.data_vencimento,
        status: p.status || 'pendente',
      }));

      const { error } = await supabase
        .from('contrato_parcelas')
        .insert(insertData);

      if (error) throw error;

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar parcelas';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error creating parcelas:', err);
      return false;
    }
  };

  const updateParcela = async (id: string, data: Partial<ParcelaFormData>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('contrato_parcelas')
        .update({
          valor: data.valor,
          data_vencimento: data.data_vencimento,
          status: data.status,
        })
        .eq('id', id);

      if (error) throw error;

      setParcelas(prev => prev.map(p => 
        p.id === id ? { ...p, ...data } as ContratoParcela : p
      ));

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar parcela';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error updating parcela:', err);
      return false;
    }
  };

  const deleteParcelas = async (contratoId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('contrato_parcelas')
        .delete()
        .eq('contrato_id', contratoId);

      if (error) throw error;

      setParcelas([]);
      return true;
    } catch (err) {
      console.error('Error deleting parcelas:', err);
      return false;
    }
  };

  return {
    parcelas,
    isLoading,
    fetchParcelas,
    createParcelas,
    updateParcela,
    deleteParcelas,
    gerarParcelas,
  };
}
