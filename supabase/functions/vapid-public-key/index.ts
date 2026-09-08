// Returns the VAPID public key so the browser can subscribe to Web Push.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { p256 } from 'npm:@noble/curves@2.2.0/nist.js';

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const configuredPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  let publicKey = configuredPublicKey;

  if (privateKey) {
    try {
      const padding = '='.repeat((4 - (privateKey.length % 4)) % 4);
      const base64 = (privateKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(base64);
      const secretKey = Uint8Array.from(raw, (char) => char.charCodeAt(0));
      publicKey = toBase64Url(p256.getPublicKey(secretKey, false));
    } catch (error) {
      console.error('Failed to derive VAPID public key from private key', error);
    }
  }

  return new Response(JSON.stringify({ publicKey }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
