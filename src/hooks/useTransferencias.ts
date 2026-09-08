import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { ContaDB } from './useContas';

const CACHE_KEYS_TO_INVALIDATE = ['contas', 'dashboard', 'analises', 'calendario', 'relatorios', 'fluxo-caixa'];

export interface TransferenciaDB {
  id: string;
  user_id: string;
  conta_origem_id: string;
  conta_destino_id: string;
  valor: number;
  descricao: string | null;
  data_transferencia: string;
  created_at: string;
  conta_origem?: ContaDB;
  conta_destino?: ContaDB;
}

export interface TransferenciaFormData {
  conta_origem_id: string;
  conta_destino_id: string;
  valor: number;
  descricao?: string;
  data_transferencia: string;
}

export function useTransferencias() {
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [transferencias, setTransferencias] = useState<TransferenciaDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const invalidateRelatedCaches = useCallback(() => {
    CACHE_KEYS_TO_INVALIDATE.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  }, [queryClient]);

  const fetchTransferencias = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('transferencias')
        .select(`
          *,
          conta_origem:contas!transferencias_conta_origem_id_fkey(*),
          conta_destino:contas!transferencias_conta_destino_id_fkey(*)
        `)
        .order('data_transferencia', { ascending: false });

      if (fetchError) throw fetchError;
      
      setTransferencias(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar transferências';
      setError(message);
      console.error('Error fetching transferencias:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransferencias();
  }, [fetchTransferencias]);

  // Realtime subscription
  useEffect(() => {
    if (!authUser?.id) return;
    const channel = supabase
      .channel(`transferencias-rt-${authUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transferencias', filter: `user_id=eq.${authUser.id}` },
        () => {
          fetchTransferencias();
          invalidateRelatedCaches();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser?.id, fetchTransferencias, invalidateRelatedCaches]);

  const createTransferencia = async (formData: TransferenciaFormData): Promise<TransferenciaDB | null> => {
    try {
      // Validations
      if (formData.conta_origem_id === formData.conta_destino_id) {
        throw new Error('Conta origem e destino devem ser diferentes');
      }
      if (formData.valor <= 0) {
        throw new Error('Valor deve ser maior que zero');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('transferencias')
        .insert({
          user_id: user.id,
          conta_origem_id: formData.conta_origem_id,
          conta_destino_id: formData.conta_destino_id,
          valor: formData.valor,
          descricao: formData.descricao || null,
          data_transferencia: formData.data_transferencia,
        })
        .select(`
          *,
          conta_origem:contas!transferencias_conta_origem_id_fkey(*),
          conta_destino:contas!transferencias_conta_destino_id_fkey(*)
        `)
        .single();

      if (error) throw error;

      setTransferencias(prev => [data, ...prev]);
      invalidateRelatedCaches();
      toast({ title: 'Transferência realizada com sucesso!' });
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao realizar transferência';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error creating transferencia:', err);
      return null;
    }
  };

  const deleteTransferencia = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('transferencias')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTransferencias(prev => prev.filter(t => t.id !== id));
      invalidateRelatedCaches();
      toast({ title: 'Transferência excluída com sucesso!' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir transferência';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error deleting transferencia:', err);
      return false;
    }
  };

  const getTransferenciasByAccount = useCallback((contaId: string) => {
    return transferencias.filter(
      t => t.conta_origem_id === contaId || t.conta_destino_id === contaId
    );
  }, [transferencias]);

  return {
    transferencias,
    isLoading,
    error,
    refetch: fetchTransferencias,
    createTransferencia,
    deleteTransferencia,
    getTransferenciasByAccount,
  };
}
