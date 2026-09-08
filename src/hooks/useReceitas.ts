import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { parseISO, startOfDay, isBefore } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import type { ClienteDB } from './useClientes';

const CACHE_KEYS_TO_INVALIDATE = ['contas', 'dashboard', 'analises', 'calendario', 'relatorios', 'fluxo-caixa'];

export interface CategoriaReceitaDB {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  cor: string;
  is_padrao: boolean;
  user_id: string | null;
  empresa_fonte?: 'PIXIFY' | 'REVVUE' | 'CLARIO' | 'TABELIO' | null;
}

export interface ReceitaDB {
  id: string;
  user_id: string;
  cliente_id: string | null;
  categoria_id: string | null;
  conta_id: string | null;
  contrato_id: string | null;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_vencimento: string;
  data_recebimento: string | null;
  status: 'pendente' | 'recebido' | 'atrasado';
  forma_pagamento: string | null;
  empresa_fonte: 'PIXIFY' | 'REVVUE' | 'CLARIO' | 'TABELIO' | null;
  created_at: string;
  updated_at: string;
  cliente?: ClienteDB | null;
  categoria?: CategoriaReceitaDB | null;
}

export interface ReceitaFormData {
  cliente_id?: string;
  categoria_id?: string;
  conta_id?: string;
  contrato_id?: string;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_vencimento: string;
  data_recebimento?: string;
  status: 'pendente' | 'recebido' | 'atrasado';
  forma_pagamento?: string;
  empresa_fonte?: 'PIXIFY' | 'REVVUE' | 'CLARIO' | 'TABELIO' | null;
}

