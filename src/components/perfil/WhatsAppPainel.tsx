// Meu Perfil → WhatsApp: a empresa conecta o PRÓPRIO número. Cobranças e lembretes
// saem dele. Pareamento por código de 8 caracteres (sem QR), confirmado por polling.
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, Loader2, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface Status { conectado: boolean; estado: string | null; numero: string | null }

async function chamar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('whatsapp-conexao', { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

const foneBR = (n?: string | null) => {
  const d = String(n || '').replace(/\D/g, '').replace(/^55/, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : n || '';
};

export function WhatsAppPainel({ onChange }: { onChange?: () => void }) {
  const [st, setSt] = useState<Status | null | undefined>(undefined);
  const [fone, setFone] = useState('');
  const [codigo, setCodigo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);

  const carregar = () => chamar<Status>({ action: 'status' }).then((s) => { setSt(s); return s; }).catch(() => { setSt(null); return null; });
  useEffect(() => { carregar(); return () => { if (timer.current) window.clearInterval(timer.current); }; }, []);

  // Enquanto o código está na tela, confere a cada 3 s se o celular já conectou.
  useEffect(() => {
    if (!codigo) return;
    timer.current = window.setInterval(async () => {
      const s = await carregar();
      if (s?.conectado) {
        if (timer.current) window.clearInterval(timer.current);
        setCodigo(null);
        toast.success('WhatsApp conectado!');
        onChange?.();
      }
    }, 3000);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [codigo]); // eslint-disable-line react-hooks/exhaustive-deps

  const conectar = async () => {
    setBusy(true);
    try { const r = await chamar<{ code: string }>({ action: 'conectar', telefone: fone }); setCodigo(r.code); }
    catch (e) { toast.error('Não deu para conectar', { description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(false); }
  };
  const desconectar = async () => {
    if (!window.confirm('Desconectar este WhatsApp? Cobranças e lembretes param de sair por ele até você conectar de novo.')) return;
    setBusy(true);
    try { await chamar({ action: 'desconectar' }); setCodigo(null); await carregar(); onChange?.(); toast.success('WhatsApp desconectado'); }
    catch (e) { toast.error('Erro', { description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(false); }
  };

  if (st === undefined) return <div className="flex items-center gap-2 py-6 text-sm text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;
  if (st === null) return <p className="py-4 text-[13px] text-foreground-muted">Não deu para carregar agora. Tente de novo em instantes.</p>;

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-foreground-muted">
        Conecte o WhatsApp da sua empresa: as cobranças e os lembretes automáticos saem <b>do seu número</b>, e o cliente responde para você.
        O BALANX só envia, não lê suas conversas.
      </p>

      {st.conectado ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-border p-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success-fg" />
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-foreground">Conectado</p>
              <p className="text-[12.5px] text-foreground-muted">{foneBR(st.numero)}</p>
            </div>
          </div>
          <Button variant="outline" className="h-11 w-full rounded-full text-danger-fg" onClick={desconectar} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />} Desconectar
          </Button>
        </div>
      ) : codigo ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-foreground-muted">Seu código</p>
            <button type="button" onClick={() => { navigator.clipboard.writeText(codigo); toast.success('Código copiado'); }}
              className="mt-1 inline-flex items-center gap-2 font-mono text-[28px] tracking-[0.18em] text-foreground">
              {codigo.slice(0, 4)}-{codigo.slice(4)} <Copy className="h-4 w-4 text-foreground-muted" />
            </button>
          </div>
          <ol className="space-y-1.5 text-[12.5px] leading-snug text-foreground">
            <li>1. No celular, abra o <b>WhatsApp</b> → <b>Configurações</b> (ou ⋮) → <b>Aparelhos conectados</b>.</li>
            <li>2. Toque em <b>Conectar aparelho</b> → <b>Conectar com número de telefone</b>.</li>
            <li>3. Digite o código acima.</li>
          </ol>
          <p className="flex items-center gap-2 text-[12px] text-foreground-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Esperando o celular confirmar…</p>
          <Button variant="ghost" className="w-full rounded-full" onClick={() => setCodigo(null)}>Cancelar</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-foreground-muted">WhatsApp da empresa (com DDD)</label>
            <Input inputMode="tel" placeholder="(65) 99999-0000" value={fone} onChange={(e) => setFone(e.target.value)} />
          </div>
          <Button className="h-11 w-full rounded-full font-medium bg-foreground text-background hover:bg-foreground/90" onClick={conectar} disabled={busy || fone.replace(/\D/g, '').length < 10}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Gerar código de conexão
          </Button>
          <p className="text-[11.5px] leading-snug text-foreground-muted">
            Use o WhatsApp (ou WhatsApp Business) do número que seus clientes já conhecem. Ele continua funcionando normal no seu celular.
          </p>
        </div>
      )}
    </div>
  );
}
