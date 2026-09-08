import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { EmpresaFonte } from '@/components/shared/EmpresaFonteBadge';

const CACHE_KEYS_TO_INVALIDATE = ['contas', 'dashboard', 'analises', 'calendario', 'relatorios', 'fluxo-caixa'];

export interface ClienteDB {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf_cnpj: string | null;
  tipo: 'PF' | 'PJ';
  status: 'ativo' | 'inativo';
  endereco: string | null;
  empresa_fonte: EmpresaFonte;
  created_at: string;
  updated_at: string;
}

export interface ClienteFormData {
  nome: string;
  email?: string;
  telefone?: string;
  cpf_cnpj?: string;
  tipo: 'PF' | 'PJ';
  status: 'ativo' | 'inativo';
  endereco?: string;
  empresa_fonte?: EmpresaFonte;
}

export function useClientes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [clientes, setClientes] = useState<ClienteDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const invalidateRelatedCaches = useCallback(() => {
    CACHE_KEYS_TO_INVALIDATE.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  }, [queryClient]);

  const fetchClientes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setClientes((data || []) as ClienteDB[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar clientes';
      setError(message);
      console.error('Error fetching clientes:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`clientes-rt-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clientes', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as ClienteDB;
            setClientes((prev) => (prev.some((c) => c.id === row.id) ? prev : [row, ...prev]));
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as ClienteDB;
            setClientes((prev) => prev.map((c) => (c.id === row.id ? row : c)));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string };
            setClientes((prev) => prev.filter((c) => c.id !== old.id));
          }
          invalidateRelatedCaches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, invalidateRelatedCaches]);

  const createCliente = async (formData: ClienteFormData): Promise<ClienteDB | null> => {
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('clientes')
        .insert({
          user_id: u.id,
          nome: formData.nome,
          email: formData.email || null,
          telefone: formData.telefone || null,
          cpf_cnpj: formData.cpf_cnpj || null,
          tipo: formData.tipo,
          status: formData.status,
          endereco: formData.endereco || null,
          empresa_fonte: formData.empresa_fonte || 'PIXIFY',
        } as never)
        .select()
        .single();

      if (error) throw error;

      setClientes((prev) => [data as ClienteDB, ...prev]);
      toast({ title: 'Cliente criado com sucesso!' });
      return data as ClienteDB;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar cliente';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error creating cliente:', err);
      return null;
    }
  };

  const updateCliente = async (id: string, formData: Partial<ClienteFormData>): Promise<ClienteDB | null> => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .update({
          nome: formData.nome,
          email: formData.email || null,
          telefone: formData.telefone || null,
          cpf_cnpj: formData.cpf_cnpj || null,
          tipo: formData.tipo,
          status: formData.status,
          endereco: formData.endereco || null,
          empresa_fonte: formData.empresa_fonte,
        } as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setClientes((prev) => prev.map((c) => (c.id === id ? (data as ClienteDB) : c)));
      toast({ title: 'Cliente atualizado com sucesso!' });
      return data as ClienteDB;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar cliente';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error updating cliente:', err);
      return null;
    }
  };

  const deleteCliente = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
      setClientes((prev) => prev.filter((c) => c.id !== id));
      toast({ title: 'Cliente excluído com sucesso!' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir cliente';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error deleting cliente:', err);
      return false;
    }
  };

  const deleteMultipleClientes = async (ids: string[]): Promise<boolean> => {
    try {
      const { error } = await supabase.from('clientes').delete().in('id', ids);
      if (error) throw error;
      setClientes((prev) => prev.filter((c) => !ids.includes(c.id)));
      toast({ title: `${ids.length} clientes excluídos com sucesso!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir clientes';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      console.error('Error deleting clientes:', err);
      return false;
    }
  };

  return {
    clientes,
    isLoading,
    error,
    refetch: fetchClientes,
    createCliente,
    updateCliente,
    deleteCliente,
    deleteMultipleClientes,
  };
}
