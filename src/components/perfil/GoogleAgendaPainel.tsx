// Meu Perfil → Integrações → Google Agenda e Tarefas.
import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Unplug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { formatDate } from '@/utils/formatters';
import {
  conectarGoogle, desconectarGoogle, listasTarefasGoogle, salvarOpcoesGoogle, sincronizarGoogle, statusGoogle,
  type IntegracaoGoogle, type ListaTarefas, type OpcoesGoogle,
} from '@/lib/googleAgenda';

const OPCOES: { k: keyof OpcoesGoogle; titulo: string; sub: string }[] = [
  { k: 'pagar', titulo: 'Contas a pagar', sub: 'Cada vencimento vira um evento de dia inteiro' },
  { k: 'receber', titulo: 'Recebimentos e cobranças', sub: 'O que você tem a receber, por dia' },
  { k: 'compromissos', titulo: 'Compromissos', sub: 'Reuniões e lembretes criados no BALANX' },
  { k: 'fatura', titulo: 'Vencimento da fatura do cartão', sub: 'Um evento por fatura' },
  { k: 'tarefas', titulo: 'Tarefas', sub: 'Na lista "BALANX" do Google Tarefas' },
  { k: 'pessoal', titulo: 'Mostrar minha agenda pessoal no Calendário', sub: 'Só leitura, em cinza' },
];

