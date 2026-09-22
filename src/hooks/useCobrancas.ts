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

export interface AsaasAssinatura {
  id: string;
  value: number;
  cycle: string;
  description: string | null;
  status: string;
  nextDueDate: string | null;
  billingType: string;
  vinculada: boolean;
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

  const criarDoContrato = async (contrato_id: string, forma_pagamento: string, conta_id?: string | null, extra?: { multa_percent?: number; juros_percent?: number }) => {
    setBusyId(contrato_id);
    try {
      const d = await invoke({ action: 'criar-contrato', contrato_id, forma_pagamento, conta_id: conta_id || null, multa_percent: extra?.multa_percent || 0, juros_percent: extra?.juros_percent || 0 });
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

  const listarAssinaturas = async (cliente_id?: string): Promise<AsaasAssinatura[]> => {
    try {
      const d = await invoke({ action: 'listar-assinaturas', cliente_id });
      return ((d as { assinaturas?: AsaasAssinatura[] })?.assinaturas) || [];
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao listar assinaturas');
      return [];
    }
  };

  const vincularAssinatura = async (contrato_id: string, asaas_subscription_id: string, conta_id?: string | null) => {
    setBusyId(contrato_id);
    try {
      await invoke({ action: 'vincular-assinatura', contrato_id, asaas_subscription_id, conta_id: conta_id || null });
      toast.success('Assinatura vinculada!', { description: 'Valor do contrato atualizado pelo Asaas.' });
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao vincular');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const criarAvulsa = async (payload: { cliente_id: string; valor: number; vencimento: string; descricao?: string; forma_pagamento: string; multa_percent?: number; juros_percent?: number }) => {
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

  // Reajuste: atualiza o valor da assinatura + faturas pendentes no Asaas.
  const reajustarAssinatura = async (contrato_id: string, novo_valor: number) => {
    try {
      const d = await invoke({ action: 'reajustar-assinatura', contrato_id, novo_valor });
      if ((d as { updated?: boolean })?.updated) {
        toast.success('Valor reajustado no Asaas', { description: 'Assinatura e faturas pendentes atualizadas.' });
        await load();
      }
      return d;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao reajustar no Asaas');
      return null;
    }
  };

  // Identificar pagamento manual: pagou por fora (ex.: Pix em outro banco).
  // Marca no Asaas (receiveInCash) e baixa a receita como recebida.
  const receberManual = async (cobranca_id: string) => {
    setBusyId(cobranca_id);
    try {
      await invoke({ action: 'receber-manual', cobranca_id });
      toast.success('Pagamento identificado!', { description: 'Baixado como recebido aqui e no Asaas.' });
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao identificar pagamento');
      return false;
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

  // Template do WhatsApp (editável em Meu Perfil)
  const [whatsappTemplate, setWhatsappTemplate] = useState<string>('');
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from('cobranca_config').select('whatsapp_template').maybeSingle();
      if (data?.whatsapp_template) setWhatsappTemplate(data.whatsapp_template);
    })();
  }, []);

  const enviarWhatsapp = async (telefone: string, text: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-enviar', { body: { telefone, text } });
      if (error || (data as { error?: string })?.error) throw new Error((data as { error?: string })?.error || error?.message || 'Falha ao enviar');
      toast.success('WhatsApp enviado!');
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar WhatsApp');
      return false;
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

  return { cobrancas, byContrato, loading, busyId, criarDoContrato, criarAvulsa, listarAssinaturas, vincularAssinatura, reajustarAssinatura, cancelar, excluir, sincronizar, enviarWhatsapp, whatsappTemplate, reload: load };
}

export const WHATSAPP_TEMPLATE_PADRAO =
  'Olá {cliente}! 👋\n\nSegue sua cobrança de *{descricao}*:\n💰 Valor: *{valor}*\n📅 Vencimento: {vencimento}\n\nLink para pagamento:\n{link}\n\nQualquer dúvida, é só chamar!';

export function preencherTemplate(tpl: string, d: { cliente: string; descricao: string; valor: string; vencimento: string; link: string }): string {
  return (tpl || WHATSAPP_TEMPLATE_PADRAO)
    .replace(/\{cliente\}/g, d.cliente)
    .replace(/\{descricao\}/g, d.descricao)
    .replace(/\{valor\}/g, d.valor)
    .replace(/\{vencimento\}/g, d.vencimento)
    .replace(/\{link\}/g, d.link);
}

export const COBRANCA_STATUS_LABEL: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'muted' }> = {
  pendente: { label: 'Aguardando', tone: 'warning' },
  pago: { label: 'Pago', tone: 'success' },
  vencido: { label: 'Vencido', tone: 'danger' },
  estornado: { label: 'Estornado', tone: 'muted' },
  cancelado: { label: 'Cancelado', tone: 'muted' },
};
