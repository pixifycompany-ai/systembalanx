import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface NotaFiscal { path: string; nome: string }
/** Nota anexada + a linha (cobrança) que a guarda — numa fatura agrupada podem ser várias. */
export interface NotaRef extends NotaFiscal { cobranca_id: string }
export const MAX_NOTAS_FISCAIS = 10;

/** Notas fiscais da cobrança, aceitando o formato antigo (uma só em nota_fiscal_path). */
export function notasDe(c: Pick<Cobranca, 'notas_fiscais' | 'nota_fiscal_path' | 'nota_fiscal_nome'>): NotaFiscal[] {
  const arr = Array.isArray(c.notas_fiscais) ? c.notas_fiscais.filter((n) => n?.path) : [];
  if (arr.length) return arr.map((n) => ({ path: n.path, nome: n.nome || 'nota-fiscal.pdf' }));
  return c.nota_fiscal_path ? [{ path: c.nota_fiscal_path, nome: c.nota_fiscal_nome || 'nota-fiscal.pdf' }] : [];
}

/** Notas de várias linhas (fatura agrupada), sem repetir arquivo. */
export function notasDasLinhas(linhas: Cobranca[]): NotaRef[] {
  const vistos = new Set<string>();
  return linhas.flatMap((l) => notasDe(l).map((n) => ({ ...n, cobranca_id: l.id })))
    .filter((n) => !vistos.has(n.path) && !!vistos.add(n.path));
}

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
  /** Até 10 PDFs; nota_fiscal_path/nome espelham a 1ª (formato antigo). */
  notas_fiscais?: NotaFiscal[] | null;
  nota_fiscal_enviada?: boolean | null;
  exigir_nf?: boolean | null;
  envio_pix?: boolean | null;
  /** Quem é essa cobrança no Asaas (quando veio sem vínculo no BALANX). */
  asaas_customer_id?: string | null;
  asaas_customer_nome?: string | null;
  /** Envio no fim de semana por cobrança: null = usa o padrão. */
  enviar_fim_semana?: boolean | null;
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

  // Encerrar contrato: cancela as cobranças pendentes (aguardando) e preserva as
  // vencidas; para a assinatura no Asaas. O status do contrato é gravado à parte.
  const encerrarContratoCobrancas = async (contrato_id: string) => {
    setBusyId(contrato_id);
    try {
      const d = (await invoke({ action: 'encerrar-contrato', contrato_id })) as { canceladas?: number } | null;
      await load();
      return d;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao encerrar cobranças do contrato');
      return null;
    } finally {
      setBusyId(null);
    }
  };

  // Desvincula o contrato da assinatura do Asaas (não cancela no Asaas, só aqui).
  const desvincularAssinatura = async (contrato_id: string) => {
    setBusyId(contrato_id);
    try {
      await invoke({ action: 'desvincular-assinatura', contrato_id });
      toast.success('Contrato desvinculado do Asaas.', { description: 'A assinatura continua existindo no Asaas.' });
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao desvincular');
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

  // Cobrança parcelada com datas/valores personalizados (N cobranças no Asaas).
  const criarAvulsaParcelada = async (payload: {
    cliente_id: string; descricao?: string; forma_pagamento: string; conta_id?: string | null;
    parcelas: { valor: number; vencimento: string }[]; multa_percent?: number; juros_percent?: number;
  }) => {
    setBusyId('avulsa');
    try {
      const d = await invoke({ action: 'criar-avulsa-parcelada', ...payload });
      toast.success(`Cobrança parcelada criada (${payload.parcelas.length}x)!`);
      await load();
      return d;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar cobrança parcelada');
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

  // Vincula uma cobrança (que veio do Asaas sem cliente) a um cliente do cadastro.
  const atualizarCliente = async (cobranca_id: string, cliente_id: string | null) => {
    setBusyId(cobranca_id);
    try {
      await invoke({ action: 'atualizar-cliente', cobranca_id, cliente_id: cliente_id || null });
      toast.success(cliente_id ? 'Cliente vinculado à cobrança.' : 'Cliente desvinculado.');
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao vincular cliente');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  // Agrupar vários contratos do mesmo cliente numa assinatura só (um boleto).
  const agrupar = async (payload: {
    contrato_ids: string[];
    modo: 'criar' | 'vincular';
    asaas_subscription_id?: string;
    forma_pagamento?: string;
    conta_id?: string | null;
    dia_vencimento?: number;
    multa_percent?: number;
    juros_percent?: number;
    cancelar_existentes?: boolean;
  }) => {
    setBusyId('agrupar');
    try {
      const d = (await invoke({ action: 'agrupar', ...payload })) as {
        total: number; faturas: number; ajustes: { descricao: string; de: number; para: number }[];
      };
      const ajuste = d.ajustes?.length
        ? ` Valores ajustados ao Asaas: ${d.ajustes.map((a) => `${a.descricao} ${a.de.toFixed(2)} → ${a.para.toFixed(2)}`).join('; ')}.`
        : '';
      toast.success('Contratos agrupados numa cobrança só!', {
        description: `Assinatura de R$ ${Number(d.total).toFixed(2)}, ${d.faturas} fatura(s) importada(s).${ajuste}`,
        duration: 8000,
      });
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao agrupar', { duration: 8000 });
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
      const d = (await invoke({ action: 'sincronizar', contrato_id })) as { novas?: number; conciliadas?: number };
      await load();
      const partes = [
        d?.novas ? `${d.novas} fatura(s) nova(s) importada(s)` : '',
        d?.conciliadas ? `${d.conciliadas} ligada(s) ao financeiro` : '',
      ].filter(Boolean);
      toast.success('Cobranças sincronizadas.', partes.length ? { description: partes.join(' · ') } : undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao sincronizar');
    } finally {
      setLoading(false);
    }
  };

  // Template do WhatsApp + config PIX (editáveis em Meu Perfil)
  const [whatsappTemplate, setWhatsappTemplate] = useState<string>('');
  const [pixCfg, setPixCfg] = useState<{ chave: string; titular: string; template: string }>({ chave: '', titular: '', template: '' });
  const [emailCfg, setEmailCfg] = useState<{ assunto: string; corpo: string }>({ assunto: '', corpo: '' });
  // Padrão global de "enviar no fim de semana" (sobreposto por cobrança).
  const [fimSemanaPadrao, setFimSemanaPadraoState] = useState<boolean>(true);
  useEffect(() => {
    (async () => {
      // Tolerante a colunas ausentes (migração PIX pode não ter rodado ainda).
      const t = await (supabase as any).from('cobranca_config').select('whatsapp_template').maybeSingle();
      if (t.data?.whatsapp_template) setWhatsappTemplate(t.data.whatsapp_template);
      const p = await (supabase as any).from('cobranca_config').select('whatsapp_template_pix, pix_chave, pix_titular').maybeSingle();
      if (!p.error && p.data) setPixCfg({ chave: p.data.pix_chave || '', titular: p.data.pix_titular || '', template: p.data.whatsapp_template_pix || '' });
      const e = await (supabase as any).from('cobranca_config').select('email_assunto, email_corpo').maybeSingle();
      if (!e.error && e.data) setEmailCfg({ assunto: e.data.email_assunto || '', corpo: e.data.email_corpo || '' });
      const f = await (supabase as any).from('cobranca_config').select('auto_envio_fim_semana').maybeSingle();
      if (!f.error && f.data) setFimSemanaPadraoState(f.data.auto_envio_fim_semana !== false);
    })();
  }, []);

  // Salva o padrão global (Cobranças) de envio em fim de semana.
  const setFimSemanaPadrao = async (value: boolean) => {
    setFimSemanaPadraoState(value);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await (supabase as any).from('cobranca_config').update({ auto_envio_fim_semana: value }).eq('user_id', user.id);
    if (error) toast.error('Erro ao salvar padrão de fim de semana');
    else toast.success(value ? 'Padrão: envia no fim de semana' : 'Padrão: não envia no fim de semana');
  };

  // Define "enviar no fim de semana" para várias cobranças (ação em massa).
  const setEnviarFimSemana = async (cobranca_ids: string[], value: boolean) => {
    if (!cobranca_ids.length) return false;
    try {
      const { error } = await (supabase as any).from('cobrancas')
        .update({ enviar_fim_semana: value, updated_at: new Date().toISOString() }).in('id', cobranca_ids);
      if (error) throw error;
      toast.success(value ? 'Liberado envio no fim de semana' : 'Bloqueado envio no fim de semana');
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar cobranças');
      return false;
    }
  };

  // Marca/desmarca "enviar chave PIX no WhatsApp" (aceita várias linhas de uma fatura).
  const setEnvioPix = async (cobranca_ids: string | string[], value: boolean) => {
    try {
      const ids = Array.isArray(cobranca_ids) ? cobranca_ids : [cobranca_ids];
      await (supabase as any).from('cobrancas').update({ envio_pix: value }).in('id', ids);
      toast.success(value ? 'Passará a enviar a chave PIX no WhatsApp.' : 'Voltou a enviar o link da fatura.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar');
    }
  };

  // Lê as notas atuais direto do banco (evita sobrescrever com estado velho).
  const notasAtuais = async (cobranca_id: string): Promise<NotaFiscal[]> => {
    const { data } = await (supabase as any).from('cobrancas')
      .select('notas_fiscais, nota_fiscal_path, nota_fiscal_nome').eq('id', cobranca_id).maybeSingle();
    return data ? notasDe(data) : [];
  };
  const gravarNotas = (cobranca_id: string, notas: NotaFiscal[], extra: Record<string, unknown> = {}) =>
    (supabase as any).from('cobrancas').update({
      notas_fiscais: notas,
      nota_fiscal_path: notas[0]?.path ?? null,
      nota_fiscal_nome: notas[0]?.nome ?? null,
      ...extra,
    }).eq('id', cobranca_id);

  // Anexa PDFs de nota fiscal à cobrança (Storage privado), até 10 no total.
  // `jaNaFatura` = notas em outras linhas da mesma fatura agrupada (contam no limite).
  const anexarNotas = async (cobranca_id: string, files: File[], jaNaFatura = 0) => {
    setBusyId(cobranca_id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada.');
      if (!files.length) return false;
      if (files.some((f) => f.type && f.type !== 'application/pdf')) throw new Error('Envie apenas arquivos PDF.');
      const atuais = await notasAtuais(cobranca_id);
      const livres = MAX_NOTAS_FISCAIS - atuais.length - jaNaFatura;
      if (livres <= 0) throw new Error(`Limite de ${MAX_NOTAS_FISCAIS} notas fiscais por cobrança.`);
      const lote = files.slice(0, livres);
      const novas: NotaFiscal[] = [];
      for (const [i, file] of lote.entries()) {
        const path = `${user.id}/${cobranca_id}-${Date.now()}-${i}.pdf`;
        const { error: upErr } = await supabase.storage.from('notas-fiscais').upload(path, file, { contentType: 'application/pdf', upsert: true });
        if (upErr) throw upErr;
        novas.push({ path, nome: file.name });
      }
      const { error: updErr } = await gravarNotas(cobranca_id, [...atuais, ...novas]);
      if (updErr) {
        await supabase.storage.from('notas-fiscais').remove(novas.map((n) => n.path));
        throw updErr;
      }
      if (lote.length < files.length) {
        toast.warning(`Anexadas ${lote.length} de ${files.length}: o limite é ${MAX_NOTAS_FISCAIS} notas por cobrança.`);
      } else {
        toast.success(lote.length > 1 ? `${lote.length} notas fiscais anexadas.` : 'Nota fiscal anexada.');
      }
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao anexar nota fiscal');
      await load();
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const removerNota = async (nota: NotaRef) => {
    setBusyId(nota.cobranca_id);
    try {
      await supabase.storage.from('notas-fiscais').remove([nota.path]);
      const atuais = await notasAtuais(nota.cobranca_id);
      const { error } = await gravarNotas(nota.cobranca_id, atuais.filter((n) => n.path !== nota.path));
      if (error) throw error;
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

  // Aceita várias linhas (fatura agrupada: vale para todos os contratos dela).
  const setExigirNf = async (cobranca_ids: string | string[], value: boolean) => {
    try {
      const ids = Array.isArray(cobranca_ids) ? cobranca_ids : [cobranca_ids];
      await (supabase as any).from('cobrancas').update({ exigir_nf: value }).in('id', ids);
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

  // Após envio confirmado dos PDFs: apaga os arquivos do Storage (economiza espaço)
  // e registra que a NF foi enviada. Notas não enviadas continuam anexadas.
  const marcarNotasEnviadas = async (notas: NotaRef[]) => {
    if (!notas.length) return;
    try {
      await supabase.storage.from('notas-fiscais').remove(notas.map((n) => n.path));
      for (const id of new Set(notas.map((n) => n.cobranca_id))) {
        const enviadas = new Set(notas.filter((n) => n.cobranca_id === id).map((n) => n.path));
        const atuais = await notasAtuais(id);
        await gravarNotas(id, atuais.filter((n) => !enviadas.has(n.path)), { nota_fiscal_enviada: true });
      }
      await load();
    } catch { /* silencioso: o envio já ocorreu */ }
  };

  /** Quantos documentos a função de envio confirmou (as primeiras N notas). */
  const docsConfirmados = (data: unknown) => {
    const d = data as { docEnviado?: boolean; docsEnviados?: number } | null;
    return typeof d?.docsEnviados === 'number' ? d.docsEnviados : d?.docEnviado ? 1 : 0;
  };

  const enviarWhatsapp = async (telefone: string, text: string, documentos: { url: string; nome: string }[] = []) => {
    try {
      const body: Record<string, unknown> = { telefone, text };
      if (documentos.length) {
        body.documentos = documentos;
        body.documento_url = documentos[0].url; body.documento_nome = documentos[0].nome; // formato antigo
      }
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
      return { ok: true, docsEnviados: docsConfirmados(data) };
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar WhatsApp', { duration: 8000 });
      return null;
    }
  };

  // Envia a cobrança por e-mail (Resend). `dados` carrega os campos do template.
  const enviarEmail = async (dados: {
    /** Para registrar o envio e acompanhar entrega/falha (webhook do Resend). */
    cobranca_id?: string | null;
    para: string; cliente: string; descricao: string; valor: string; vencimento: string;
    prazo?: string | null; dias?: string | null;
    link?: string | null; pix?: string | null; titular?: string | null; intro?: string | null;
    notas?: NotaFiscal[];
    forma?: string | null; asaas_payment_id?: string | null;
  }) => {
    try {
      const { notas = [], ...resto } = dados;
      const body = {
        ...resto, notas,
        nota_fiscal_path: notas[0]?.path ?? null, nota_fiscal_nome: notas[0]?.nome ?? null, // formato antigo
      };
      const { data, error } = await supabase.functions.invoke('email-enviar', { body });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as { context?: Response }).context;
          const b = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
          if (b?.error) msg = b.error;
        } catch { /* mantém msg */ }
        throw new Error(msg);
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error);
      toast.success('E-mail enviado!');
      return { ok: true, docsEnviados: docsConfirmados(data) };
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar e-mail', { duration: 8000 });
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

  // Cobrança por assinatura — resolve o contrato de um grupo mesmo quando a
  // fatura ficou como linha única (ex.: dados antigos sem contrato_id).
  const bySubscription = useMemo(() => {
    const m = new Map<string, Cobranca>();
    for (const c of cobrancas) {
      if (c.asaas_subscription_id && c.status !== 'cancelado' && !m.has(c.asaas_subscription_id)) m.set(c.asaas_subscription_id, c);
    }
    return m;
  }, [cobrancas]);

  return { cobrancas, byContrato, bySubscription, loading, busyId, criarDoContrato, criarAvulsa, criarAvulsaParcelada, listarAssinaturas, vincularAssinatura, desvincularAssinatura, encerrarContratoCobrancas, reajustarAssinatura, cancelar, excluir, sincronizar, receberManual, atualizarConta, atualizarCliente, atualizarForma, enviarWhatsapp, enviarEmail, anexarNotas, removerNota, setExigirNf, notaSignedUrl, marcarNotasEnviadas, conciliarListar, conciliarAplicar, agrupar, setEnvioPix, whatsappTemplate, pixCfg, emailCfg, fimSemanaPadrao, setFimSemanaPadrao, setEnviarFimSemana, reload: load };
}

export const WHATSAPP_TEMPLATE_PADRAO =
  'Olá {cliente}! 👋\n\nSua cobrança de *{descricao}* {prazo}:\n💰 Valor: *{valor}*\n📅 Vencimento: {vencimento}\n\nLink para pagamento:\n{link}\n\nQualquer dúvida, é só chamar!';

export const WHATSAPP_TEMPLATE_PIX_PADRAO =
  'Olá {cliente}! 👋\n\nSua cobrança de *{descricao}* {prazo}:\n💰 Valor: *{valor}*\n📅 Vencimento: {vencimento}\n\n🔑 *Chave PIX:* {pix}\n👤 Em nome de: {titular}\n\nApós o pagamento, é só enviar o comprovante. Obrigado!';

// Frase relativa de vencimento (antes/no dia/atraso). diff = dias até vencer.
export function frasePrazo(diff: number): string {
  if (diff > 1) return `vence em ${diff} dias`;
  if (diff === 1) return 'vence amanhã';
  if (diff === 0) return 'vence hoje';
  if (diff === -1) return 'está vencida há 1 dia';
  return `está vencida há ${Math.abs(diff)} dias`;
}

export function preencherTemplate(
  tpl: string,
  d: { cliente: string; descricao: string; valor: string; vencimento: string; link: string; pix?: string; titular?: string; prazo?: string; dias?: string },
): string {
  return (tpl || WHATSAPP_TEMPLATE_PADRAO)
    .replace(/\{cliente\}/g, d.cliente)
    .replace(/\{descricao\}/g, d.descricao)
    .replace(/\{valor\}/g, d.valor)
    .replace(/\{vencimento\}/g, d.vencimento)
    .replace(/\{prazo\}/g, d.prazo || '')
    .replace(/\{dias\}/g, d.dias || '')
    .replace(/\{link\}/g, d.link || '')
    .replace(/\{pix\}/g, d.pix || '')
    .replace(/\{titular\}/g, d.titular || '');
}

export const COBRANCA_STATUS_LABEL: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'muted' }> = {
  pendente: { label: 'Aguardando', tone: 'warning' },
  pago: { label: 'Pago', tone: 'success' },
  vencido: { label: 'Vencido', tone: 'danger' },
  estornado: { label: 'Estornado', tone: 'muted' },
  cancelado: { label: 'Cancelado', tone: 'muted' },
};
