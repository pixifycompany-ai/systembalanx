// Lembrete na hora dos compromissos (aviso no celular), ex.: "Daqui a 30 min: Reunião com a Sabor Maria".
// Usa o "Lembrete" do compromisso (vazio = 30 min antes). Compromisso de dia inteiro fica no
// briefing das 8h. Não repete: grava em lembrete_enviado_para o horário já avisado (se remarcar, avisa de novo).
// Chamado pelo pg_cron a cada 5 minutos. Protegido por CRON_SECRET.
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

const CRON_SECRET = Deno.env.get('CRON_SECRET');
const PADRAO_MIN = 30;
const JANELA_MS = 10 * 60 * 1000; // tolerância (cron de 5 em 5 min + atraso)
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
function antecedencia(min: number) {
  if (min <= 0) return 'Agora';
  if (min >= 1440) return min === 1440 ? 'Amanhã' : `Em ${Math.round(min / 1440)} dias`;
  if (min >= 60) return min === 60 ? 'Daqui a 1 hora' : `Daqui a ${Math.round(min / 60)} horas`;
  return `Daqui a ${min} min`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'unauthorized' }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const agora = Date.now();

  // Compromissos com horário nas próximas 24h (+ janela), ainda não avisados para este horário.
  const { data: itens, error } = await admin.from('agenda_itens')
    .select('id, user_id, titulo, inicio, fim, lembrete_min, lembrete_enviado_para, cliente:clientes(nome)')
    .eq('tipo', 'compromisso').eq('dia_inteiro', false).not('inicio', 'is', null)
    .gte('inicio', new Date(agora - JANELA_MS).toISOString())
    .lte('inicio', new Date(agora + 1440 * 60000 + JANELA_MS).toISOString())
    .limit(2000);
  if (error) return json({ error: error.message }, 500);

  // deno-lint-ignore no-explicit-any
  const devidos = ((itens || []) as any[]).filter((it) => {
    const ini = Date.parse(it.inicio);
    const min = it.lembrete_min ?? PADRAO_MIN;
    const avisarEm = ini - min * 60000;
    const jaAvisado = it.lembrete_enviado_para && Date.parse(it.lembrete_enviado_para) === ini;
    // Passou da hora de avisar e o compromisso ainda não começou (cobre também o marcado em cima da hora).
    return !jaAvisado && agora >= avisarEm && agora < ini + 5 * 60000;
  });
  if (!devidos.length) return json({ ok: true, enviados: 0 });

  const usuarios = [...new Set(devidos.map((d) => d.user_id))];
  const [{ data: perfis }, { data: subs }] = await Promise.all([
    admin.from('profiles').select('user_id, push_enabled').in('user_id', usuarios),
    admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', usuarios),
  ]);
  // deno-lint-ignore no-explicit-any
  const comPush = new Set(((perfis || []) as any[]).filter((p) => p.push_enabled).map((p) => p.user_id));

  let enviados = 0, falhas = 0;
  for (const it of devidos) {
    // Marca antes de enviar: se o envio falhar, não fica tentando a cada 5 minutos.
    await admin.from('agenda_itens').update({ lembrete_enviado_para: it.inicio }).eq('id', it.id);
    if (!comPush.has(it.user_id)) continue;
    const min = Math.max(0, Math.round((Date.parse(it.inicio) - agora) / 60000));
    const payload = JSON.stringify({
      title: `${antecedencia(min >= 1380 ? 1440 : min)}: ${it.titulo}`,
      body: `${hora(it.inicio)}${it.fim ? `–${hora(it.fim)}` : ''}${it.cliente?.nome ? ` · ${it.cliente.nome}` : ''}`,
      url: '/calendario',
      tag: `lembrete-${it.id}`,
    });
    // deno-lint-ignore no-explicit-any
    for (const s of ((subs || []) as any[]).filter((x) => x.user_id === it.user_id)) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        enviados++;
      } catch (e) {
        falhas++;
        const st = (e as { statusCode?: number }).statusCode;
        if (st === 404 || st === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
      }
    }
  }
  return json({ ok: true, devidos: devidos.length, enviados, falhas });
});
