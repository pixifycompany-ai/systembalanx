import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Cobranca {
  id: string;
  cliente_id: string | null;
  contrato_id: string | null;
  receita_id: string | null;
  tipo: string;
  asaas_payment_id: string | null;
  asaas_subscription_id: string | null;
  descricao: string | null;
  valor: number;
  vencimento: string;
  forma_pagamento: string;
  status: string; // pendente | pago | vencido | estornado | cancelado
  invoice_url: string | null;
  data_pagamento: string | null;
}

export function useCobrancas() {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('cobrancas')
      .select('*')
      .order('created_at', { ascending: false });
    setCobrancas((data || []) as Cobranca[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('asaas-cobranca', { body });
    if (error || (data as { error?: string })?.error) {
      throw new Error((data as { error?: string })?.error || error?.message || 'Erro na cobrança');
    }
    return data;
  };

  const criarDoContrato = async (contrato_id: string, forma_pagamento: string, conta_id?: string | null) => {
    setBusyId(contrato_id);
    try {
      const d = await invoke({ action: 'criar-contrato', contrato_id, forma_pagamento, conta_id: conta_id || null });
      toast.success('Cobrança criada no Asaas!', { description: 'Receita "a receber" lançada no financeiro.' });
      await load();
      return d;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar cobrança');
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const criarAvulsa = async (payload: { cliente_id: string; valor: number; vencimento: string; descricao?: string; forma_pagamento: string }) => {
    setBusyId('avulsa');
    try {
      const d = await invoke({ action: 'criar-avulsa', ...payload });
      toast.success('Cobrança criada no Asaas!');
      await load();
      return d;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar cobrança');
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const cancelar = async (cobranca_id: string) => {
    setBusyId(cobranca_id);
    try {
      await invoke({ action: 'cancelar', cobranca_id });
      toast.success('Cobrança cancelada (também no Asaas).');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao cancelar');
    } finally {
      setBusyId(null);
    }
  };

  const excluir = async (cobranca_id: string) => {
    setBusyId(cobranca_id);
    try {
      await invoke({ action: 'excluir', cobranca_id });
      toast.success('Cobrança excluída (também no Asaas).');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setBusyId(null);
    }
  };

  const sincronizar = async (contrato_id?: string) => {
    setLoading(true);
    try {
      await invoke({ action: 'sincronizar', contrato_id });
      await load();
      toast.success('Status das cobranças atualizado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao sincronizar');
    } finally {
      setLoading(false);
    }
  };

  // Cobrança (mais recente) por contrato, ignorando canceladas.
  const byContrato = useMemo(() => {
    const m = new Map<string, Cobranca>();
    for (const c of cobrancas) {
      if (c.contrato_id && c.status !== 'cancelado' && !m.has(c.contrato_id)) m.set(c.contrato_id, c);
    }
    return m;
  }, [cobrancas]);

  return { cobrancas, byContrato, loading, busyId, criarDoContrato, criarAvulsa, cancelar, excluir, sincronizar, reload: load };
}

export const COBRANCA_STATUS_LABEL: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'muted' }> = {
  pendente: { label: 'Aguardando', tone: 'warning' },
  pago: { label: 'Pago', tone: 'success' },
  vencido: { label: 'Vencido', tone: 'danger' },
  estornado: { label: 'Estornado', tone: 'muted' },
  cancelado: { label: 'Cancelado', tone: 'muted' },
};
