// Web Push subscription helpers for balanx.
// On iOS, requires the app to be added to the home screen (PWA) for Notification API to be available.

import { supabase } from '@/integrations/supabase/client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('vapid-public-key');
    if (error || !data?.publicKey) return null;
    return data.publicKey as string;
  } catch {
    return null;
  }
}

export async function subscribeForPush(userId: string): Promise<{ error: Error | null }> {
  if (!isPushSupported()) {
    return { error: new Error('Notificações push não são suportadas neste dispositivo. No iPhone, adicione o app à tela inicial pelo Safari.') };
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { error: new Error('Permissão negada pelo navegador') };

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const vapid = await getVapidPublicKey();
  if (!vapid) return { error: new Error('Não foi possível obter a chave de notificações do servidor') };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = urlBase64ToUint8Array(vapid);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
    });
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const endpoint = json.endpoint || sub.endpoint;
  const p256dh = json.keys?.p256dh || bufToBase64(sub.getKey('p256dh'));
  const auth = json.keys?.auth || bufToBase64(sub.getKey('auth'));

  // Avoid duplicates: clear any existing row with the same endpoint first.
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  const { error } = await supabase
    .from('push_subscriptions')
    .insert({ user_id: userId, endpoint, p256dh, auth, platform: navigator.userAgent.slice(0, 120) });

  return { error: error as Error | null };
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
  } catch {
    /* noop */
  }
}