export function useReceitas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [receitas, setReceitas] = useState<ReceitaDB[]>([]);
  const [categorias, setCategorias] = useState<CategoriaReceitaDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const invalidateRelatedCaches = useCallback(() => {
    CACHE_KEYS_TO_INVALIDATE.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  }, [queryClient]);

  // Update overdue items to 'atrasado' status
  const updateOverdueStatus = useCallback(async (items: ReceitaDB[]) => {
    const today = startOfDay(new Date());
    
    const overdueIds = items
      .filter(item => {
        if (item.status !== 'pendente') return false;
        if (!item.data_vencimento) return false;
        const vencimento = startOfDay(parseISO(item.data_vencimento));
        return isBefore(vencimento, today);
      })
      .map(item => item.id);

    if (overdueIds.length > 0) {
      // Update in database silently
      const { error } = await supabase
        .from('receitas')
        .update({ status: 'atrasado' })
        .in('id', overdueIds);

      if (!error) {
        // Update local state
        setReceitas(prev => prev.map(r =>
          overdueIds.includes(r.id) ? { ...r, status: 'atrasado' } : r
        ));
      }
    }
  }, []);

  const fetchReceitas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [{ data: receitasData, error: receitasError }, { data: categoriasData, error: categoriasError }] = await Promise.all([
        supabase
          .from('receitas')
          .select(`
            *,
            cliente:clientes(*),
            categoria:categorias(*)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('categorias')
          .select('*')
          .eq('tipo', 'receita')
          .order('nome')
      ]);

      if (receitasError) throw receitasError;
      if (categoriasError) throw categoriasError;
      
      setReceitas(receitasData || []);
      setCategorias(categoriasData || []);

      // Check and update overdue items
      if (receitasData && receitasData.length > 0) {
        updateOverdueStatus(receitasData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar receitas';
      setError(message);
      console.error('Error fetching receitas:', err);
    } finally {
      setIsLoading(false);
    }
  }, [updateOverdueStatus]);

  useEffect(() => {
    fetchReceitas();
  }, [fetchReceitas]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`receitas-rt-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'receitas', filter: `user_id=eq.${user.id}` },
        () => {
          fetchReceitas();
          invalidateRelatedCaches();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchReceitas, invalidateRelatedCaches]);

  const createReceita = async (
    formData: ReceitaFormData,
    skipDuplicateCheck = false
  ): Promise<{ success: boolean; data?: ReceitaDB; needsConfirmation?: boolean; duplicate?: { id: string; data: string; descricao: string; valor: number; status: string; tipo: 'receita' | 'despesa' } }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Check for duplicates if not skipping
      if (!skipDuplicateCheck) {
        const { useDuplicateDetection } = await import('./useDuplicateDetection');
        const { checkReceita } = useDuplicateDetection();
        const duplicateResult = await checkReceita(
          formData.data_vencimento,
          formData.valor,
          formData.descricao
        );

        if (duplicateResult.isDuplicate && duplicateResult.match) {
          return {
            success: false,
            needsConfirmation: true,
            duplicate: duplicateResult.match,
          };
        }
      }

      const { data, error } = await supabase
        .from('receitas')
        .insert({
          user_id: user.id,
          cliente_id: formData.cliente_id || null,
          categoria_id: formData.categoria_id || null,
          conta_id: formData.conta_id || null,
          contrato_id: formData.contrato_id || null,
          descricao: formData.descricao,
          valor: formData.valor,
          data_competencia: formData.data_competencia,
          data_vencimento: formData.data_vencimento,
          data_recebimento: formData.data_recebimento || null,
          status: formData.status,
          forma_pagamento: formData.forma_pagamento || null,
          empresa_fonte: formData.empresa_fonte ?? null,
        } as never)
        .select(`*, cliente:clientes(*)`)
        .single();

      if (error) throw error;

      setReceitas(prev => [data, ...prev]);
      invalidateRelatedCaches();
      toast({ title: 'Receita criada com sucesso!' });
      return { success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar receita';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error creating receita:', err);
      return { success: false };
    }
  };

  const updateReceita = async (id: string, formData: Partial<ReceitaFormData>): Promise<ReceitaDB | null> => {
    try {
      // Só envia campos explicitamente presentes em formData (evita sobrescrever com null
      // quando o call site faz update parcial, ex: "dar baixa" enviando só status+data).
      const payload: Record<string, unknown> = {};
      const nullableKeys = ['cliente_id', 'categoria_id', 'conta_id', 'contrato_id', 'data_recebimento', 'forma_pagamento'] as const;
      const directKeys = ['descricao', 'valor', 'data_competencia', 'data_vencimento', 'status'] as const;
      for (const k of nullableKeys) {
        if ((formData as any)[k] !== undefined) payload[k] = (formData as any)[k] || null;
      }
      for (const k of directKeys) {
        if ((formData as any)[k] !== undefined) payload[k] = (formData as any)[k];
      }
      if ((formData as any).empresa_fonte !== undefined) payload.empresa_fonte = (formData as any).empresa_fonte ?? null;

      const { data, error } = await supabase
        .from('receitas')
        .update(payload as never)
        .eq('id', id)
        .select(`*, cliente:clientes(*)`)
        .single();

      if (error) throw error;

      setReceitas(prev => prev.map(r => r.id === id ? data : r));
      invalidateRelatedCaches();
      toast({ title: 'Receita atualizada com sucesso!' });
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar receita';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error updating receita:', err);
      return null;
    }
  };


  const updateMultipleStatus = async (ids: string[], status: 'pendente' | 'recebido' | 'atrasado'): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('receitas')
        .update({ status })
        .in('id', ids);

      if (error) throw error;

      setReceitas(prev => prev.map(r => 
        ids.includes(r.id) ? { ...r, status } : r
      ));
      invalidateRelatedCaches();
      toast({ title: `Status atualizado para ${ids.length} receitas!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar status';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error updating status:', err);
      return false;
    }
  };

  const updateMultipleCategoria = async (ids: string[], categoria_id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('receitas')
        .update({ categoria_id })
        .in('id', ids);

      if (error) throw error;

      const categoria = categorias.find(c => c.id === categoria_id);
      setReceitas(prev => prev.map(r => 
        ids.includes(r.id) ? { ...r, categoria_id, categoria: categoria || null } : r
      ));
      toast({ title: `Categoria atualizada para ${ids.length} receitas!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar categoria';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error updating categoria:', err);
      return false;
    }
  };

  const deleteReceita = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('receitas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setReceitas(prev => prev.filter(r => r.id !== id));
      invalidateRelatedCaches();
      toast({ title: 'Receita excluída com sucesso!' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir receita';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error deleting receita:', err);
      return false;
    }
  };

  const deleteMultipleReceitas = async (ids: string[]): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('receitas')
        .delete()
        .in('id', ids);

      if (error) throw error;

      setReceitas(prev => prev.filter(r => !ids.includes(r.id)));
      invalidateRelatedCaches();
      toast({ title: `${ids.length} receitas excluídas com sucesso!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir receitas';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error deleting receitas:', err);
      return false;
    }
  };

  const updateMultipleCliente = async (ids: string[], cliente_id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('receitas')
        .update({ cliente_id })
        .in('id', ids);

      if (error) throw error;

      // Fetch client data to update local state
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', cliente_id)
        .maybeSingle();

      setReceitas(prev => prev.map(r => 
        ids.includes(r.id) ? { ...r, cliente_id, cliente: clienteData || null } : r
      ));
      toast({ title: `Cliente atualizado para ${ids.length} receitas!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar cliente';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error updating cliente:', err);
      return false;
    }
  };

  return {
    receitas,
    categorias,
    isLoading,
    error,
    refetch: fetchReceitas,
    createReceita,
    updateReceita,
    updateMultipleStatus,
    updateMultipleCategoria,
    updateMultipleCliente,
    deleteReceita,
    deleteMultipleReceitas,
  };
}
