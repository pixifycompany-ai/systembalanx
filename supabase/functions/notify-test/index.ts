// Sends an immediate test push notification to all subscriptions of the calling user.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { p256 } from 'npm:@noble/curves@2.2.0/nist.js';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
// Apple rejects subjects with stray whitespace or invalid scheme. Normalize defensively.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const adminKey = req.headers.get('x-admin-key') || '';

    let userId: string | null = null;
    let body: { user_id?: string } = {};
    try { body = await req.json(); } catch { /* no body */ }

    if (body.user_id && (token === SERVICE_ROLE || adminKey === SERVICE_ROLE)) {
      userId = body.user_id;
    } else {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Não autenticado' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = user.id;
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);
    if (error) throw error;

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, failed: 0, message: 'Nenhuma inscrição ativa.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title: 'PIXIFYNANCE',
      body: 'Notificação de teste — está funcionando!',
      url: '/',
      tag: `test-${Date.now()}`,
    });

    let sent = 0, failed = 0;
    const failures: Array<{ status?: number; body?: string; host?: string }> = [];
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        failed++;
        const err = e as { statusCode?: number; body?: string; headers?: unknown; message?: string };
        const host = (() => { try { return new URL(s.endpoint).host; } catch { return ''; } })();
        failures.push({ status: err.statusCode, body: (err.body || err.message || '').toString().slice(0, 400), host });
        if (err.statusCode === 404 || err.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id);
        }
        console.error('push test fail', host, err.statusCode, err.body || err.message);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, failures, vapid_subject: VAPID_SUBJECT }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
