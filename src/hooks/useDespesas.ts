import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { parseISO, startOfDay, isBefore } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { ensureFaturaForLancamento, recalcularFatura } from './useFaturas';
import type { ContaDB } from './useContas';

const CACHE_KEYS_TO_INVALIDATE = ['contas', 'dashboard', 'analises', 'calendario', 'relatorios', 'fluxo-caixa'];

export interface CategoriaDB {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  cor: string;
  is_padrao: boolean;
  user_id: string | null;
  empresa_fonte?: 'PIXIFY' | 'REVVUE' | 'CLARIO' | 'TABELIO' | null;
}

export interface DespesaDB {
  id: string;
  user_id: string;
  categoria_id: string | null;
  conta_id: string | null;
  cliente_id: string | null;
  fornecedor: string | null;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: 'pendente' | 'pago' | 'atrasado';
  tipo: 'fixa' | 'variavel';
  fatura_id: string | null;
  empresa_fonte: 'PIXIFY' | 'REVVUE' | 'CLARIO' | 'TABELIO' | null;
  created_at: string;
  updated_at: string;
  categoria?: CategoriaDB | null;
  cliente?: { id: string; nome: string } | null;
}

export interface DespesaFormData {
  categoria_id?: string;
  conta_id?: string;
  cliente_id?: string;
  fornecedor?: string;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_vencimento: string;
  data_pagamento?: string;
  status: 'pendente' | 'pago' | 'atrasado';
  tipo: 'fixa' | 'variavel';
  empresa_fonte?: 'PIXIFY' | 'REVVUE' | 'CLARIO' | 'TABELIO' | null;
}

