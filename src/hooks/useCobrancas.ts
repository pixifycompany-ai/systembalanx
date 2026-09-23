import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Cobranca {
  id: string;
  cliente_id: string | null;
  contrato_id: string | null;
  receita_id: string | null;
  conta_id: string | null;
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
  created_at?: string | null;
  nota_fiscal_path?: string | null;
  nota_fiscal_nome?: string | null;
  nota_fiscal_enviada?: boolean | null;
  exigir_nf?: boolean | null;
}

// Receita já lançada que pode corresponder a uma cobrança (conciliação)
export interface CandidataReceita {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  diasDiferenca: number;
  mesmoValor: boolean;
  plausivel: boolean;
  confiavel: boolean;
}
export interface ItemConciliacao {
  cobranca: Cobranca;
  candidatas: CandidataReceita[];
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

  const criarAvulsa = async (payload: { cliente_id: string; valor: number; vencimento: string; descricao?: string; forma_pagamento: string; conta_id?: string | null; multa_percent?: number; juros_percent?: number }) => {
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

  // Definir/alterar a conta de recebimento de uma cobrança já criada
  // (ex.: foi vinculada sem informar conta). Atualiza a receita vinculada também.
  const atualizarConta = async (cobranca_id: string, conta_id: string | null) => {
    setBusyId(cobranca_id);
    try {
      await invoke({ action: 'atualizar-conta', cobranca_id, conta_id: conta_id || null });
      toast.success('Conta de recebimento atualizada.');
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar conta');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  // Conciliação: cobranças sem receita ↔ receitas a receber já lançadas à mão.
  const conciliarListar = async (): Promise<ItemConciliacao[]> => {
    try {
      const d = await invoke({ action: 'conciliar-listar' });
      return ((d as { itens?: ItemConciliacao[] })?.itens) || [];
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao buscar conciliação');
      return [];
    }
  };

  const conciliarAplicar = async (itens: { cobranca_id: string; receita_id?: string; criar?: boolean }[]) => {
    try {
      const d = (await invoke({ action: 'conciliar-aplicar', itens })) as { vinculadas: number; criadas: number; erros: string[] };
      toast.success('Conciliação aplicada', { description: `${d.vinculadas} vinculada(s) a receitas existentes, ${d.criadas} receita(s) nova(s).` });
      if (d.erros?.length) toast.error(d.erros.join(' '), { duration: 8000 });
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao aplicar conciliação');
      return false;
    }
  };

  // Alterar a forma de recebimento (billingType) no Asaas — assinatura atualiza
  // as faturas pendentes; avulsa atualiza a própria fatura.
  const atualizarForma = async (cobranca_id: string, forma_pagamento: string) => {
    setBusyId(cobranca_id);
    try {
      await invoke({ action: 'atualizar-forma', cobranca_id, forma_pagamento });
      toast.success('Forma de recebimento atualizada no Asaas.');
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao alterar forma', { duration: 8000 });
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

  // Anexa um PDF de nota fiscal à cobrança (Storage privado) e grava o path.
  const anexarNota = async (cobranca_id: string, file: File) => {
    setBusyId(cobranca_id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada.');
      if (file.type && file.type !== 'application/pdf') throw new Error('Envie um arquivo PDF.');
      const path = `${user.id}/${cobranca_id}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from('notas-fiscais').upload(path, file, { contentType: 'application/pdf', upsert: true });
      if (upErr) throw upErr;
      const { error: updErr } = await (supabase as any).from('cobrancas').update({ nota_fiscal_path: path, nota_fiscal_nome: file.name }).eq('id', cobranca_id);
      if (updErr) throw updErr;
      toast.success('Nota fiscal anexada.');
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao anexar nota fiscal');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const removerNota = async (cobranca_id: string, path?: string | null) => {
    setBusyId(cobranca_id);
    try {
      if (path) await supabase.storage.from('notas-fiscais').remove([path]);
      await (supabase as any).from('cobrancas').update({ nota_fiscal_path: null, nota_fiscal_nome: null }).eq('id', cobranca_id);
      toast.success('Nota fiscal removida.');
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const setExigirNf = async (cobranca_id: string, value: boolean) => {
    try {
      await (supabase as any).from('cobrancas').update({ exigir_nf: value }).eq('id', cobranca_id);
      toast.success(value ? 'Passou a exigir nota fiscal para disparar.' : 'Nota fiscal não é mais obrigatória.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar');
    }
  };

  const notaSignedUrl = async (path: string): Promise<string | null> => {
    const { data } = await supabase.storage.from('notas-fiscais').createSignedUrl(path, 600);
    return data?.signedUrl || null;
  };

  // Após envio confirmado do PDF: apaga o arquivo do Storage (economiza espaço)
  // e registra que a NF foi enviada.
  const marcarNotaEnviada = async (cobranca_id: string, path: string) => {
    try {
      await supabase.storage.from('notas-fiscais').remove([path]);
      await (supabase as any).from('cobrancas').update({ nota_fiscal_path: null, nota_fiscal_nome: null, nota_fiscal_enviada: true }).eq('id', cobranca_id);
      await load();
    } catch { /* silencioso: o envio já ocorreu */ }
  };

  const enviarWhatsapp = async (telefone: string, text: string, documento?: { url: string; nome: string } | null) => {
    try {
      const body: Record<string, unknown> = { telefone, text };
      if (documento?.url) { body.documento_url = documento.url; body.documento_nome = documento.nome; }
      const { data, error } = await supabase.functions.invoke('whatsapp-enviar', { body });
      if (error) {
        // supabase-js troca nosso JSON {error} por "non-2xx" genérico; lê o corpo real.
        let msg = error.message;
        try {
          const ctx = (error as { context?: Response }).context;
          const b = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
          if (b?.error) msg = b.error;
        } catch { /* mantém msg */ }
        throw new Error(msg);
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error);
      toast.success('WhatsApp enviado!');
      return { ok: true, docEnviado: !!(data as { docEnviado?: boolean })?.docEnviado };
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar WhatsApp', { duration: 8000 });
      return null;
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

  return { cobrancas, byContrato, loading, busyId, criarDoContrato, criarAvulsa, listarAssinaturas, vincularAssinatura, reajustarAssinatura, cancelar, excluir, sincronizar, receberManual, atualizarConta, atualizarForma, enviarWhatsapp, anexarNota, removerNota, setExigirNf, notaSignedUrl, marcarNotaEnviada, conciliarListar, conciliarAplicar, whatsappTemplate, reload: load };
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
