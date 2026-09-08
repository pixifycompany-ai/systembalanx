import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { parseISO, startOfDay, isBefore } from 'date-fns';
import type { TransacaoUnificada, TipoTransacao } from '@/types/fluxoCaixa';

// Internal types - different from the exported hook types
interface ReceitaInternal {
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
  recurrence_group_id: string | null;
  created_at: string;
  updated_at: string;
  cliente?: { id: string; nome: string; empresa_fonte?: string | null } | null;
  categoria?: { id: string; nome: string; cor: string } | null;
}

interface DespesaInternal {
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
  forma_pagamento: string | null;
  recurrence_group_id: string | null;
  created_at: string;
  updated_at: string;
  categoria?: { id: string; nome: string; cor: string } | null;
  cliente?: { id: string; nome: string; empresa_fonte?: string | null } | null;
}

interface CategoriaInternal {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  cor: string;
  is_padrao: boolean;
  user_id: string | null;
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
  forma_pagamento?: string;
}

interface UseFluxoCaixaReturn {
  transacoes: TransacaoUnificada[];
  categorias: CategoriaInternal[];
  categoriasReceita: CategoriaInternal[];
  categoriasDespesa: CategoriaInternal[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  
  // Receita operations
  createReceita: (data: ReceitaFormData) => Promise<boolean>;
  updateReceita: (id: string, data: Partial<ReceitaFormData>) => Promise<boolean>;
  deleteReceita: (id: string) => Promise<boolean>;
  deleteMultipleReceitas: (ids: string[]) => Promise<boolean>;
  
  // Despesa operations  
  createDespesa: (data: DespesaFormData) => Promise<boolean>;
  updateDespesa: (id: string, data: Partial<DespesaFormData>) => Promise<boolean>;
  deleteDespesa: (id: string) => Promise<boolean>;
  deleteMultipleDespesas: (ids: string[]) => Promise<boolean>;
  
  // Bulk operations
  updateMultipleStatus: (ids: string[], tipo: 'receitas' | 'despesas', status: string) => Promise<boolean>;
  deleteMultiple: (ids: string[], tipo: 'receitas' | 'despesas') => Promise<boolean>;
  updateMultipleCliente: (ids: string[], clienteId: string) => Promise<boolean>;
  updateMultipleFornecedor: (ids: string[], fornecedor: string) => Promise<boolean>;
  updateMultipleConta: (receitaIds: string[], despesaIds: string[], contaId: string) => Promise<boolean>;
}

interface TransferenciaInternal {
  id: string;
  user_id: string;
  conta_origem_id: string;
  conta_destino_id: string;
  valor: number;
  descricao: string | null;
  data_transferencia: string;
  created_at: string;
  conta_origem?: { id: string; nome: string; cor: string } | null;
  conta_destino?: { id: string; nome: string; cor: string } | null;
}

export function useFluxoCaixa(): UseFluxoCaixaReturn {
  const [receitas, setReceitas] = useState<ReceitaInternal[]>([]);
  const [despesas, setDespesas] = useState<DespesaInternal[]>([]);
  const [transferenciasInternas, setTransferenciasInternas] = useState<TransferenciaInternal[]>([]);
  const [categoriasReceita, setCategoriasReceita] = useState<CategoriaInternal[]>([]);
  const [categoriasDespesa, setCategoriasDespesa] = useState<CategoriaInternal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Update overdue items
  const updateOverdueReceitas = useCallback(async (items: ReceitaInternal[]) => {
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
      const { error } = await supabase
        .from('receitas')
        .update({ status: 'atrasado' })
        .in('id', overdueIds);

      if (!error) {
        setReceitas(prev => prev.map(r =>
          overdueIds.includes(r.id) ? { ...r, status: 'atrasado' as const } : r
        ));
      }
    }
  }, []);