export function useDespesas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [despesas, setDespesas] = useState<DespesaDB[]>([]);
  const [categorias, setCategorias] = useState<CategoriaDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const invalidateRelatedCaches = useCallback(() => {
    CACHE_KEYS_TO_INVALIDATE.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  }, [queryClient]);

  // Update overdue items to 'atrasado' status
  const updateOverdueStatus = useCallback(async (items: DespesaDB[]) => {
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
        .from('despesas')
        .update({ status: 'atrasado' })
        .in('id', overdueIds);

      if (!error) {
        // Update local state
        setDespesas(prev => prev.map(d =>
          overdueIds.includes(d.id) ? { ...d, status: 'atrasado' } : d
        ));
      }
    }
  }, []);

  const fetchDespesas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [{ data: despesasData, error: despesasError }, { data: categoriasData, error: categoriasError }] = await Promise.all([
        supabase
          .from('despesas')
          .select(`
            *,
            categoria:categorias(*),
            cliente:clientes(id, nome)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('categorias')
          .select('*')
          .eq('tipo', 'despesa')
          .order('nome')
      ]);

      if (despesasError) throw despesasError;
      if (categoriasError) throw categoriasError;
      
      setDespesas(despesasData || []);
      setCategorias(categoriasData || []);

      // Check and update overdue items
      if (despesasData && despesasData.length > 0) {
        updateOverdueStatus(despesasData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar despesas';
      setError(message);
      console.error('Error fetching despesas:', err);
    } finally {
      setIsLoading(false);
    }
  }, [updateOverdueStatus]);

  useEffect(() => {
    fetchDespesas();
  }, [fetchDespesas]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`despesas-rt-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'despesas', filter: `user_id=eq.${user.id}` },
        () => {
          fetchDespesas();
          invalidateRelatedCaches();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchDespesas, invalidateRelatedCaches]);

  const createDespesa = async (
    formData: DespesaFormData,
    skipDuplicateCheck = false
  ): Promise<{ success: boolean; data?: DespesaDB; needsConfirmation?: boolean; duplicate?: { id: string; data: string; descricao: string; valor: number; status: string; tipo: 'receita' | 'despesa' } }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Check for duplicates if not skipping
      if (!skipDuplicateCheck) {
        const { useDuplicateDetection } = await import('./useDuplicateDetection');
        const { checkDespesa } = useDuplicateDetection();
        const duplicateResult = await checkDespesa(
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

      // Detecta se conta_id é um cartão de crédito
      let faturaId: string | null = null;
      if (formData.conta_id) {
        const { data: contaInfo } = await supabase
          .from('contas')
          .select('*')
          .eq('id', formData.conta_id)
          .single();
        if (contaInfo && (contaInfo as any).tipo === 'cartao_credito') {
          const fatura = await ensureFaturaForLancamento(
            contaInfo as unknown as ContaDB,
            formData.data_competencia || formData.data_vencimento,
            user.id
          );
          if (fatura) faturaId = fatura.id;
        }
      }

      const { data, error } = await supabase
        .from('despesas')
        .insert({
          user_id: user.id,
          categoria_id: formData.categoria_id || null,
          conta_id: formData.conta_id || null,
          cliente_id: formData.cliente_id || null,
          fornecedor: formData.fornecedor || null,
          descricao: formData.descricao,
          valor: formData.valor,
          data_competencia: formData.data_competencia,
          data_vencimento: formData.data_vencimento,
          data_pagamento: faturaId ? null : (formData.data_pagamento || null),
          // Lançamentos de cartão sempre 'pendente' (a baixa acontece quando a fatura é paga)
          status: faturaId ? 'pendente' : formData.status,
          tipo: formData.tipo,
          fatura_id: faturaId,
          empresa_fonte: formData.empresa_fonte ?? null,
        } as any)
        .select(`*, categoria:categorias(*), cliente:clientes(id, nome)`)
        .single();

      if (error) throw error;

      // Recalcula a fatura
      if (faturaId) await recalcularFatura(faturaId);

      setDespesas(prev => [data as any, ...prev]);
      invalidateRelatedCaches();
      toast({ title: faturaId ? 'Lançamento adicionado à fatura!' : 'Despesa criada com sucesso!' });
      return { success: true, data: data as any };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar despesa';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error creating despesa:', err);
      return { success: false };
    }
  };

  const updateDespesa = async (id: string, formData: Partial<DespesaFormData>): Promise<DespesaDB | null> => {
    try {
      const despesaAtual = despesas.find(d => d.id === id);
      const faturaIdAntigo = (despesaAtual as any)?.fatura_id ?? null;

      // Detecta se a NOVA conta é cartão de crédito
      let novoFaturaId: string | null = faturaIdAntigo;
      let forcarPendente = false;
      if (formData.conta_id !== undefined) {
        novoFaturaId = null; // reset; recalculamos abaixo
        if (formData.conta_id) {
          const { data: contaInfo } = await supabase
            .from('contas')
            .select('*')
            .eq('id', formData.conta_id)
            .single();
          if (contaInfo && (contaInfo as any).tipo === 'cartao_credito') {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const fatura = await ensureFaturaForLancamento(
                contaInfo as unknown as ContaDB,
                formData.data_competencia || formData.data_vencimento || despesaAtual?.data_vencimento || '',
                user.id
              );
              if (fatura) {
                novoFaturaId = fatura.id;
                forcarPendente = true;
              }
            }
          }
        }
      }

      // Só envia campos explicitamente presentes em formData (evita sobrescrever com null
      // quando o call site faz update parcial, ex: "dar baixa" enviando só status+data).
      const payload: Record<string, unknown> = {};
      const nullableKeys = ['categoria_id', 'cliente_id', 'fornecedor', 'data_pagamento'] as const;
      const directKeys = ['descricao', 'valor', 'data_competencia', 'data_vencimento', 'tipo'] as const;
      for (const k of nullableKeys) {
        if ((formData as any)[k] !== undefined) payload[k] = (formData as any)[k] || null;
      }
      for (const k of directKeys) {
        if ((formData as any)[k] !== undefined) payload[k] = (formData as any)[k];
      }
      if (formData.conta_id !== undefined) payload.conta_id = formData.conta_id || null;
      if (formData.empresa_fonte !== undefined) payload.empresa_fonte = (formData as any).empresa_fonte ?? null;

      // Status/data_pagamento e fatura_id respeitam a lógica de cartão de crédito
      if (forcarPendente) {
        payload.status = 'pendente';
        payload.data_pagamento = null;
      } else if (formData.status !== undefined) {
        payload.status = formData.status;
      }
      // fatura_id só é alterado quando conta_id foi enviado (recalculado acima)
      if (formData.conta_id !== undefined) payload.fatura_id = novoFaturaId;

      const { data, error } = await supabase
        .from('despesas')
        .update(payload as any)
        .eq('id', id)
        .select(`*, categoria:categorias(*), cliente:clientes(id, nome)`)
        .single();


      if (error) throw error;

      // Recalcula faturas afetadas (antiga e/ou nova)
      if (faturaIdAntigo && faturaIdAntigo !== novoFaturaId) await recalcularFatura(faturaIdAntigo);
      if (novoFaturaId) await recalcularFatura(novoFaturaId);

      setDespesas(prev => prev.map(d => d.id === id ? data : d));
      invalidateRelatedCaches();
      toast({ title: 'Despesa atualizada com sucesso!' });
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar despesa';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error updating despesa:', err);
      return null;
    }
  };

  const updateMultipleStatus = async (ids: string[], status: 'pendente' | 'pago' | 'atrasado'): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('despesas')
        .update({ status })
        .in('id', ids);

      if (error) throw error;

      setDespesas(prev => prev.map(d => 
        ids.includes(d.id) ? { ...d, status } : d
      ));
      invalidateRelatedCaches();
      toast({ title: `Status atualizado para ${ids.length} despesas!` });
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
        .from('despesas')
        .update({ categoria_id })
        .in('id', ids);

      if (error) throw error;

      const categoria = categorias.find(c => c.id === categoria_id);
      setDespesas(prev => prev.map(d => 
        ids.includes(d.id) ? { ...d, categoria_id, categoria: categoria || null } : d
      ));
      toast({ title: `Categoria atualizada para ${ids.length} despesas!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar categoria';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error updating categoria:', err);
      return false;
    }
  };

  const updateMultipleFornecedor = async (ids: string[], fornecedor: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('despesas')
        .update({ fornecedor })
        .in('id', ids);

      if (error) throw error;

      setDespesas(prev => prev.map(d => 
        ids.includes(d.id) ? { ...d, fornecedor } : d
      ));
      toast({ title: `Fornecedor atualizado para ${ids.length} despesas!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar fornecedor';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error updating fornecedor:', err);
      return false;
    }
  };

  const deleteDespesa = async (id: string): Promise<boolean> => {
    try {
      const despesaLocal = despesas.find(d => d.id === id);
      const faturaId = (despesaLocal as any)?.fatura_id ?? null;

      const { error } = await supabase
        .from('despesas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (faturaId) await recalcularFatura(faturaId);

      setDespesas(prev => prev.filter(d => d.id !== id));
      invalidateRelatedCaches();
      toast({ title: 'Despesa excluída com sucesso!' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir despesa';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error deleting despesa:', err);
      return false;
    }
  };

  const deleteMultipleDespesas = async (ids: string[]): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('despesas')
        .delete()
        .in('id', ids);

      if (error) throw error;

      setDespesas(prev => prev.filter(d => !ids.includes(d.id)));
      invalidateRelatedCaches();
      toast({ title: `${ids.length} despesas excluídas com sucesso!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir despesas';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error deleting despesas:', err);
      return false;
    }
  };

  return {
    despesas,
    categorias,
    isLoading,
    error,
    refetch: fetchDespesas,
    createDespesa,
    updateDespesa,
    updateMultipleStatus,
    updateMultipleCategoria,
    updateMultipleFornecedor,
    deleteDespesa,
    deleteMultipleDespesas,
  };
}