const quando = (iso: string) => {
  const d = new Date(iso);
  return `${formatDate(iso.slice(0, 10))} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

export function GoogleAgendaPainel({ onChange }: { onChange?: () => void }) {
  const [integ, setInteg] = useState<IntegracaoGoogle | null | undefined>(undefined);
  const [busy, setBusy] = useState<'' | 'conectar' | 'sync' | 'sair'>('');
  const [listas, setListas] = useState<ListaTarefas[] | null>(null);
  useEffect(() => {
    if (!integ?.tasklist_id) return;
    listasTarefasGoogle().then((r) => setListas(r.listas || [])).catch(() => setListas([]));
  }, [integ?.tasklist_id]);

  const carregar = () => statusGoogle().then((s) => { setInteg(s); onChange?.(); }).catch(() => setInteg(null));
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const conectar = async () => {
    setBusy('conectar');
    try { await conectarGoogle(); } catch (e) { toast.error('Não deu para conectar', { description: e instanceof Error ? e.message : '' }); setBusy(''); }
  };
  const sincronizar = async () => {
    setBusy('sync');
    try {
      const r = await sincronizarGoogle();
      if (r.ok) toast.success('Agenda sincronizada');
      else toast.error('Erro na sincronização', { description: r.erro === 'reconectar' ? 'Conecte de novo a conta Google.' : r.erro });
      await carregar();
    } catch (e) { toast.error('Erro na sincronização', { description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(''); }
  };
  const sair = async () => {
    if (!window.confirm('Desconectar o Google? Os eventos já criados na agenda BALANX continuam lá; você pode apagar a agenda pelo Google.')) return;
    setBusy('sair');
    try { await desconectarGoogle(); toast.success('Google desconectado'); await carregar(); }
    catch (e) { toast.error('Erro', { description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(''); }
  };
  const salvarListas = async (ids: string[], padrao: string) => {
    if (!integ || !listas) return;
    const nomes = Object.fromEntries(listas.map((l) => [l.id, l.titulo]));
    const opcoes = { ...integ.opcoes, listas: ids, lista_padrao: padrao, listas_nomes: nomes };
    setInteg({ ...integ, opcoes });
    try { await salvarOpcoesGoogle(opcoes); sincronizarGoogle().catch(() => {}); }
    catch (e) { toast.error('Não salvou', { description: e instanceof Error ? e.message : '' }); }
  };
  const mudar = async (k: keyof OpcoesGoogle, v: boolean) => {
    if (!integ) return;
    const opcoes = { ...integ.opcoes, [k]: v };
    setInteg({ ...integ, opcoes });
    try { await salvarOpcoesGoogle(opcoes); sincronizarGoogle().catch(() => {}); }
    catch (e) { toast.error('Não salvou', { description: e instanceof Error ? e.message : '' }); }
  };

  if (integ === undefined) return <div className="flex items-center gap-2 py-6 text-sm text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;

  if (!integ) {
    return (
      <div className="space-y-4 pb-2">
        <p className="text-[13.5px] leading-relaxed text-foreground">
          Leve seus vencimentos, recebimentos, compromissos e tarefas para o Google Agenda e o Google Tarefas.
          O BALANX cria uma agenda própria chamada <b>BALANX</b> e só mexe nela.
        </p>
        <ul className="space-y-1.5 text-[13px] text-foreground-muted">
          <li>• Você escolhe o que vai para a agenda.</li>
          <li>• O que mudar lá (horário de um compromisso, tarefa concluída) volta para o BALANX.</li>
          <li>• Dá para desconectar quando quiser.</li>
        </ul>
        <Button className="h-12 w-full rounded-full font-medium bg-foreground text-background hover:bg-foreground/90" onClick={conectar} disabled={busy === 'conectar'}>
          {busy === 'conectar' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Conectar com o Google
        </Button>
      </div>
    );
  }

  const semTarefas = !integ.tasklist_id;
  const semPessoal = !String(integ.escopos || '').includes('calendar.events.readonly');
  return (
    <div className="space-y-4 pb-2">
      <div className="rounded-[16px] bg-success-bg px-3.5 py-3 text-[13px] text-success-fg">
        Conectado como <b>{integ.email || 'sua conta Google'}</b>
        {integ.ultima_sync && <span className="block text-[12px] opacity-90">Última sincronização: {quando(integ.ultima_sync)}</span>}
      </div>
      {integ.ultimo_erro && (
        <div className="rounded-[16px] bg-danger-bg px-3.5 py-3 text-[13px] text-danger-fg">
          {integ.ultimo_erro === 'reconectar' ? 'O Google pediu para autorizar de novo. Toque em Reconectar.' : `Última tentativa falhou: ${integ.ultimo_erro}`}
        </div>
      )}
      <div className="overflow-hidden rounded-[18px] border border-border">
        {OPCOES.map((o) => {
          const bloqueado = (o.k === 'tarefas' && semTarefas) || (o.k === 'pessoal' && semPessoal);
          return (
            <label key={o.k} className="flex items-center gap-3 border-b border-border px-3.5 py-3 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-foreground">{o.titulo}</span>
                <span className="block text-[12px] text-foreground-muted">{bloqueado ? 'Permissão não concedida — reconecte e marque a opção na tela do Google' : o.sub}</span>
              </span>
              <Switch checked={!bloqueado && !!integ.opcoes?.[o.k]} disabled={bloqueado} onCheckedChange={(v) => mudar(o.k, v)} />
            </label>
          );
        })}
      </div>
      {!semTarefas && integ.opcoes?.tarefas !== false && (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Listas do Google Tarefas</p>
          {listas === null ? (
            <div className="flex items-center gap-2 px-1 text-[13px] text-foreground-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando suas listas…</div>
          ) : (
            <div className="overflow-hidden rounded-[18px] border border-border">
              {listas.map((l) => {
                const ids = [...new Set([integ.tasklist_id!, ...(integ.opcoes?.listas || [])])];
                const marcada = l.balanx || ids.includes(l.id);
                const padrao = (integ.opcoes?.lista_padrao && ids.includes(integ.opcoes.lista_padrao) ? integ.opcoes.lista_padrao : integ.tasklist_id) === l.id;
                return (
                  <div key={l.id} className="flex items-center gap-3 border-b border-border px-3.5 py-2.5 last:border-b-0">
                    <input type="checkbox" className="h-4 w-4" checked={marcada} disabled={l.balanx}
                      aria-label={`Sincronizar ${l.titulo}`}
                      onChange={(e) => {
                        const novo = e.target.checked ? [...ids, l.id] : ids.filter((x) => x !== l.id);
                        salvarListas(novo, padrao && !e.target.checked ? integ.tasklist_id! : (integ.opcoes?.lista_padrao || integ.tasklist_id!));
                      }} />
                    <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">{l.titulo}{l.balanx && <span className="text-foreground-muted"> · criada pelo BALANX</span>}</span>
                    {marcada && (
                      <button type="button" onClick={() => salvarListas(ids, l.id)}
                        className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold', padrao ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground-muted hover:text-foreground')}>
                        {padrao ? 'Padrão' : 'Tornar padrão'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="px-1 text-[11.5px] text-foreground-muted">As tarefas das listas marcadas aparecem no Calendário do BALANX. Tarefas novas vão para a lista padrão, ou para a que você escolher ao criar.</p>
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={sincronizar} disabled={!!busy}>
          {busy === 'sync' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />} Sincronizar agora
        </Button>
        {(integ.ultimo_erro === 'reconectar' || semTarefas || semPessoal) && (
          <Button variant="outline" onClick={conectar} disabled={!!busy}>Reconectar</Button>
        )}
        <Button variant="ghost" className="text-danger-fg" onClick={sair} disabled={!!busy}>
          {busy === 'sair' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-[11.5px] text-foreground-muted">A sincronização roda sozinha a cada 10 minutos e na hora em que você cria um compromisso ou tarefa.</p>
    </div>
  );
}