  const updateOverdueDespesas = useCallback(async (items: DespesaInternal[]) => {
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
      const { error } = await supabase
        .from('despesas')
        .update({ status: 'atrasado' })
        .in('id', overdueIds);

      if (!error) {
        setDespesas(prev => prev.map(d =>
          overdueIds.includes(d.id) ? { ...d, status: 'atrasado' as const } : d
        ));
      }
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [
        { data: receitasData, error: receitasError },
        { data: despesasData, error: despesasError },
        { data: transferenciasData, error: transferenciasError },
        { data: catReceitaData, error: catReceitaError },
        { data: catDespesaData, error: catDespesaError },
      ] = await Promise.all([
        supabase
          .from('receitas')
          .select('*, cliente:clientes(id, nome, empresa_fonte), categoria:categorias(id, nome, cor)')
          .order('data_vencimento', { ascending: false }),
        supabase
          .from('despesas')
          .select('*, categoria:categorias(id, nome, cor), cliente:clientes(id, nome, empresa_fonte)')
          .is('fatura_id', null)
          .order('data_vencimento', { ascending: false }),
        supabase
          .from('transferencias')
          .select(`
            *,
            conta_origem:contas!transferencias_conta_origem_id_fkey(id, nome, cor),
            conta_destino:contas!transferencias_conta_destino_id_fkey(id, nome, cor)
          `)
          .order('data_transferencia', { ascending: false }),
        supabase
          .from('categorias')
          .select('*')
          .eq('tipo', 'receita')
          .order('nome'),
        supabase
          .from('categorias')
          .select('*')
          .eq('tipo', 'despesa')
          .order('nome'),
      ]);

      if (receitasError) throw receitasError;
      if (despesasError) throw despesasError;
      if (transferenciasError) throw transferenciasError;
      if (catReceitaError) throw catReceitaError;
      if (catDespesaError) throw catDespesaError;
      
      // Cast to internal types since we only select specific fields
      setReceitas((receitasData || []) as unknown as ReceitaInternal[]);
      setDespesas((despesasData || []) as unknown as DespesaInternal[]);
      setTransferenciasInternas((transferenciasData || []) as unknown as TransferenciaInternal[]);
      setCategoriasReceita((catReceitaData || []) as CategoriaInternal[]);
      setCategoriasDespesa((catDespesaData || []) as CategoriaInternal[]);

      // Update overdue items
      if (receitasData?.length) updateOverdueReceitas(receitasData as unknown as ReceitaInternal[]);
      if (despesasData?.length) updateOverdueDespesas(despesasData as unknown as DespesaInternal[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados';
      setError(message);
      console.error('Error fetching fluxo de caixa:', err);
    } finally {
      setIsLoading(false);
    }
  }, [updateOverdueReceitas, updateOverdueDespesas]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Transform data into unified transactions
  const transacoes = useMemo<TransacaoUnificada[]>(() => {
    const receitasTransformadas: TransacaoUnificada[] = receitas.map(r => ({
      id: r.id,
      tipo: 'entrada' as const,
      tabela_origem: 'receitas' as const,
      descricao: r.descricao,
      valor: Number(r.valor),
      data_competencia: r.data_competencia,
      data_vencimento: r.data_vencimento,
      data_efetivacao: r.data_recebimento,
      status: r.status,
      status_display: r.status === 'recebido' ? 'Recebido' : r.status === 'pendente' ? 'Pendente' : 'Atrasado',
      categoria_id: r.categoria_id,
      categoria: r.categoria || null,
      cliente_id: r.cliente_id,
      cliente: r.cliente || null,
      forma_pagamento: r.forma_pagamento,
      contrato_id: r.contrato_id,
      conta_id: r.conta_id,
      recurrence_group_id: r.recurrence_group_id,
    }));

    const despesasTransformadas: TransacaoUnificada[] = despesas.map(d => ({
      id: d.id,
      tipo: 'saida' as const,
      tabela_origem: 'despesas' as const,
      descricao: d.descricao,
      valor: Number(d.valor),
      data_competencia: d.data_competencia,
      data_vencimento: d.data_vencimento,
      data_efetivacao: d.data_pagamento,
      status: d.status,
      status_display: d.status === 'pago' ? 'Pago' : d.status === 'pendente' ? 'Pendente' : 'Atrasado',
      categoria_id: d.categoria_id,
      categoria: d.categoria || null,
      cliente_id: d.cliente_id,
      cliente: d.cliente || null,
      fornecedor: d.fornecedor,
      tipo_despesa: d.tipo,
      forma_pagamento: (d as unknown as { forma_pagamento?: string | null }).forma_pagamento ?? null,
      conta_id: d.conta_id,
      recurrence_group_id: d.recurrence_group_id,
    }));

    // Transferências geram 2 linhas: saída na origem + entrada no destino
    const transferenciasTransformadas: TransacaoUnificada[] = transferenciasInternas.flatMap(t => {
      const valor = Number(t.valor);
      const baseDescricao = t.descricao?.trim() || 'Transferência entre contas';
      const categoriaTransfer = {
        id: 'transfer-virtual',
        nome: 'Transferência entre contas',
        cor: '#6B7280',
      };
      const saida: TransacaoUnificada = {
        id: t.id,
        tipo: 'saida',
        tabela_origem: 'transferencia',
        descricao: t.conta_destino?.nome
          ? `${baseDescricao} → ${t.conta_destino.nome}`
          : baseDescricao,
        valor,
        data_competencia: t.data_transferencia,
        data_vencimento: t.data_transferencia,
        data_efetivacao: t.data_transferencia,
        status: 'transferido',
        status_display: 'Transferido',
        categoria_id: null,
        categoria: categoriaTransfer,
        conta_id: t.conta_origem_id,
        conta_destino_id: t.conta_destino_id,
        conta_origem: t.conta_origem || null,
        conta_destino: t.conta_destino || null,
      };
      const entrada: TransacaoUnificada = {
        id: t.id,
        tipo: 'entrada',
        tabela_origem: 'transferencia',
        descricao: t.conta_origem?.nome
          ? `${baseDescricao} ← ${t.conta_origem.nome}`
          : baseDescricao,
        valor,
        data_competencia: t.data_transferencia,
        data_vencimento: t.data_transferencia,
        data_efetivacao: t.data_transferencia,
        status: 'transferido',
        status_display: 'Transferido',
        categoria_id: null,
        categoria: categoriaTransfer,
        conta_id: t.conta_destino_id,
        conta_destino_id: t.conta_destino_id,
        conta_origem: t.conta_origem || null,
        conta_destino: t.conta_destino || null,
      };
      return [saida, entrada];
    });

    return [...receitasTransformadas, ...despesasTransformadas, ...transferenciasTransformadas];
  }, [receitas, despesas, transferenciasInternas]);

  const categorias = useMemo(() => [...categoriasReceita, ...categoriasDespesa], [categoriasReceita, categoriasDespesa]);

  // CRUD Operations for Receitas
  const createReceita = async (formData: ReceitaFormData): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

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
        })
        .select('*, cliente:clientes(id, nome), categoria:categorias(id, nome, cor)')
        .single();

