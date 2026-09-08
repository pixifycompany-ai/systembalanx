import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ContratoAditivo {
  id: string;
  contrato_id: string;
  valor_anterior: number;
  valor_novo: number;
  data_vigencia: string;
  motivo: string | null;
  created_at: string;
  user_id: string;
}

export interface AditivoFormData {
  valor_novo: number;
  data_vigencia: string;
  motivo?: string;
}

export function useContratoAditivos(contratoId?: string) {
  const [aditivos, setAditivos] = useState<ContratoAditivo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAditivos = useCallback(async () => {
    if (!contratoId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('contrato_aditivos' as any)
        .select('*')
        .eq('contrato_id', contratoId)
        .order('data_vigencia', { ascending: false });

      if (error) throw error;
      setAditivos((data as any[]) || []);
    } catch (err) {
      console.error('Error fetching aditivos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [contratoId]);

  useEffect(() => {
    fetchAditivos();
  }, [fetchAditivos]);

  const createAditivo = async (
    contratoId: string,
    valorAtual: number,
    formData: AditivoFormData
  ): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Insert the aditivo
      const { error: aditivoError } = await supabase
        .from('contrato_aditivos' as any)
        .insert({
          contrato_id: contratoId,
          valor_anterior: valorAtual,
          valor_novo: formData.valor_novo,
          data_vigencia: formData.data_vigencia,
          motivo: formData.motivo || null,
          user_id: user.id,
        } as any);

      if (aditivoError) throw aditivoError;

      // 2. Update the contract's current valor
      const { error: contratoError } = await supabase
        .from('contratos')
        .update({ valor: formData.valor_novo })
        .eq('id', contratoId);

      if (contratoError) throw contratoError;

      toast({ title: 'Reajuste registrado com sucesso!' });
      await fetchAditivos();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao registrar reajuste';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error creating aditivo:', err);
      return false;
    }
  };

  const deleteAditivo = async (aditivoId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('contrato_aditivos' as any)
        .delete()
        .eq('id', aditivoId);

      if (error) throw error;

      toast({ title: 'Reajuste removido com sucesso!' });
      await fetchAditivos();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover reajuste';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  return {
    aditivos,
    isLoading,
    createAditivo,
    deleteAditivo,
    refetch: fetchAditivos,
  };
}

/**
 * Given a list of aditivos for a contract, returns the effective valor for a given date.
 * If no aditivo applies, returns the base contract valor.
 */
export function getValorNaData(
  valorBase: number,
  aditivos: ContratoAditivo[],
  data: Date
): number {
  const dataStr = data.toISOString().split('T')[0];
  
  // Find the most recent aditivo whose data_vigencia <= data
  const aplicaveis = aditivos
    .filter(a => a.data_vigencia <= dataStr)
    .sort((a, b) => b.data_vigencia.localeCompare(a.data_vigencia));

  return aplicaveis.length > 0 ? Number(aplicaveis[0].valor_novo) : valorBase;
}
