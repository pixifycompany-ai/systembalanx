import { useEffect, useState } from 'react';
import { ShieldCheck, Trash2, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Factor { id: string; friendly_name?: string | null; status: string }

/** Cadastro e remoção de 2FA (TOTP) do Supabase Auth. Usado no Meu Perfil. */
export function MfaManager() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  // enroll em andamento
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [nome, setNome] = useState('Meu autenticador');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp || []) as Factor[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const iniciar = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: nome.trim() || undefined });
    setBusy(false);
    if (error || !data) { toast.error(error?.message || 'Erro ao iniciar o cadastro.'); return; }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode('');
  };

  const confirmar = async () => {
    if (!enroll || code.trim().length < 6) return;
    setBusy(true);
    const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: enroll.id });
    if (ce || !ch) { setBusy(false); toast.error('Erro ao verificar. Tente de novo.'); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId: enroll.id, challengeId: ch.id, code: code.trim() });
    setBusy(false);
    if (error) { toast.error('Código inválido. Confira o horário do celular e tente de novo.'); setCode(''); return; }
    toast.success('Verificação em duas etapas ativada!');
    setEnroll(null); setCode('');
    await load();
  };

  const cancelarEnroll = async () => {
    if (enroll) { try { await supabase.auth.mfa.unenroll({ factorId: enroll.id }); } catch { /* noop */ } }
    setEnroll(null); setCode('');
  };

  const remover = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) { toast.error('Para remover, faça login com o código 2FA primeiro.'); return; }
    toast.success('Fator removido.');
    await load();
  };

  const verificados = factors.filter((f) => f.status === 'verified');

  if (loading) return <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-foreground-muted" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-surface-2/40 px-3 py-2.5 text-[12px] text-foreground-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        Um código que muda a cada 30s no seu app (Google Authenticator, 1Password, Authy…). Pedido no login além da senha.
      </div>

      {/* Fatores já cadastrados */}
      {verificados.length > 0 && (
        <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 bg-surface/50">
          {verificados.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <ShieldCheck className="h-4 w-4 text-[hsl(var(--success))]" />
                {f.friendly_name || 'Autenticador'}
              </div>
              <button onClick={() => remover(f.id)} disabled={busy} aria-label="Remover" className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger))]/10 disabled:opacity-50">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Cadastro novo */}
      {!enroll ? (
        <div className="space-y-2">
          <Label className="text-xs">Nome do fator</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Celular, 1Password" />
          <Button onClick={iniciar} disabled={busy} className="w-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Cadastrar autenticador
          </Button>
          {verificados.length === 0 && <p className="text-[11px] text-foreground-muted">Dica: cadastre dois (app do celular + gerenciador de senhas) para não perder o acesso.</p>}
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/[0.04] p-3">
          <p className="text-[12px] font-semibold text-foreground">1. Escaneie o QR no seu app autenticador</p>
          <div className="flex justify-center rounded-lg bg-white p-3">
            {/* qr_code vem como SVG (data URI) do Supabase */}
            <img src={enroll.qr} alt="QR Code 2FA" className="h-44 w-44" />
          </div>
          <p className="text-[11px] text-foreground-muted">Ou digite a chave manualmente:</p>
          <code className="block select-all break-all rounded-lg border border-border/60 bg-surface px-2.5 py-2 text-[12px] text-foreground">{enroll.secret}</code>
          <div>
            <Label className="text-xs">2. Digite o código de 6 dígitos</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="000000" className="mt-1 h-11 text-center text-lg tracking-[0.3em] tabular-nums" onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); }} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={cancelarEnroll} disabled={busy}>Cancelar</Button>
            <Button className="flex-1" onClick={confirmar} disabled={busy || code.length < 6}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Ativar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
