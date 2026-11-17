// Ações que a IARA prepara no chat e a pessoa confirma: cadastrar cliente,
// criar contrato e criar cobrança no Asaas (com o lançamento "a receber" vinculado).
// Ordem ao confirmar: clientes → contratos → cobranças (os dois últimos usam o
// cliente criado no mesmo card quando ele ainda não existia).
import { supabase } from '@/integrations/supabase/client';
import { listasEscolhidas, sincronizarGoogleEmSegundoPlano, statusGoogle } from '@/lib/googleAgenda';

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
export type AcaoIara = AcaoCliente | AcaoContrato | AcaoCobranca
  | AcaoAlterarCobranca | AcaoCancelarCobranca | AcaoAlterarDespesa | AcaoExcluirDespesa
  | AcaoCompromisso | AcaoTarefa;

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
  return res;
}
