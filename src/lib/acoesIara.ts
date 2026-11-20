// Ações que a IARA prepara no chat e a pessoa confirma: cadastrar cliente,
// criar contrato e criar cobrança no Asaas (com o lançamento "a receber" vinculado).
// Ordem ao confirmar: clientes → contratos → cobranças (os dois últimos usam o
// cliente criado no mesmo card quando ele ainda não existia).
import { supabase } from '@/integrations/supabase/client';
import { listasEscolhidas, sincronizarGoogleEmSegundoPlano, statusGoogle } from '@/lib/googleAgenda';
import { pausarContrato, reativarContrato } from '@/lib/pausaContrato';
import { registrarPagamentoFatura, type FaturaDB } from '@/hooks/useFaturas';
import type { ContaDB } from '@/hooks/useContas';

export interface AcaoCliente {
  id: string; tipo: 'cliente';
  nome: string; cpf_cnpj: string | null; pessoa: 'PF' | 'PJ';
  email: string | null; telefone: string | null; endereco: string | null;
  razao_social: string | null; situacao: string | null;
  existente: { id: string; nome: string } | null;
}
export interface AcaoContrato {
  id: string; tipo: 'contrato';
  cliente_id: string | null; cliente_nome: string;
  descricao: string; valor: number; recorrencia: string; dia_vencimento: number | null;
  data_inicio: string; data_fim: string | null; cobrar_no_asaas: boolean; forma: string;
}
export interface AcaoCobranca {
  id: string; tipo: 'cobranca';
  cliente_id: string | null; cliente_nome: string;
  valor: number; vencimento: string; descricao: string; forma: string;
  parcelas: { valor: number; vencimento: string }[] | null;
  conta_id: string | null; conta_nome: string | null;
}
export interface AcaoAlterarCobranca {
  id: string; tipo: 'alterar_cobranca';
  cobranca_id: string; cliente_nome: string; descricao: string;
  valor_atual: number; vencimento_atual: string;
  novo_valor: number | null; novo_vencimento: string | null; agrupada: boolean;
}
export interface AcaoCancelarCobranca {
  id: string; tipo: 'cancelar_cobranca';
  cobranca_id: string; cliente_nome: string; descricao: string;
  valor: number; vencimento: string; de_assinatura: boolean;
}
export interface AcaoAlterarDespesa {
  id: string; tipo: 'alterar_despesa';
  despesa_id: string; fornecedor: string; descricao: string;
  valor_atual: number; vencimento_atual: string;
  novo_valor: number | null; novo_vencimento: string | null;
}
export interface AcaoExcluirDespesa {
  id: string; tipo: 'excluir_despesa';
  despesa_id: string; fornecedor: string; descricao: string; valor: number; vencimento: string;
}
export interface AcaoCompromisso {
  id: string; tipo: 'compromisso';
  titulo: string; dia: string; data: string | null; inicio: string | null; fim: string | null; dia_inteiro: boolean;
  hora_inicio: string | null; hora_fim: string | null;
  cliente_id: string | null; cliente_nome: string | null; lembrete_min: number | null; notas: string | null;
}
export interface AcaoTarefa {
  id: string; tipo: 'tarefa';
  titulo: string; data: string | null; cliente_id: string | null; cliente_nome: string | null; notas: string | null;
  /** Nome da lista do Google Tarefas que a pessoa disse (vazio = padrão). */
  lista_nome?: string | null;
}
export interface AcaoConcluirTarefa {
  id: string; tipo: 'concluir_tarefa';
  item_id: string; titulo: string; quando: string; concluida: boolean;
}
export interface AcaoAlterarAgenda {
  id: string; tipo: 'alterar_agenda';
  item_id: string; item_tipo: 'compromisso' | 'tarefa'; titulo: string;
  /** Colunas de agenda_itens já calculadas pela IARA (título, data, início/fim, notas, cliente, lembrete). */
  patch: Record<string, unknown>;
  mudancas: { campo: string; de: string; para: string }[];
  lista_nome: string | null;
}
export interface AcaoExcluirAgenda {
  id: string; tipo: 'excluir_agenda';
  item_id: string; item_tipo: 'compromisso' | 'tarefa'; titulo: string; quando: string;
}
export interface AcaoDarBaixa {
  id: string; tipo: 'dar_baixa';
  lanc: 'receita' | 'despesa'; item_id: string; quem: string; descricao: string; valor: number; vencimento: string;
  /** Data em que pagou/recebeu. */
  data: string;
  /** Com cobrança no Asaas: baixa lá (recebido em dinheiro) e aqui. */
  via_asaas: boolean; cobranca_id: string | null;
  /** Conta a gravar no lançamento (null = mantém a dele). */
  conta_id: string | null; conta_nome: string | null;
}
export interface AcaoAlterarReceita {
  id: string; tipo: 'alterar_receita';
  receita_id: string; cliente_nome: string; descricao: string;
  valor_atual: number; vencimento_atual: string;
  novo_valor: number | null; novo_vencimento: string | null; nova_descricao: string | null; de_contrato: boolean;
}
export interface AcaoExcluirReceita {
  id: string; tipo: 'excluir_receita';
  receita_id: string; cliente_nome: string; descricao: string; valor: number; vencimento: string; de_contrato: boolean;
}
export interface AcaoAlterarCategoria {
  id: string; tipo: 'alterar_categoria';
  lanc: 'receita' | 'despesa'; ids: string[]; categoria_id: string; categoria_nome: string;
  quantidade: number; total: number;
  exemplos: { quem: string; descricao: string; valor: number; data: string; de: string }[];
}
export interface AcaoTransferencia {
  id: string; tipo: 'transferencia';
  conta_origem_id: string; origem_nome: string; conta_destino_id: string; destino_nome: string;
  valor: number; data: string; descricao: string | null;
}
export interface AcaoPagarFatura {
  id: string; tipo: 'pagar_fatura';
  fatura_id: string; cartao_id: string; cartao_nome: string; fatura_nome: string; vencimento: string;
  em_aberto: number; valor: number; conta_id: string; conta_nome: string; data: string;
}
export interface AcaoAlterarContrato {
  id: string; tipo: 'alterar_contrato';
  acao: 'pausar' | 'reativar' | 'encerrar' | 'reajustar';
  contrato_id: string; cliente_nome: string; descricao: string; valor: number; no_asaas: boolean;
  pausado_desde: string | null; pausado_ate: string | null;
  desde?: string; ate?: string | null; data?: string; receitas_futuras?: number; total_futuras?: number;
  novo_valor?: number; vigencia?: string; motivo?: string | null;
}
export interface AcaoLembreteWhatsapp {
  id: string; tipo: 'lembrete_whatsapp';
  cobranca_id: string; cliente_nome: string; telefone: string; texto: string;
  descricao: string; valor: number; vencimento: string; vencida: boolean;
}
export interface AcaoDefinirMeta {
  id: string; tipo: 'definir_meta';
  periodo: string; valor: number; atual: number | null;
}
export type AcaoIara = AcaoCliente | AcaoContrato | AcaoCobranca
  | AcaoAlterarCobranca | AcaoCancelarCobranca | AcaoAlterarDespesa | AcaoExcluirDespesa
  | AcaoCompromisso | AcaoTarefa | AcaoConcluirTarefa | AcaoAlterarAgenda | AcaoExcluirAgenda
  | AcaoDarBaixa | AcaoAlterarReceita | AcaoExcluirReceita | AcaoAlterarCategoria | AcaoTransferencia
  | AcaoPagarFatura | AcaoAlterarContrato | AcaoLembreteWhatsapp | AcaoDefinirMeta;

