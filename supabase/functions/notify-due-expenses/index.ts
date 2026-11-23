// Briefing do dia (8h): um aviso no celular para cada pessoa com notificações ligadas,
// com a agenda, o que vence hoje (pagar/receber), tarefas e cobranças vencidas da empresa
// que ela está usando. Ao tocar, abre a IARA já com o resumo completo (/iara?resumo=hoje).
// Dias úteis: sempre (mesmo "dia livre"); fim de semana: só se houver algo.
// Chamado pelo pg_cron às 11:00 UTC (~08:00 BRT). Protegido por CRON_SECRET.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { p256 } from 'npm:@noble/curves@2.2.0/nist.js';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const RAW_SUBJECT = (Deno.env.get('VAPID_SUBJECT') || 'mailto:no-reply@pixify.company').trim().replace(/\s+/g, '');
const VAPID_SUBJECT = /^(mailto:|https?:\/\/)/.test(RAW_SUBJECT) ? RAW_SUBJECT : `mailto:${RAW_SUBJECT}`;

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function derivePublicKey(privateKey: string): string {
  const padding = '='.repeat((4 - (privateKey.length % 4)) % 4);
  const base64 = (privateKey + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const secretKey = Uint8Array.from(raw, (char) => char.charCodeAt(0));
  return toBase64Url(p256.getPublicKey(secretKey, false));
}

const VAPID_PUBLIC = derivePublicKey(VAPID_PRIVATE);

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

function todayInSP(): string {
  // YYYY-MM-DD in America/Sao_Paulo
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(new Date());
}

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const CRON_SECRET = Deno.env.get('CRON_SECRET');
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const horaSP = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).replace(':00', 'h').replace(':', 'h');
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// deno-lint-ignore no-explicit-any
async function briefing(admin: any, tenantId: string, userId: string, hoje: string) {
  const amanha = new Date(Date.parse(hoje + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  const [desp, rec, comp, tar, cobs] = await Promise.all([
    admin.from('despesas').select('valor, fornecedor, data_vencimento').eq('tenant_id', tenantId)
      .in('status', ['pendente', 'atrasado']).is('fatura_id', null).lte('data_vencimento', hoje).limit(1000),
    admin.from('receitas').select('valor').eq('tenant_id', tenantId).in('status', ['pendente', 'atrasado']).eq('data_vencimento', hoje).limit(1000),
    admin.from('agenda_itens').select('titulo, data, inicio, dia_inteiro').eq('tenant_id', tenantId).eq('tipo', 'compromisso')
      .or(`data.eq.${hoje},and(inicio.gte.${hoje}T00:00:00-03:00,inicio.lte.${hoje}T23:59:59-03:00)`).limit(50),
    admin.from('agenda_itens').select('id, data').eq('tenant_id', tenantId).eq('tipo', 'tarefa').eq('concluida', false).lte('data', amanha).limit(200),
    // cobranças não têm tenant_id: filtra pelo dono.
    admin.from('cobrancas').select('id, valor, asaas_payment_id').eq('user_id', userId).eq('status', 'vencido').limit(500),
  ]);
  // deno-lint-ignore no-explicit-any
  const d = ((desp.data || []) as any[]).filter((x) => x.fornecedor !== '[pagamento-fatura]');
  const pagarHoje = d.filter((x) => x.data_vencimento === hoje);
  const atrasadas = d.filter((x) => x.data_vencimento < hoje);
  const soma = (a: { valor: number }[]) => a.reduce((s, x) => s + Number(x.valor || 0), 0);
  // deno-lint-ignore no-explicit-any
  const compromissos = ((comp.data || []) as any[]).sort((a, b) => String(a.inicio || '').localeCompare(String(b.inicio || '')));
  // deno-lint-ignore no-explicit-any
  const vencidas = new Set(((cobs.data || []) as any[]).map((c) => c.asaas_payment_id || c.id)).size;
  const partes: string[] = [];
  if (compromissos.length) {
    const primeiro = compromissos.find((c) => c.inicio && !c.dia_inteiro);
    partes.push(`${plural(compromissos.length, 'compromisso', 'compromissos')}${primeiro ? ` (${compromissos.length > 1 ? '1º ' : ''}às ${horaSP(primeiro.inicio)})` : ''}`);
  }
  if (pagarHoje.length) partes.push(`pagar ${brl(soma(pagarHoje))} (${pagarHoje.length})`);
  if ((rec.data || []).length) partes.push(`receber ${brl(soma(rec.data))} (${rec.data.length})`);
  // deno-lint-ignore no-explicit-any
  const tarefas = (tar.data || []) as any[];
  const tarHoje = tarefas.filter((t) => t.data <= hoje).length;
  const tarAmanha = tarefas.filter((t) => t.data === amanha).length;
  if (tarHoje) partes.push(plural(tarHoje, 'tarefa', 'tarefas'));
  if (tarAmanha) partes.push(`${plural(tarAmanha, 'tarefa vence', 'tarefas vencem')} amanhã`);
  if (atrasadas.length) partes.push(`${plural(atrasadas.length, 'conta atrasada', 'contas atrasadas')} (${brl(soma(atrasadas))})`);
  if (vencidas) partes.push(plural(vencidas, 'cobrança vencida', 'cobranças vencidas'));
  return partes;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const today = todayInSP();
  const diaSemana = new Date(today + 'T12:00:00Z').getUTCDay();
  const fimDeSemana = diaSemana === 0 || diaSemana === 6;

  const { data: profiles, error: pErr } = await admin
    .from('profiles').select('user_id, nome, current_tenant_id').eq('push_enabled', true);
  if (pErr) return json({ error: pErr.message }, 500);

  let sent = 0, failed = 0, skipped = 0;
  // Um usuário por vez demoraria demais com muitos usuários: processa em grupos de 10 em paralelo.
  const umUsuario = async (p: { user_id: string; nome: string | null; current_tenant_id: string | null }) => {
    // Empresa que a pessoa está usando (ou a primeira da qual participa).
    let tenantId = p.current_tenant_id;
    if (!tenantId) {
      const { data: m } = await admin.from('tenant_members').select('tenant_id').eq('user_id', p.user_id).order('created_at').limit(1);
      tenantId = m?.[0]?.tenant_id ?? null;
    }
    if (!tenantId) { skipped++; return; }

    const partes = await briefing(admin, tenantId, p.user_id, today);
    if (!partes.length && fimDeSemana) { skipped++; return; }

    const primeiroNome = (p.nome || '').trim().split(/\s+/)[0];
    const [, mm, dd] = today.split('-');
    const payload = JSON.stringify({
      title: `${primeiroNome ? `Bom dia, ${primeiroNome}!` : 'Bom dia!'} ${diaSemana === 0 || diaSemana === 6 ? 'Seu' : 'Sua'} ${DIAS[diaSemana]}, ${dd}/${mm}`,
      body: partes.length ? `${partes.join(' · ')}. Toque para o resumo.` : 'Nada vence hoje e a agenda está livre. Toque para o resumo.',
      url: '/iara?resumo=hoje',
      tag: `briefing-${today}`,
    });

    const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', p.user_id);
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (e) {
        failed++;
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
        console.error('push fail', status, (e as Error).message);
      }
    }
    };
  const lista = (profiles ?? []) as { user_id: string; nome: string | null; current_tenant_id: string | null }[];
  for (let i = 0; i < lista.length; i += 10) {
    await Promise.all(lista.slice(i, i + 10).map((p) => umUsuario(p).catch((e) => { failed++; console.error('briefing', (e as Error).message); })));
  }
  return json({ ok: true, sent, failed, skipped, today });
});
