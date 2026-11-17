// Integração Google Agenda + Tarefas (lado do app).
import { supabase } from '@/integrations/supabase/client';

export interface OpcoesGoogle {
  pagar: boolean; receber: boolean; compromissos: boolean; fatura: boolean; tarefas: boolean; pessoal: boolean;
  /** Listas do Google Tarefas sincronizadas (a "BALANX" sempre entra). */
  listas?: string[];
  /** Lista onde entram as tarefas novas. */
  lista_padrao?: string | null;
  /** id → nome, para mostrar e escolher sem chamar o Google. */
  listas_nomes?: Record<string, string>;
}
export interface ListaTarefas { id: string; titulo: string; balanx: boolean }
export interface IntegracaoGoogle {
  email: string | null;
  escopos: string | null;
  tasklist_id: string | null;
  opcoes: OpcoesGoogle;
  ultima_sync: string | null;
  ultimo_erro: string | null;
}
export interface EventoPessoal { id: string; titulo: string; inicio: string; fim: string; dia_inteiro: boolean; link?: string }

export const retornoGoogle = () => `${window.location.origin}/integracoes/google/retorno`;

async function chamar<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function statusGoogle(): Promise<IntegracaoGoogle | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('google_integracoes')
    .select('email, escopos, tasklist_id, opcoes, ultima_sync, ultimo_erro').maybeSingle();
  return (data as IntegracaoGoogle) ?? null;
}

/** Vai para a tela de autorização do Google. */
export async function conectarGoogle() {
  const { url } = await chamar<{ url: string }>('google-oauth', { action: 'url', redirect_uri: retornoGoogle() });
  window.location.href = url;
}

export const trocarCodigoGoogle = (code: string, state: string) =>
  chamar<{ ok: boolean; email: string | null; tarefas: boolean }>('google-oauth', { action: 'trocar', code, state, redirect_uri: retornoGoogle() });

export const desconectarGoogle = () => chamar('google-oauth', { action: 'desconectar' });

export async function salvarOpcoesGoogle(opcoes: OpcoesGoogle) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('google_integracoes').update({ opcoes }).not('user_id', 'is', null);
  if (error) throw error;
}

export const sincronizarGoogle = () => chamar<{ ok: boolean; erro?: string }>('google-sync', { action: 'sincronizar' });

/** Dispara a sincronização sem esperar (depois de criar/editar compromisso ou tarefa). */
export function sincronizarGoogleEmSegundoPlano() {
  statusGoogle().then((s) => { if (s) sincronizarGoogle().catch(() => {}); }).catch(() => {});
}

export const listasTarefasGoogle = () => chamar<{ listas: ListaTarefas[] }>('google-sync', { action: 'listas' });

/** Listas sincronizadas com nome, na ordem: padrão primeiro. */
export function listasEscolhidas(integ: IntegracaoGoogle | null): { id: string; nome: string }[] {
  if (!integ?.tasklist_id) return [];
  const nomes = integ.opcoes?.listas_nomes || {};
  const ids = [...new Set([integ.tasklist_id, ...(integ.opcoes?.listas || [])])];
  const padrao = integ.opcoes?.lista_padrao && ids.includes(integ.opcoes.lista_padrao) ? integ.opcoes.lista_padrao : integ.tasklist_id;
  return ids.map((id) => ({ id, nome: nomes[id] || (id === integ.tasklist_id ? 'BALANX' : 'Lista') }))
    .sort((a, b) => (a.id === padrao ? -1 : b.id === padrao ? 1 : 0));
}

export const agendaPessoal = (inicio: string, fim: string) =>
  chamar<{ eventos: EventoPessoal[]; sem_permissao?: boolean }>('google-sync', { action: 'agenda-pessoal', inicio, fim });
