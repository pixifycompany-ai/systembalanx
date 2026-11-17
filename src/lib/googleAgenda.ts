// Integração Google Agenda + Tarefas (lado do app).
import { supabase } from '@/integrations/supabase/client';

export interface OpcoesGoogle {
  pagar: boolean; receber: boolean; compromissos: boolean; fatura: boolean; tarefas: boolean; pessoal: boolean;
}
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

export const agendaPessoal = (inicio: string, fim: string) =>
  chamar<{ eventos: EventoPessoal[]; sem_permissao?: boolean }>('google-sync', { action: 'agenda-pessoal', inicio, fim });
