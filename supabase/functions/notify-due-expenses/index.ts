// Daily job: notifies each user (with push_enabled=true) about their pending
// expenses whose data_vencimento = today (timezone America/Sao_Paulo).
// Triggered by pg_cron at 11:00 UTC (~08:00 BRT).

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const today = todayInSP();

  // 1. users who opted-in
  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('user_id, nome')
    .eq('push_enabled', true);
  if (pErr) {
    return new Response(JSON.stringify({ error: pErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let sent = 0, failed = 0, skipped = 0;

  for (const p of profiles ?? []) {
    const userId = (p as { user_id: string }).user_id;

    // 2. pending expenses due today (exclude card-related shadow rows)
    const { data: despesas } = await admin
      .from('despesas')
      .select('id, descricao, valor, fornecedor, fatura_id')
      .eq('user_id', userId)
      .eq('status', 'pendente')
      .eq('data_vencimento', today);

    const real = (despesas ?? []).filter(
      (d) => !(d as { fatura_id?: string | null }).fatura_id
        && (d as { fornecedor?: string }).fornecedor !== '[pagamento-fatura]',
    );
    if (real.length === 0) { skipped++; continue; }

    const total = real.reduce((s, d) => s + Number((d as { valor: number }).valor), 0);
    const title = real.length === 1
      ? `Vence hoje: ${brl(Number(real[0].valor))}`
      : `${real.length} despesas vencem hoje`;
    const body = real.length === 1
      ? `${(real[0] as { descricao: string }).descricao}`
      : `Total ${brl(total)} — toque para ver`;

    const payload = JSON.stringify({
      title: `PIXIFYNANCE — ${title}`,
      body,
      url: '/fluxo-caixa?status=pendente',
      tag: `due-${today}`,
    });

    // 3. subscriptions
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        failed++;
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Subscription expired/invalid → remove
          await admin.from('push_subscriptions').delete().eq('id', s.id);
        }
        console.error('push fail', s.endpoint, status, (e as Error).message);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, failed, skipped, today }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
