import { useEffect, useState } from 'react';
import { ShieldCheck, Trash2, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Bloco, Campo, Linha, Secao } from '@/components/reskin/kit';
import { btn, campoCls } from '@/components/reskin/estilos';
import { cn } from '@/lib/utils';
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
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-2xl bg-surface-2/70 p-3.5 text-[13px] text-foreground-muted">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-foreground"><ShieldCheck className="h-4 w-4" /></span>
        Um código que muda a cada 30s no seu app (Google Authenticator, 1Password, Authy…). Ele é pedido no login, além da senha.
      </div>

      {/* Fatores já cadastrados */}
      {verificados.length > 0 && (
        <Bloco title="Autenticadores ativos">
          {verificados.map((f) => (
            <Linha
              key={f.id}
              icon={<ShieldCheck className="h-4 w-4 text-success-fg" />}
              title={f.friendly_name || 'Autenticador'}
              sub="ativo"
              action={(
                <button type="button" onClick={() => remover(f.id)} disabled={busy} aria-label="Remover autenticador" title="Remover" className="grid h-8 w-8 place-items-center rounded-full text-danger-fg hover:bg-danger-bg disabled:opacity-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            />
          ))}
        </Bloco>
      )}

      {/* Cadastro novo */}
      {!enroll ? (
        <Bloco title={verificados.length ? 'Cadastrar outro' : 'Cadastrar autenticador'}>
          <div className="space-y-3">
            <Campo label="Nome do autenticador">
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Celular, 1Password" className={campoCls} />
            </Campo>
            <button type="button" onClick={iniciar} disabled={busy} className={cn(btn.primary, 'w-full')}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Cadastrar autenticador
            </button>
            {verificados.length === 0 && <p className="text-[12px] text-foreground-muted">Dica: cadastre dois (app do celular + gerenciador de senhas) para não perder o acesso.</p>}
          </div>
        </Bloco>
      ) : (
        <div className="space-y-3">
          <Secao n={1} title="Escaneie o QR no app autenticador">
            <div className="flex justify-center rounded-2xl bg-white p-3">
              {/* qr_code vem como SVG (data URI) do Supabase */}
              <img src={enroll.qr} alt="QR Code 2FA" className="h-44 w-44" />
            </div>
            <Campo label="Ou digite a chave manualmente">
              <code className="block select-all break-all rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-[12.5px] text-foreground">{enroll.secret}</code>
            </Campo>
          </Secao>
          <Secao n={2} title="Digite o código de 6 dígitos">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              aria-label="Código de 6 dígitos"
              className={cn(campoCls, 'h-12 text-center font-heading text-[20px] tracking-[0.3em] tabular-nums')}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); }}
            />
            <div className="flex gap-2">
              <button type="button" onClick={cancelarEnroll} disabled={busy} className={cn(btn.outline, 'flex-1')}>Cancelar</button>
              <button type="button" onClick={confirmar} disabled={busy || code.length < 6} className={cn(btn.primary, 'flex-1')}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Ativar
              </button>
            </div>
          </Secao>
        </div>
      )}
    </div>
  );
}
