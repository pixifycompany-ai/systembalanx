import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Meta {
  id: string;
  user_id: string;
  tipo: 'faturamento' | 'lucro' | 'mrr';
  periodo: string;
  valor_meta: number;
  created_at: string;
  updated_at: string;
}

type MetaInsert = Omit<Meta, 'id' | 'created_at' | 'updated_at'>;
type MetaUpdate = Partial<Pick<Meta, 'valor_meta'>>;

export function useMetas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: metas = [], isLoading } = useQuery({
    queryKey: ['metas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metas')
        .select('*')
        .order('periodo', { ascending: false });
      
      if (error) throw error;
      return data as Meta[];
    },
    enabled: !!user,
  });

  const getMeta = (tipo: 'faturamento' | 'lucro' | 'mrr', periodo: string) => {
    return metas.find(m => m.tipo === tipo && m.periodo === periodo);
  };

  const getMetaValor = (tipo: 'faturamento' | 'lucro' | 'mrr', periodo: string, defaultValue = 15000) => {
    const meta = getMeta(tipo, periodo);
    return meta?.valor_meta ?? defaultValue;
  };

  const upsertMeta = useMutation({
    mutationFn: async ({ tipo, periodo, valor_meta }: { tipo: 'faturamento' | 'lucro' | 'mrr'; periodo: string; valor_meta: number }) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const existingMeta = getMeta(tipo, periodo);
      
      if (existingMeta) {
        const { data, error } = await supabase
          .from('metas')
          .update({ valor_meta })
          .eq('id', existingMeta.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('metas')
          .insert({
            user_id: user.id,
            tipo,
            periodo,
            valor_meta,
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Meta atualizada com sucesso!');
    },
    onError: (error) => {
      console.error('Error updating meta:', error);
      toast.error('Erro ao atualizar meta');
    },
  });

  return {
    metas,
    isLoading,
    getMeta,
    getMetaValor,
    upsertMeta,
  };
}