      if (error) throw error;

      setReceitas(prev => [data as unknown as ReceitaInternal, ...prev]);
      toast({ title: 'Entrada criada com sucesso!' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar entrada';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  const updateReceita = async (id: string, formData: Partial<ReceitaFormData>): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('receitas')
        .update({
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
        })
        .eq('id', id)
        .select('*, cliente:clientes(id, nome), categoria:categorias(id, nome, cor)')
        .single();

      if (error) throw error;

      setReceitas(prev => prev.map(r => r.id === id ? data as unknown as ReceitaInternal : r));
      toast({ title: 'Entrada atualizada com sucesso!' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar entrada';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  const deleteReceita = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('receitas').delete().eq('id', id);
      if (error) throw error;

      setReceitas(prev => prev.filter(r => r.id !== id));
      toast({ title: 'Entrada excluída com sucesso!' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir entrada';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  const deleteMultipleReceitas = async (ids: string[]): Promise<boolean> => {
    try {
      const { error } = await supabase.from('receitas').delete().in('id', ids);
      if (error) throw error;

      setReceitas(prev => prev.filter(r => !ids.includes(r.id)));
      toast({ title: `${ids.length} entradas excluídas com sucesso!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir entradas';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  // CRUD Operations for Despesas
  const createDespesa = async (formData: DespesaFormData): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

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
          data_pagamento: formData.data_pagamento || null,
          status: formData.status,
          tipo: formData.tipo,
          forma_pagamento: formData.forma_pagamento || null,
        })
        .select('*, categoria:categorias(id, nome, cor), cliente:clientes(id, nome)')
        .single();

      if (error) throw error;

      setDespesas(prev => [data as unknown as DespesaInternal, ...prev]);
      toast({ title: 'Saída criada com sucesso!' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar saída';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  const updateDespesa = async (id: string, formData: Partial<DespesaFormData>): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('despesas')
        .update({
          categoria_id: formData.categoria_id || null,
          conta_id: formData.conta_id || null,
          cliente_id: formData.cliente_id || null,
          fornecedor: formData.fornecedor || null,
          descricao: formData.descricao,
          valor: formData.valor,
          data_competencia: formData.data_competencia,
          data_vencimento: formData.data_vencimento,
          data_pagamento: formData.data_pagamento || null,
          status: formData.status,
          tipo: formData.tipo,
          forma_pagamento: formData.forma_pagamento || null,
        })
        .eq('id', id)
        .select('*, categoria:categorias(id, nome, cor), cliente:clientes(id, nome)')
        .single();

      if (error) throw error;

      setDespesas(prev => prev.map(d => d.id === id ? data as unknown as DespesaInternal : d));
      toast({ title: 'Saída atualizada com sucesso!' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar saída';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  const deleteDespesa = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('despesas').delete().eq('id', id);
      if (error) throw error;

      setDespesas(prev => prev.filter(d => d.id !== id));
      toast({ title: 'Saída excluída com sucesso!' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir saída';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  const deleteMultipleDespesas = async (ids: string[]): Promise<boolean> => {
    try {
      const { error } = await supabase.from('despesas').delete().in('id', ids);
      if (error) throw error;

      setDespesas(prev => prev.filter(d => !ids.includes(d.id)));
      toast({ title: `${ids.length} saídas excluídas com sucesso!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir saídas';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  // Bulk operations
  const updateMultipleStatus = async (ids: string[], tipo: 'receitas' | 'despesas', status: string): Promise<boolean> => {
    try {
      // Fetch due dates for selected items to use as payment dates
      const { data: items } = await supabase
        .from(tipo)
        .select('id, data_vencimento')
        .in('id', ids);

      // Update each item individually to use its own due date
      const dateField = tipo === 'receitas' ? 'data_recebimento' : 'data_pagamento';
      const shouldSetDate = (tipo === 'receitas' && status === 'recebido') || (tipo === 'despesas' && status === 'pago');

      for (const id of ids) {
        const item = items?.find(i => i.id === id);
        const updateData: Record<string, unknown> = { status };
        if (shouldSetDate && item) {
          updateData[dateField] = item.data_vencimento;
        }
        await supabase.from(tipo).update(updateData).eq('id', id);
      }

      if (tipo === 'receitas') {
        setReceitas(prev => prev.map(r => {
          if (!ids.includes(r.id)) return r;
          const item = items?.find(i => i.id === r.id);
          return { 
            ...r, 
            status: status as 'pendente' | 'recebido' | 'atrasado',
            data_recebimento: status === 'recebido' && item ? item.data_vencimento : r.data_recebimento
          };
        }));
      } else {
        setDespesas(prev => prev.map(d => {
          if (!ids.includes(d.id)) return d;
          const item = items?.find(i => i.id === d.id);
          return { 
            ...d, 
            status: status as 'pendente' | 'pago' | 'atrasado',
            data_pagamento: status === 'pago' && item ? item.data_vencimento : d.data_pagamento
          };
        }));
      }
      
      toast({ title: `Status atualizado para ${ids.length} itens!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar status';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  const deleteMultiple = async (ids: string[], tipo: 'receitas' | 'despesas'): Promise<boolean> => {
    if (tipo === 'receitas') {
      return deleteMultipleReceitas(ids);
    } else {
      return deleteMultipleDespesas(ids);
    }
  };

  // Update multiple receitas with same cliente
  const updateMultipleCliente = async (ids: string[], clienteId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('receitas')
        .update({ cliente_id: clienteId })
        .in('id', ids);

      if (error) throw error;

      // Refetch to get updated cliente data
      await fetchData();
      
      toast({ title: `Cliente atualizado para ${ids.length} entradas!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar cliente';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  // Update multiple despesas with same fornecedor
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
      
      toast({ title: `Fornecedor atualizado para ${ids.length} saídas!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar fornecedor';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  // Update multiple receitas/despesas with same conta
  const updateMultipleConta = async (
    receitaIds: string[],
    despesaIds: string[],
    contaId: string
  ): Promise<boolean> => {
    try {
      if (receitaIds.length > 0) {
        const { error } = await supabase.from('receitas').update({ conta_id: contaId }).in('id', receitaIds);
        if (error) throw error;
      }
      if (despesaIds.length > 0) {
        const { error } = await supabase.from('despesas').update({ conta_id: contaId }).in('id', despesaIds);
        if (error) throw error;
      }
      await fetchData();
      const total = receitaIds.length + despesaIds.length;
      toast({ title: `Conta atualizada para ${total} ${total === 1 ? 'lançamento' : 'lançamentos'}!` });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar conta';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };


  return {
    transacoes,
    categorias,
    categoriasReceita,
    categoriasDespesa,
    isLoading,
    error,
    refetch: fetchData,
    createReceita,
    updateReceita,
    deleteReceita,
    deleteMultipleReceitas,
    createDespesa,
    updateDespesa,
    deleteDespesa,
    deleteMultipleDespesas,
    updateMultipleStatus,
    deleteMultiple,
    updateMultipleCliente,
    updateMultipleFornecedor,
    updateMultipleConta,
  };
}
