// Pausa de contrato: entre pausado_desde e pausado_ate (vazio = até reativar)
// o contrato não gera receitas e, com assinatura no Asaas, não cobra.
// Com assinatura, quem aplica é a edge function (suspende/reativa no Asaas e
// cancela as cobranças aguardando do período); sem assinatura, basta gravar as
// datas — o banco apaga as receitas em aberto do período e regera ao reativar.
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/utils/formatters';

export interface ContratoPausavel {
  id: string;
  asaas_subscription_id?: string | null;
  pausado_desde?: string | null;
  pausado_ate?: string | null;
}

export type EstadoPausa = 'pausado' | 'agendada' | null;

export function estadoPausa(c: ContratoPausavel, hoje = format(new Date(), 'yyyy-MM-dd')): EstadoPausa {
  if (!c.pausado_desde) return null;
  if (c.pausado_ate && c.pausado_ate < hoje) return null;
  return c.pausado_desde <= hoje ? 'pausado' : 'agendada';
}

export function descreverPausa(c: ContratoPausavel, hoje?: string): string | null {
  const e = estadoPausa(c, hoje);
  if (!e) return null;
  const ate = c.pausado_ate ? `até ${formatDate(c.pausado_ate)}` : 'até você reativar';
  return e === 'pausado'
    ? `Pausado desde ${formatDate(c.pausado_desde!)}, ${ate}`
    : `Pausa marcada a partir de ${formatDate(c.pausado_desde!)}, ${ate}`;
}

async function viaAsaas(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('asaas-cobranca', { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* corpo não-JSON */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as { ok: boolean; canceladas?: number; asaasSuspenso?: boolean };
}

export async function pausarContrato(c: ContratoPausavel, desde: string, ate: string | null) {
  if (ate && ate < desde) throw new Error('A data final da pausa é antes do início.');
  if (c.asaas_subscription_id) return viaAsaas({ action: 'pausar-contrato', contrato_id: c.id, desde, ate });
  const { error } = await supabase.from('contratos').update({ pausado_desde: desde, pausado_ate: ate, gerar_receitas: true } as never).eq('id', c.id);
  if (error) throw error;
  return { ok: true, canceladas: 0 };
}

export async function reativarContrato(c: ContratoPausavel) {
  if (c.asaas_subscription_id) return viaAsaas({ action: 'reativar-contrato', contrato_id: c.id });
  const { error } = await supabase.from('contratos').update({ pausado_desde: null, pausado_ate: null, asaas_pausado: false } as never).eq('id', c.id);
  if (error) throw error;
  return { ok: true };
}
