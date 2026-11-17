// Meu Perfil → Integrações → Atalho do iPhone: falar com a IARA tocando 2x atrás do celular.
// A chave pessoal aparece UMA vez (o servidor guarda só o hash).
import { useEffect, useState } from 'react';
import { Check, ChevronDown, Copy, Download, KeyRound, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface StatusAtalho { ativa: boolean; prefixo?: string; created_at?: string; ultimo_uso?: string | null; url: string }

async function chamar<T>(action: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke('iara-atalho', { body: { action } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

const dataHora = (iso?: string | null) => iso
  ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';

function Copiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button"
      onClick={async () => { await navigator.clipboard.writeText(valor); setOk(true); toast.success(`${rotulo} copiado`); setTimeout(() => setOk(false), 1500); }}
      className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-left hover:bg-surface-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-foreground-muted">{rotulo}</span>
        <span className="block truncate font-mono text-[12px] text-foreground">{valor}</span>
      </span>
      {ok ? <Check className="h-4 w-4 shrink-0 text-success-fg" /> : <Copy className="h-4 w-4 shrink-0 text-foreground-muted" />}
    </button>
  );
}

export function AtalhoIphonePainel() {
  const [st, setSt] = useState<StatusAtalho | null | undefined>(undefined);
  const [chave, setChave] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = () => chamar<StatusAtalho>('status').then(setSt).catch(() => setSt(null));
  useEffect(() => { carregar(); }, []);

  const gerar = async () => {
    if (st?.ativa && !window.confirm('Gerar uma chave nova? O atalho com a chave antiga para de funcionar.')) return;
    setBusy(true);
    try { const r = await chamar<{ chave: string }>('gerar'); setChave(r.chave); await carregar(); }
    catch (e) { toast.error('Não gerou a chave', { description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(false); }
  };
  const revogar = async () => {
    if (!window.confirm('Desativar o atalho? Ele para de funcionar na hora.')) return;
    setBusy(true);
    try { await chamar('revogar'); setChave(null); await carregar(); toast.success('Atalho desativado'); }
    catch (e) { toast.error('Erro', { description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(false); }
  };

  if (st === undefined) return <div className="flex items-center gap-2 py-6 text-sm text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;
  if (st === null) return <p className="py-4 text-[13px] text-foreground-muted">Não deu para carregar agora. Tente de novo em instantes.</p>;

  const manual = [
    <>No app <b>Atalhos</b>, toque em <b>+</b> e dê o nome <b>IARA</b>.</>,
    <>Adicione <b>Ditar Texto</b> (Português do Brasil · parar de ouvir: após pausa).</>,
    <>Adicione <b>Obter Conteúdo do URL</b> com o endereço abaixo. Em “Mostrar Mais”: Método <b>POST</b>; Cabeçalho <b>Authorization</b> = <b>Bearer</b> + espaço + sua chave; Corpo <b>JSON</b> com o campo <b>texto</b> = <i>Texto Ditado</i>.</>,
    <>Adicione <b>Falar Texto</b> com o <i>Conteúdo do URL</i>.</>,
  ];

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-foreground-muted">
        Toque duas vezes atrás do iPhone, fale (“os pagamentos de hoje caíram?”, “me lembra de ligar pro contador amanhã”) e a IARA responde em voz.
        Ela só consulta: o que mudar algo (cobrança, tarefa, lançamento) fica esperando você confirmar aqui, com uma notificação.
      </p>

      {chave ? (
        <div className="space-y-2 rounded-2xl border border-primary/40 bg-primary/5 p-3">
          <p className="text-[12.5px] font-semibold text-foreground">Copie agora: a chave não aparece de novo.</p>
          <Copiar rotulo="Sua chave" valor={chave} />
        </div>
      ) : st.ativa ? (
        <div className="rounded-2xl border border-border p-3 text-[12.5px] text-foreground-muted">
          <p className="flex items-center gap-1.5 font-semibold text-foreground"><KeyRound className="h-4 w-4 text-success-fg" /> Atalho ativo · chave {st.prefixo}…</p>
          <p className="mt-1">Criada em {dataHora(st.created_at)} · último uso {dataHora(st.ultimo_uso)}</p>
        </div>
      ) : null}

      <ol className="space-y-2">
        {[
          <><b>{st.ativa ? 'Gere uma chave nova' : 'Gere sua chave'}</b> no botão abaixo e copie.</>,
          <>Toque em <b>Baixar atalho</b>, abra no app Atalhos e <b>cole a chave</b> quando ele pedir.</>,
          <>Em <b>Ajustes → Acessibilidade → Toque → Tocar Atrás → Toque Duplo</b>, escolha <b>IARA</b>.</>,
        ].map((p, i) => (
          <li key={i} className="flex gap-2.5 text-[12.5px] leading-snug text-foreground">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-foreground-muted">{i + 1}</span>
            <span>{p}</span>
          </li>
        ))}
      </ol>

      <a href="/atalho/IARA.shortcut" download="IARA.shortcut"
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-surface text-[13.5px] font-semibold text-foreground hover:bg-surface-2">
        <Download className="h-4 w-4" /> Baixar atalho
      </a>

      <details className="group rounded-2xl border border-border px-3 py-2">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[12.5px] font-semibold text-foreground">
          Prefere montar o atalho à mão? <ChevronDown className="h-4 w-4 text-foreground-muted transition-transform group-open:rotate-180" />
        </summary>
        <ol className="mt-2 space-y-2">
          {manual.map((p, i) => (
            <li key={i} className="flex gap-2.5 text-[12px] leading-snug text-foreground-muted">
              <span className="w-4 shrink-0 font-semibold">{i + 1}.</span><span>{p}</span>
            </li>
          ))}
        </ol>
        <div className="mt-2"><Copiar rotulo="Endereço (URL)" valor={st.url} /></div>
      </details>

      <div className="flex gap-2 pt-1">
        <Button className="h-11 flex-1 rounded-full font-semibold" onClick={gerar} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{st.ativa ? 'Gerar chave nova' : 'Gerar minha chave'}
        </Button>
        {st.ativa && (
          <Button variant="outline" className="h-11 rounded-full text-danger-fg" onClick={revogar} disabled={busy} aria-label="Desativar atalho">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-[11px] leading-snug text-foreground-muted">
        A chave dá acesso só à IARA, com os mesmos dados que você vê no app. Guardamos apenas uma impressão dela (hash). Se perder o celular, desative aqui.
      </p>
    </div>
  );
}