/** Só estas colunas podem vir da IARA num alterar_agenda. */
const CAMPOS_AGENDA = ['titulo', 'data', 'inicio', 'fim', 'dia_inteiro', 'notas', 'cliente_id', 'lembrete_min'] as const;

const hojeISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export interface ResultadoAcao {
  id: string;
  ok: boolean;
  mensagem: string;
  link?: string | null;
}

export const FORMA_LABEL: Record<string, string> = {
  PIX: 'Pix', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão', UNDEFINED: 'Pix, boleto ou cartão',
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

async function asaas(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('asaas-cobranca', { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as { ok: boolean; invoiceUrl?: string | null; parcelas?: number };
}

/** Lista do Google Tarefas pelo nome dito à IARA (vazio/não achou = padrão). */
async function listaPeloNome(nome?: string | null): Promise<string | null> {
  const ls = listasEscolhidas(await statusGoogle().catch(() => null));
  if (!ls.length) return null;
  if (nome) {
    const n = norm(nome);
    const hit = ls.find((l) => norm(l.nome) === n) || ls.find((l) => norm(l.nome).includes(n) || n.includes(norm(l.nome)));
    if (hit) return hit.id;
  }
  return ls[0].id; // padrão
}

/** Acha o cliente pelo nome (cadastrado agora ou antes). */
async function idDoCliente(nome: string, criados: Map<string, string>): Promise<string | null> {
  const n = norm(nome);
  for (const [k, v] of criados) if (norm(k) === n || norm(k).includes(n) || n.includes(norm(k))) return v;
  const { data } = await supabase.from('clientes').select('id, nome').ilike('nome', `%${nome.replace(/[%_]/g, '')}%`).limit(5);
  const hit = (data || []).find((c) => norm(c.nome) === n) || (data || [])[0];
  return hit?.id ?? null;
}

/**
 * Executa as ações na ordem certa. `usarExistente[id]` = true faz o card de cliente
 * reaproveitar o cadastro parecido em vez de criar outro.
 */
export async function executarAcoes(acoes: AcaoIara[], usarExistente: Record<string, boolean>): Promise<ResultadoAcao[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada. Entre de novo.');
  const res: ResultadoAcao[] = [];
  const criados = new Map<string, string>(); // nome → id

  for (const a of acoes.filter((x): x is AcaoCliente => x.tipo === 'cliente')) {
    try {
      if (a.existente && usarExistente[a.id] !== false) {
        criados.set(a.nome, a.existente.id);
        criados.set(a.existente.nome, a.existente.id);
        res.push({ id: a.id, ok: true, mensagem: `Cliente ${a.existente.nome} já cadastrado — usei o existente.` });
        continue;
      }
      const { data, error } = await supabase.from('clientes').insert({
        user_id: user.id, nome: a.nome, cpf_cnpj: a.cpf_cnpj, email: a.email, telefone: a.telefone,
        endereco: a.endereco, tipo: a.pessoa,
      } as never).select('id, nome').single();
      if (error) throw error;
      criados.set(a.nome, (data as { id: string }).id);
      res.push({ id: a.id, ok: true, mensagem: `Cliente ${a.nome} cadastrado.` });
    } catch (e) {
      res.push({ id: a.id, ok: false, mensagem: `Cliente ${a.nome}: ${e instanceof Error ? e.message : 'erro ao cadastrar'}` });
    }
  }

  for (const a of acoes.filter((x): x is AcaoContrato => x.tipo === 'contrato')) {
    try {
      const clienteId = a.cliente_id || await idDoCliente(a.cliente_nome, criados);
      if (!clienteId) throw new Error(`cadastre o cliente ${a.cliente_nome} primeiro`);
      const { data, error } = await supabase.from('contratos').insert({
        user_id: user.id, cliente_id: clienteId, descricao: a.descricao, valor: a.valor,
        data_inicio: a.data_inicio, data_fim: a.data_fim, dia_vencimento: a.dia_vencimento,
        recorrencia: a.recorrencia, status: 'ativo',
      } as never).select('id').single();
      if (error) throw error;
      let extra = a.recorrencia !== 'unico' ? ' As receitas dos próximos 12 meses já estão no financeiro.' : '';
      if (a.cobrar_no_asaas) {
        try {
          await asaas({ action: 'criar-contrato', contrato_id: (data as { id: string }).id, forma_pagamento: a.forma, conta_id: null });
          extra += ' Assinatura criada no Asaas.';
        } catch (e) {
          extra += ` Não deu para criar a assinatura no Asaas (${e instanceof Error ? e.message : 'erro'}); crie em Contratos.`;
        }
      }
      res.push({ id: a.id, ok: true, mensagem: `Contrato "${a.descricao}" criado.${extra}` });
    } catch (e) {
      res.push({ id: a.id, ok: false, mensagem: `Contrato: ${e instanceof Error ? e.message : 'erro ao criar'}` });
    }
  }

  for (const a of acoes.filter((x): x is AcaoCobranca => x.tipo === 'cobranca')) {
    try {
      const clienteId = a.cliente_id || await idDoCliente(a.cliente_nome, criados);
      if (!clienteId) throw new Error(`cadastre o cliente ${a.cliente_nome} primeiro`);
      if (a.parcelas && a.parcelas.length > 1) {
        await asaas({ action: 'criar-avulsa-parcelada', cliente_id: clienteId, descricao: a.descricao, forma_pagamento: a.forma, conta_id: a.conta_id, parcelas: a.parcelas });
        res.push({ id: a.id, ok: true, mensagem: `${a.parcelas.length} cobranças criadas no Asaas e lançadas no financeiro.` });
      } else {
        const r = await asaas({ action: 'criar-avulsa', cliente_id: clienteId, valor: a.valor, vencimento: a.vencimento, descricao: a.descricao, forma_pagamento: a.forma, conta_id: a.conta_id });
        res.push({ id: a.id, ok: true, mensagem: 'Cobrança criada no Asaas e lançada como "a receber".', link: r.invoiceUrl ?? null });
      }
    } catch (e) {
      res.push({ id: a.id, ok: false, mensagem: `Cobrança: ${e instanceof Error ? e.message : 'erro ao criar'}` });
    }
  }
  // Compromissos e tarefas (agenda); depois sincroniza com o Google, se conectado.
  let mexeuAgenda = false;
  for (const a of acoes) {
    if (a.tipo !== 'compromisso' && a.tipo !== 'tarefa') continue;
    try {
      const clienteId = a.cliente_id || (a.cliente_nome ? await idDoCliente(a.cliente_nome, criados) : null);
      const linha = a.tipo === 'compromisso'
        ? { tipo: 'compromisso', titulo: a.titulo, data: a.data, inicio: a.inicio, fim: a.fim, dia_inteiro: a.dia_inteiro,
            lembrete_min: a.lembrete_min, notas: a.notas, cliente_id: clienteId }
        : { tipo: 'tarefa', titulo: a.titulo, data: a.data, notas: a.notas, cliente_id: clienteId,
            google_tasklist_id: await listaPeloNome(a.lista_nome) };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('agenda_itens').insert(linha);
      if (error) throw error;
      mexeuAgenda = true;
      res.push({ id: a.id, ok: true, mensagem: a.tipo === 'compromisso' ? `Compromisso "${a.titulo}" na agenda.` : `Tarefa "${a.titulo}" criada.` });
    } catch (e) {
      res.push({ id: a.id, ok: false, mensagem: `${a.tipo === 'compromisso' ? 'Compromisso' : 'Tarefa'}: ${e instanceof Error ? e.message : 'não deu certo'}` });
    }
  }
  // Concluir / alterar / excluir itens da agenda.
  for (const a of acoes) {
    if (a.tipo !== 'concluir_tarefa' && a.tipo !== 'alterar_agenda' && a.tipo !== 'excluir_agenda') continue;
    const nome = a.tipo === 'concluir_tarefa' ? 'Tarefa' : a.item_tipo === 'tarefa' ? 'Tarefa' : 'Compromisso';
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tabela = (supabase as any).from('agenda_itens');
      let r: { data: unknown[] | null; error: unknown };
      if (a.tipo === 'concluir_tarefa') {
        r = await tabela.update({ concluida: a.concluida }).eq('id', a.item_id).eq('tipo', 'tarefa').select('id');
      } else if (a.tipo === 'excluir_agenda') {
        r = await tabela.delete().eq('id', a.item_id).select('id');
      } else {
        const upd: Record<string, unknown> = {};
        for (const k of CAMPOS_AGENDA) if (k in a.patch) upd[k] = a.patch[k];
        if (a.item_tipo === 'tarefa' && a.lista_nome) upd.google_tasklist_id = await listaPeloNome(a.lista_nome);
        r = await tabela.update(upd).eq('id', a.item_id).select('id');
      }
      if (r.error) throw r.error;
      if (!r.data?.length) throw new Error('não encontrei mais esse item');
      mexeuAgenda = true;
      res.push({ id: a.id, ok: true, mensagem:
        a.tipo === 'concluir_tarefa' ? (a.concluida ? `Tarefa "${a.titulo}" concluída.` : `Tarefa "${a.titulo}" reaberta.`)
        : a.tipo === 'excluir_agenda' ? `${nome} "${a.titulo}" excluído${nome === 'Tarefa' ? 'a' : ''}.`
        : `${nome} "${a.titulo}" alterad${nome === 'Tarefa' ? 'a' : 'o'}.` });
    } catch (e) {
      res.push({ id: a.id, ok: false, mensagem: `${nome}: ${e instanceof Error ? e.message : 'não deu certo'}` });
    }
  }
  if (mexeuAgenda) sincronizarGoogleEmSegundoPlano();

  // Alterações e exclusões (depois das criações).
  for (const a of acoes) {
    try {
      if (a.tipo === 'alterar_cobranca') {
        await asaas({ action: 'alterar-cobranca', cobranca_id: a.cobranca_id, vencimento: a.novo_vencimento, valor: a.novo_valor });
        res.push({ id: a.id, ok: true, mensagem: `Cobrança de ${a.cliente_nome} alterada no Asaas e no financeiro.` });
      } else if (a.tipo === 'cancelar_cobranca') {
        const r = await asaas({ action: 'cancelar-parcela', cobranca_id: a.cobranca_id }) as { de_assinatura?: boolean };
        res.push({ id: a.id, ok: true, mensagem: r.de_assinatura
          ? `Cobrança de ${a.cliente_nome} cancelada só neste mês; a assinatura continua. O lançamento a receber do mês ficou no financeiro, desvinculado: apague ou ajuste se o cliente não vai pagar.`
          : `Cobrança de ${a.cliente_nome} cancelada no Asaas.` });
      } else if (a.tipo === 'alterar_despesa') {
        const upd: Record<string, unknown> = {};
        if (a.novo_valor) upd.valor = a.novo_valor;
        if (a.novo_vencimento) {
          upd.data_vencimento = a.novo_vencimento;
          upd.status = a.novo_vencimento >= hojeISO() ? 'pendente' : 'atrasado';
        }
        const { data, error } = await supabase.from('despesas').update(upd as never).eq('id', a.despesa_id)
          .in('status', ['pendente', 'atrasado']).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('ela já não está em aberto');
        res.push({ id: a.id, ok: true, mensagem: `Despesa "${a.descricao}" alterada.` });
      } else if (a.tipo === 'excluir_despesa') {
        const { data, error } = await supabase.from('despesas').delete().eq('id', a.despesa_id)
          .in('status', ['pendente', 'atrasado']).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('ela já não está em aberto');
        res.push({ id: a.id, ok: true, mensagem: `Despesa "${a.descricao}" excluída.` });
      }
    } catch (e) {
      const oQue = a.tipo.includes('despesa') ? 'Despesa' : 'Cobrança';
      res.push({ id: a.id, ok: false, mensagem: `${oQue}: ${e instanceof Error ? e.message : 'não deu certo'}` });
    }
  }

  // Baixas, receitas, categorias, transferências, faturas, contratos, WhatsApp e metas.
  for (const a of acoes) {
    try {
      const m = await executarExtra(a, user.id);
      if (m) res.push({ id: a.id, ok: true, mensagem: m });
    } catch (e) {
      res.push({ id: a.id, ok: false, mensagem: `${ROTULO_EXTRA[a.tipo] || 'Ação'}: ${e instanceof Error ? e.message : 'não deu certo'}` });
    }
  }
  return res;
}

const ROTULO_EXTRA: Record<string, string> = {
  dar_baixa: 'Baixa', alterar_receita: 'Receita', excluir_receita: 'Receita', alterar_categoria: 'Categoria',
  transferencia: 'Transferência', pagar_fatura: 'Fatura', alterar_contrato: 'Contrato', lembrete_whatsapp: 'WhatsApp', definir_meta: 'Meta',
};
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

/** Devolve a mensagem de sucesso (ou null se o tipo não é daqui). Mesmas regras das telas. */
async function executarExtra(a: AcaoIara, userId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  switch (a.tipo) {
    case 'dar_baixa': {
      if (a.via_asaas && a.cobranca_id) {
        // Igual a "Identificar pagamento" em Cobranças: recebido em dinheiro no Asaas + baixa aqui.
        await asaas({ action: 'receber-manual', cobranca_id: a.cobranca_id, data_pagamento: a.data });
        return `${a.descricao} recebida em ${dataBR(a.data)} (aqui e no Asaas).`;
      }
      const tabela = a.lanc === 'receita' ? 'receitas' : 'despesas';
      const upd: Record<string, unknown> = a.lanc === 'receita'
        ? { status: 'recebido', data_recebimento: a.data }
        : { status: 'pago', data_pagamento: a.data };
      if (a.conta_id) upd.conta_id = a.conta_id;
      const { data, error } = await db.from(tabela).update(upd).eq('id', a.item_id).in('status', ['pendente', 'atrasado']).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('já não está em aberto');
      return `${a.descricao} ${a.lanc === 'receita' ? 'recebida' : 'paga'} em ${dataBR(a.data)}${a.conta_nome ? ` · ${a.conta_nome}` : ''}.`;
    }
    case 'alterar_receita': {
      const upd: Record<string, unknown> = {};
      if (a.novo_valor) upd.valor = a.novo_valor;
      if (a.nova_descricao) upd.descricao = a.nova_descricao;
      if (a.novo_vencimento) {
        upd.data_vencimento = a.novo_vencimento;
        upd.status = a.novo_vencimento >= hojeISO() ? 'pendente' : 'atrasado';
      }
      const { data, error } = await db.from('receitas').update(upd).eq('id', a.receita_id).in('status', ['pendente', 'atrasado']).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('ela já não está em aberto');
      return `Receita "${a.descricao}" alterada.`;
    }
    case 'excluir_receita': {
      const { data, error } = await db.from('receitas').delete().eq('id', a.receita_id).in('status', ['pendente', 'atrasado']).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('ela já não está em aberto');
      return `Receita "${a.descricao}" excluída.`;
    }
    case 'alterar_categoria': {
      const tabela = a.lanc === 'receita' ? 'receitas' : 'despesas';
      const { data, error } = await db.from(tabela).update({ categoria_id: a.categoria_id }).in('id', a.ids).select('id');
      if (error) throw error;
      return `${data?.length ?? 0} lançamento(s) agora em ${a.categoria_nome}.`;
    }
    case 'transferencia': {
      if (a.conta_origem_id === a.conta_destino_id) throw new Error('origem e destino são a mesma conta');
      if (!(a.valor > 0)) throw new Error('valor inválido');
      const { error } = await db.from('transferencias').insert({
        user_id: userId, conta_origem_id: a.conta_origem_id, conta_destino_id: a.conta_destino_id,
        valor: a.valor, descricao: a.descricao || null, data_transferencia: a.data,
      });
      if (error) throw error;
      return `${brl(a.valor)} de ${a.origem_nome} para ${a.destino_nome}.`;
    }
    case 'pagar_fatura': {
      const [{ data: fat, error: fe }, { data: cartao, error: ce }] = await Promise.all([
        db.from('cartao_faturas').select('*').eq('id', a.fatura_id).single(),
        supabase.from('contas').select('*').eq('id', a.cartao_id).single(),
      ]);
      if (fe || ce || !fat || !cartao) throw new Error('não achei a fatura ou o cartão');
      const f = fat as FaturaDB;
      const restante = Number(f.valor_total) - Number(f.valor_pago);
      if (f.status === 'paga' || restante <= 0.005) throw new Error('essa fatura já está paga');
      if (a.valor > restante + 0.001) throw new Error(`o valor passa do que falta (${brl(restante)})`);
      await registrarPagamentoFatura(f, cartao as unknown as ContaDB, [{ conta_id: a.conta_id, valor: a.valor, data_pagamento: a.data }], userId);
      return `Fatura ${a.fatura_nome} do ${a.cartao_nome}: ${brl(a.valor)} pago pela ${a.conta_nome}.`;
    }
    case 'alterar_contrato': {
      const { data: c, error } = await db.from('contratos').select('id, asaas_subscription_id, pausado_desde, pausado_ate, valor').eq('id', a.contrato_id).single();
      if (error || !c) throw new Error('não achei o contrato');
      if (a.acao === 'pausar') {
        const r = await pausarContrato(c, a.desde!, a.ate || null);
        return `Contrato de ${a.cliente_nome} pausado a partir de ${dataBR(a.desde)}${a.ate ? ` até ${dataBR(a.ate)}` : ''}.${r?.canceladas ? ` ${r.canceladas} cobrança(s) do período cancelada(s).` : ''}`;
      }
      if (a.acao === 'reativar') {
        await reativarContrato(c);
        return `Contrato de ${a.cliente_nome} reativado.`;
      }
      if (a.acao === 'encerrar') {
        // Igual a Contratos → editar → Encerrado: status + data; cobranças aguardando canceladas
        // no Asaas (vencidas ficam); receitas futuras em aberto saem. Recebidas ficam.
        const corte = a.data || hojeISO();
        const { error: ue } = await db.from('contratos').update({ status: 'encerrado', data_inativacao: corte }).eq('id', a.contrato_id);
        if (ue) throw ue;
        let extra = '';
        if (c.asaas_subscription_id) {
          try {
            const r = await asaas({ action: 'encerrar-contrato', contrato_id: a.contrato_id }) as { canceladas?: number };
            if (r?.canceladas) extra += ` ${r.canceladas} cobrança(s) aguardando cancelada(s) no Asaas.`;
          } catch (e) { extra += ` Não deu para parar no Asaas (${e instanceof Error ? e.message : 'erro'}): encerre em Contratos.`; }
        }
        const { data: apagadas } = await db.from('receitas').delete().eq('contrato_id', a.contrato_id)
          .in('status', ['pendente', 'atrasado']).gt('data_vencimento', corte).select('id');
        await db.from('contrato_parcelas').delete().eq('contrato_id', a.contrato_id).eq('status', 'pendente').gt('data_vencimento', corte);
        return `Contrato de ${a.cliente_nome} encerrado em ${dataBR(corte)}.${apagadas?.length ? ` ${apagadas.length} receita(s) futura(s) removida(s).` : ''}${extra}`;
      }
      // reajustar — igual a "Novo reajuste": histórico + valor do contrato (+ Asaas, se cobra lá)
      const novo = Number(a.novo_valor);
      const { error: ae } = await db.from('contrato_aditivos').insert({
        contrato_id: a.contrato_id, valor_anterior: Number(c.valor), valor_novo: novo,
        data_vigencia: a.vigencia || hojeISO(), motivo: a.motivo || null, user_id: userId,
      });
      if (ae) throw ae;
      const { error: ve } = await db.from('contratos').update({ valor: novo }).eq('id', a.contrato_id);
      if (ve) throw ve;
      let extra = '';
      if (c.asaas_subscription_id) {
        try { await asaas({ action: 'reajustar-assinatura', contrato_id: a.contrato_id, novo_valor: novo }); extra = ' Assinatura e cobranças pendentes do Asaas atualizadas.'; }
        catch (e) { extra = ` No Asaas não mudou (${e instanceof Error ? e.message : 'erro'}): ajuste em Contratos.`; }
      }
      return `Contrato de ${a.cliente_nome} reajustado de ${brl(Number(c.valor))} para ${brl(novo)}.${extra}`;
    }
    case 'lembrete_whatsapp': {
      const { data, error } = await supabase.functions.invoke('whatsapp-enviar', { body: { telefone: a.telefone, text: a.texto, cobranca_id: a.cobranca_id } });
      if (error) {
        let msg = error.message;
        try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* sem corpo */ }
        throw new Error(msg);
      }
      if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
      return `Lembrete enviado no WhatsApp de ${a.cliente_nome}.`;
    }
    case 'definir_meta': {
      const { data: ex } = await db.from('metas').select('id').eq('tipo', 'faturamento').eq('periodo', a.periodo).maybeSingle();
      const { error } = ex
        ? await db.from('metas').update({ valor_meta: a.valor }).eq('id', ex.id)
        : await db.from('metas').insert({ user_id: userId, tipo: 'faturamento', periodo: a.periodo, valor_meta: a.valor });
      if (error) throw error;
      return `Meta de ${a.periodo.split('-').reverse().join('/')}: ${brl(a.valor)}.`;
    }
    default:
      return null;
  }
}
