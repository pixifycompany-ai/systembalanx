// Compromissos do período + tarefas (Calendário). Com o Google conectado e a
// opção ligada, mostra também a agenda pessoal (só leitura, em cinza).
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, ChevronRight, Circle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SectionCard } from '@/components/shared/SectionCard';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/formatters';
import { useAgenda, diaDoItem, type AgendaItem } from '@/hooks/useAgenda';
import { agendaPessoal, listasEscolhidas, statusGoogle, type EventoPessoal } from '@/lib/googleAgenda';
import { AgendaItemSheet } from './AgendaItemSheet';

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const diaSemana = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

export function AgendaPainel({ inicio, fim }: { inicio: string; fim: string }) {
  const { compromissos, tarefas, salvar, excluir, alternarConcluida } = useAgenda(inicio, fim);
  const [sheet, setSheet] = useState<{ item: AgendaItem | null; tipo: 'compromisso' | 'tarefa' } | null>(null);
  const [pessoais, setPessoais] = useState<EventoPessoal[]>([]);
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [nomesListas, setNomesListas] = useState<Record<string, string>>({});

  useEffect(() => {
    let vivo = true;
    statusGoogle().then((s) => {
      if (!vivo) return;
      setConectado(!!s);
      const ls = listasEscolhidas(s);
      setNomesListas(ls.length > 1 ? Object.fromEntries(ls.map((l) => [l.id, l.nome])) : {});
      if (s?.opcoes?.pessoal) agendaPessoal(inicio, fim).then((r) => vivo && setPessoais(r.eventos || [])).catch(() => {});
      else setPessoais([]);
    }).catch(() => setConectado(false));
    return () => { vivo = false; };
  }, [inicio, fim]);

  // Compromissos + agenda pessoal, agrupados por dia.
  const porDia = useMemo(() => {
    type Linha = { chave: string; dia: string; hora: string; titulo: string; sub?: string; item?: AgendaItem; pessoal?: boolean };
    const linhas: Linha[] = [];
    for (const c of compromissos) {
      const dia = diaDoItem(c); if (!dia) continue;
      linhas.push({ chave: c.id, dia, hora: c.inicio && !c.dia_inteiro ? hora(c.inicio) : 'dia', titulo: c.titulo, sub: c.cliente?.nome, item: c });
    }
    for (const e of pessoais) {
      const dia = e.dia_inteiro ? e.inicio.slice(0, 10) : new Date(e.inicio).toLocaleDateString('en-CA');
      linhas.push({ chave: `g-${e.id}`, dia, hora: e.dia_inteiro ? 'dia' : hora(e.inicio), titulo: e.titulo, pessoal: true });
    }
    linhas.sort((a, b) => (a.dia + (a.hora === 'dia' ? '00:00' : a.hora)).localeCompare(b.dia + (b.hora === 'dia' ? '00:00' : b.hora)));
    const grupos = new Map<string, Linha[]>();
    for (const l of linhas) grupos.set(l.dia, [...(grupos.get(l.dia) || []), l]);
    return [...grupos.entries()];
  }, [compromissos, pessoais]);

  const abertas = tarefas.filter((t) => !t.concluida);
  // Concluídas: como no Google Tarefas, saem da lista e ficam numa seção recolhida (mais recentes primeiro).
  const feitas = tarefas.filter((t) => t.concluida)
    .sort((a, b) => String(b.concluida_em || '').localeCompare(String(a.concluida_em || '')));
  const [verFeitas, setVerFeitas] = useState(false);
  const hoje = new Date().toLocaleDateString('en-CA');

  const marcar = async (t: AgendaItem) => {
    try { await alternarConcluida(t); } catch (e) { toast.error('Não salvou', { description: e instanceof Error ? e.message : '' }); }
  };

  const linhaTarefa = (t: AgendaItem) => {
    const atrasada = !t.concluida && t.data && t.data < hoje;
    const paraHoje = !t.concluida && t.data === hoje;
    return (
      <li key={t.id} className="flex items-start gap-2.5 border-b border-border py-2 last:border-b-0">
        <button onClick={() => marcar(t)} aria-label={t.concluida ? 'Marcar como não feita' : 'Marcar como feita'} className="mt-0.5 shrink-0">
          {t.concluida ? <CheckCircle2 className="h-[18px] w-[18px] text-success-fg" /> : <Circle className="h-[18px] w-[18px] text-foreground-muted" />}
        </button>
        <button onClick={() => setSheet({ item: t, tipo: 'tarefa' })} className="min-w-0 flex-1 text-left">
          <span className="flex items-start gap-2">
            <span className={cn('min-w-0 text-[13.5px]', t.concluida ? 'text-foreground-muted line-through' : 'text-foreground')}>{t.titulo}</span>
            {paraHoje && (
              <span className="mt-[1px] shrink-0 rounded-full bg-primary px-2 py-[1px] text-[10.5px] font-semibold uppercase tracking-[0.04em] text-primary-foreground">Hoje</span>
            )}
          </span>
          {t.concluida && t.concluida_em ? (
            <span className="block text-[11.5px] text-foreground-subtle">feita em {formatDate(t.concluida_em.slice(0, 10))}</span>
          ) : (t.data || t.cliente?.nome || (t.google_tasklist_id && nomesListas[t.google_tasklist_id])) && (
            <span className={cn('block text-[11.5px]', atrasada ? 'text-danger-fg' : 'text-foreground-muted')}>
              {[t.data ? `até ${formatDate(t.data)}` : null, t.cliente?.nome, t.google_tasklist_id ? nomesListas[t.google_tasklist_id] : null].filter(Boolean).join(' · ')}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <>
      <SectionCard
        title="Compromissos"
        description={conectado === false ? undefined : conectado ? 'Sincronizado com o Google Agenda' : undefined}
        action={
          <button onClick={() => setSheet({ item: null, tipo: 'compromisso' })} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[12.5px] font-semibold text-foreground hover:bg-surface-2">
            <Plus className="h-3.5 w-3.5" /> Compromisso
          </button>
        }
      >
        {porDia.length === 0 ? (
          <p className="py-2 text-[13px] text-foreground-muted">Nenhum compromisso neste período.</p>
        ) : (
          <div className="space-y-3">
            {porDia.map(([dia, linhas]) => (
              <div key={dia}>
                <p className={cn('mb-1 text-[11px] font-semibold uppercase tracking-[0.06em]', dia === hoje ? 'text-primary' : 'text-foreground-muted')}>
                  {dia === hoje ? 'Hoje' : diaSemana(dia)}
                </p>
                {linhas.map((l) => (
                  <button key={l.chave} disabled={l.pessoal} onClick={() => l.item && setSheet({ item: l.item, tipo: 'compromisso' })}
                    className={cn('flex w-full items-center gap-3 border-b border-border py-2 text-left last:border-b-0', !l.pessoal && 'hover:bg-surface-2')}>
                    <span className={cn('w-11 shrink-0 text-[12px] tabular-nums', l.pessoal ? 'text-foreground-subtle' : 'text-foreground-muted')}>{l.hora}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[13.5px]', l.pessoal ? 'text-foreground-muted' : 'font-medium text-foreground')}>{l.titulo}</span>
                      {l.sub && <span className="block truncate text-[11.5px] text-foreground-muted">{l.sub}</span>}
                    </span>
                    {l.pessoal ? <span className="shrink-0 text-[11px] text-foreground-subtle">pessoal</span> : <CalendarClock className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        {conectado === false && (
          <Link to="/perfil?integracao=google" className="mt-3 inline-block text-[12.5px] font-semibold text-primary hover:underline">Conectar com o Google Agenda →</Link>
        )}
      </SectionCard>

      <SectionCard
        title={`Tarefas${abertas.length ? ` · ${abertas.length}` : ''}`}
        action={
          <button onClick={() => setSheet({ item: null, tipo: 'tarefa' })} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[12.5px] font-semibold text-foreground hover:bg-surface-2">
            <Plus className="h-3.5 w-3.5" /> Tarefa
          </button>
        }
      >
        {tarefas.length === 0 ? (
          <p className="py-2 text-[13px] text-foreground-muted">Nenhuma tarefa. Crie uma ou peça para a IARA.</p>
        ) : (
          <>
            {abertas.length === 0 ? (
              <p className="py-2 text-[13px] text-foreground-muted">Tudo feito por aqui.</p>
            ) : (
              <ul>{abertas.map((t) => linhaTarefa(t))}</ul>
            )}
            {feitas.length > 0 && (
              <div className={cn(abertas.length > 0 && 'mt-1 border-t border-border')}>
                <button onClick={() => setVerFeitas((v) => !v)} aria-expanded={verFeitas}
                  className="flex w-full items-center gap-1.5 py-2.5 text-left text-[13px] font-medium text-foreground-muted hover:text-foreground">
                  <ChevronRight className={cn('h-4 w-4 transition-transform', verFeitas && 'rotate-90')} />
                  Concluídas ({feitas.length})
                  <span className="ml-auto text-[11px] font-normal text-foreground-subtle">últimos 30 dias</span>
                </button>
                {verFeitas && <ul>{feitas.map((t) => linhaTarefa(t))}</ul>}
              </div>
            )}
          </>
        )}
      </SectionCard>

      <AgendaItemSheet
        aberto={!!sheet}
        onOpenChange={(o) => { if (!o) setSheet(null); }}
        item={sheet?.item ?? null}
        tipoNovo={sheet?.tipo ?? 'compromisso'}
        onSalvar={salvar}
        onExcluir={excluir}
      />
    </>
  );
}
