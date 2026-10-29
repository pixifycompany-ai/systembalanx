import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BalanxLoader } from '@/components/shared/BalanxLoader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Exige o 2º fator (código TOTP) quando a sessão é aal1 mas o usuário tem um fator
 * verificado (nextLevel = aal2). Para quem NÃO usa 2FA, nextLevel é aal1 → passa direto,
 * sem nenhuma mudança no login. Fail-open em erro (não trava o app por hiccup do MFA).
 */
export function MfaGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<'checking' | 'ok' | 'challenge'>('checking');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [err, setErr] = useState('');

  const check = async () => {
    try {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
        const { data: f } = await supabase.auth.mfa.listFactors();
        const totp = (f?.totp || []).find((x) => x.status === 'verified') || (f?.totp || [])[0];
        setFactorId(totp?.id ?? null);
        setState(totp?.id ? 'challenge' : 'ok');
      } else {
        setState('ok');
      }
    } catch {
      setState('ok'); // não bloqueia o app por erro no MFA
    }
  };

  useEffect(() => { check(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const verify = async () => {
    if (!factorId || code.trim().length < 6) return;
    setVerifying(true); setErr('');
    try {
      const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId });
      if (ce || !ch) throw new Error('challenge');
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
      if (error) { setErr('Código inválido. Tente novamente.'); setCode(''); setVerifying(false); return; }
      setCode(''); setVerifying(false); setState('checking'); check();
    } catch {
      setErr('Não consegui verificar agora. Tente de novo.'); setVerifying(false);
    }
  };

  const sair = async () => { await supabase.auth.signOut(); navigate('/login', { replace: true }); };

  if (state === 'checking') return <BalanxLoader />;
  if (state === 'ok') return <>{children}</>;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-surface/70 p-6 backdrop-blur-xl">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Verificação em duas etapas</h1>
        <p className="mt-1 text-sm text-foreground-muted">Digite o código de 6 dígitos do seu app autenticador.</p>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoFocus
          placeholder="000000"
          onKeyDown={(e) => { if (e.key === 'Enter') verify(); }}
          className="mt-4 h-12 text-center text-lg tracking-[0.3em] tabular-nums"
        />
        {err && <p className="mt-2 text-xs text-[hsl(var(--danger))]">{err}</p>}
        <Button className="mt-4 w-full" onClick={verify} disabled={verifying || code.length < 6}>
          {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Verificar
        </Button>
        <button onClick={sair} className="mt-3 w-full text-center text-xs font-medium text-foreground-muted hover:text-foreground">
          Sair
        </button>
      </div>
    </div>
  );
}
