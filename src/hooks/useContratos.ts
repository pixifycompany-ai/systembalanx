import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { ClienteDB } from './useClientes';

export interface ContratoDB {
  id: string;
  user_id: string;
  cliente_id: string;
  descricao: string;
  valor: number;
  data_inicio: string;
  data_fim: string | null;
  dia_vencimento: number | null;
  recorrencia: 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'unico';
  status: 'ativo' | 'cancelado' | 'encerrado';
  data_inativacao: string | null;
  created_at: string;
  updated_at: string;
  cliente?: ClienteDB | null;
}

export interface ContratoFormData {
  cliente_id: string;
  descricao: string;
  valor: number;
  data_inicio: string;
  data_fim?: string;
  dia_vencimento?: number;
  recorrencia: 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'unico';
  status: 'ativo' | 'cancelado' | 'encerrado';
  data_inativacao?: string;
}

export function useContratos() {
  const [contratos, setContratos] = useState<ContratoDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContratos = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('contratos')
        .select(`
          *,
          cliente:clientes(*)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      setContratos(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar contratos';
      setError(message);
      console.error('Error fetching contratos:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContratos();
  }, [fetchContratos]);

  const createContrato = async (formData: ContratoFormData): Promise<ContratoDB | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('contratos')
        .insert({
          user_id: user.id,
          cliente_id: formData.cliente_id,
          descricao: formData.descricao,
          valor: formData.valor,
          data_inicio: formData.data_inicio,
          data_fim: formData.data_fim || null,
          dia_vencimento: formData.dia_vencimento || null,
          recorrencia: formData.recorrencia,
          status: formData.status,
        })
        .select(`*, cliente:clientes(*)`)
        .single();

      if (error) throw error;

      setContratos(prev => [data, ...prev]);
      toast({ title: 'Contrato criado com sucesso!' });
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar contrato';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error creating contrato:', err);
      return null;
    }
  };

  const updateContrato = async (id: string, formData: Partial<ContratoFormData>): Promise<ContratoDB | null> => {
    try {
      const { data, error } = await supabase
        .from('contratos')
        .update({
          cliente_id: formData.cliente_id,
          descricao: formData.descricao,
          valor: formData.valor,
          data_inicio: formData.data_inicio,
          data_fim: formData.data_fim || null,
          dia_vencimento: formData.dia_vencimento ?? null,
          recorrencia: formData.recorrencia,
          status: formData.status,
          data_inativacao: formData.data_inativacao || null,
        } as any)
        .eq('id', id)
        .select(`*, cliente:clientes(*)`)
        .single();

      if (error) throw error;

      setContratos(prev => prev.map(c => c.id === id ? data : c));
      toast({ title: 'Contrato atualizado com sucesso!' });
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar contrato';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error updating contrato:', err);
      return null;
    }
  };

  const deleteContrato = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('contratos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setContratos(prev => prev.filter(c => c.id !== id));
      toast({ title: 'Contrato excluído com sucesso!' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir contrato';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error deleting contrato:', err);
      return false;
    }
  };

  const deleteMultipleContratos = async (ids: string[]): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('contratos')
        .delete()
        .in('id', ids);

      if (error) throw error;

      setContratos(prev => prev.filter(c => !ids.includes(c.id)));
      toast({ title: `${ids.length} contratos excluídos com sucesso!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir contratos';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error deleting contratos:', err);
      return false;
    }
  };

  const inactivateContrato = async (id: string, dataInativacao: string, status: 'cancelado' | 'encerrado'): Promise<boolean> => {
    try {
      // 1. Update contrato status + data_inativacao
      const { error: updateError } = await supabase
        .from('contratos')
        .update({ status, data_inativacao: dataInativacao } as any)
        .eq('id', id);

      if (updateError) throw updateError;

      // 2. Delete pending receitas with data > dataInativacao for this contrato
      await supabase
        .from('receitas')
        .delete()
        .eq('contrato_id', id)
        .eq('status', 'pendente')
        .gt('data_vencimento', dataInativacao);

      // 3. Delete pending parcelas with data > dataInativacao
      await supabase
        .from('contrato_parcelas')
        .delete()
        .eq('contrato_id', id)
        .eq('status', 'pendente')
        .gt('data_vencimento', dataInativacao);

      setContratos(prev => prev.map(c => c.id === id ? { ...c, status, data_inativacao: dataInativacao } : c));
      toast({ title: 'Contrato inativado com sucesso! Lançamentos futuros pendentes foram removidos.' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao inativar contrato';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error inactivating contrato:', err);
      return false;
    }
  };

  return {
    contratos,
    isLoading,
    error,
    refetch: fetchContratos,
    createContrato,
    updateContrato,
    deleteContrato,
    deleteMultipleContratos,
    inactivateContrato,
  };
}
