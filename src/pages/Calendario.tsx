import { useEffect, useMemo, useState } from 'react';
import { addDays, addMonths, addWeeks, endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Circle } from 'lucide-react';
import { PageHeader, Segmented } from '@/components/reskin/kit';
import { itemMatches, type CalFiltro } from '@/components/calendario/WeeklyForecast';
import { useCalendario, getRange, type CalendarioModo, type DayTransactions } from '@/hooks/useCalendario';
import { useAgenda, diaDoItem } from '@/hooks/useAgenda';
import { AgendaPainel } from '@/components/calendario/AgendaPainel';
import { LancamentosDoDia } from '@/components/calendario/DayDetailDialog';
import { SkeletonChart } from '@/components/shared/LoadingSpinner';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';

const FILTROS: { value: CalFiltro | 'tudo'; label: string }[] = [
  { value: 'tudo', label: 'Tudo' },
  { value: 'a_receber', label: 'A receber' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'a_pagar', label: 'A pagar' },
  { value: 'pago', label: 'Pago' },
];

const STORAGE_KEY = 'calendario:modo';
const SEM = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const dt = (s: string) => new Date(`${s}T12:00:00`);
const longo = (s: string) => format(dt(s), "EEEE, d 'de' MMMM", { locale: ptBR });
const horaDe = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function Calendario() {
  const [modo, setModo] = useState<CalendarioModo>(() => {
    if (typeof window === 'undefined') return 'mes';
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'semana' || stored === 'hoje' || stored === 'mes' ? stored : 'mes';
  });
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [filtros, setFiltros] = useState<Set<CalFiltro>>(new Set());
  const hoje = iso(new Date());
  const [sel, setSel] = useState<string>(hoje);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, modo); }, [modo]);

  const faixa = getRange(modo, refDate);
  // Ao trocar de período, seleciona hoje (se estiver nele) ou o primeiro dia.
  useEffect(() => {
    setSel(hoje >= faixa.start && hoje <= faixa.end ? hoje : faixa.start);
  }, [faixa.start, faixa.end, hoje]);

  const { days, isLoading } = useCalendario(modo, refDate);
  const amanhaISO = iso(addDays(dt(sel), 1));
  const { days: diasAmanha } = useCalendario('hoje', dt(amanhaISO));
  const { compromissos, tarefas } = useAgenda(faixa.start, modo === 'hoje' ? amanhaISO : faixa.end);

  const toggleFiltro = (f: CalFiltro | 'tudo') => setFiltros((prev) => {
    if (f === 'tudo') return new Set();
    const n = new Set(prev);
    if (n.has(f)) n.delete(f); else n.add(f);
    return n;
  });

  // Os filtros valem dentro do calendário: marcas dos dias e lista do dia.
  const filteredDays = useMemo<Record<string, DayTransactions>>(() => {
    if (filtros.size === 0) return days;
    const out: Record<string, DayTransactions> = {};
    for (const [date, day] of Object.entries(days)) {
      const items = day.items.filter((it) => itemMatches(it, filtros));
      if (items.length === 0) continue;
      const receitas = items.filter((i) => i.tipo === 'receita').reduce((s, i) => s + i.valor, 0);
      const despesas = items.filter((i) => i.tipo === 'despesa').reduce((s, i) => s + i.valor, 0);
      out[date] = { date, receitas, despesas, items };
    }
    return out;
  }, [days, filtros]);

  // Agenda por dia (compromissos e tarefas).
  const agendaPorDia = useMemo(() => {
    const m = new Map<string, { comp: typeof compromissos; tar: typeof tarefas }>();
    const pega = (d: string) => { if (!m.has(d)) m.set(d, { comp: [], tar: [] }); return m.get(d)!; };
    compromissos.forEach((c) => { const d = diaDoItem(c); if (d) pega(d).comp.push(c); });
    tarefas.forEach((t) => { const d = diaDoItem(t); if (d) pega(d).tar.push(t); });
    return m;
  }, [compromissos, tarefas]);

  const handlePrev = () => {
    if (modo === 'mes') setRefDate((d) => addMonths(d, -1));
    else if (modo === 'semana') setRefDate((d) => addWeeks(d, -1));
    else setRefDate((d) => addDays(d, -1));
  };
  const handleNext = () => {
    if (modo === 'mes') setRefDate((d) => addMonths(d, 1));
    else if (modo === 'semana') setRefDate((d) => addWeeks(d, 1));
    else setRefDate((d) => addDays(d, 1));
  };
  const trocarModo = (m: CalendarioModo) => { setModo(m); setRefDate(new Date()); };

  const rotuloPeriodo = modo === 'mes'
    ? format(refDate, 'MMMM yyyy', { locale: ptBR })
    : modo === 'semana'
      ? `${format(dt(faixa.start), 'd', { locale: ptBR })} – ${format(dt(faixa.end), "d MMM", { locale: ptBR })}`
      : format(refDate, 'EEE, d MMM', { locale: ptBR });

  // Grade do mês (segunda a domingo).
  const mesDias = useMemo(() => {
    const ini = startOfMonth(refDate);
    const fim = endOfMonth(refDate);
    const vazios = (ini.getDay() + 6) % 7;
    const lista: (string | null)[] = Array.from({ length: vazios }, () => null);
    for (let d = ini; d <= fim; d = addDays(d, 1)) lista.push(iso(d));
    return lista;
  }, [refDate]);
  const semanaDias = useMemo(() => {
    const seg = startOfWeek(refDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => iso(addDays(seg, i)));
  }, [refDate]);

  const maxMes = Math.max(1, ...Object.values(filteredDays).map((d) => Math.max(d.receitas, d.despesas)));
  const diaSel = modo === 'hoje' ? iso(refDate) : sel;
  const doDia = filteredDays[diaSel];
  const agendaDoDia = agendaPorDia.get(diaSel);
  const entraDia = doDia?.receitas ?? 0;
  const saiDia = doDia?.despesas ?? 0;

  // Recebimentos atrasados do período (sempre sobre todos os lançamentos).
  const atrasados = Object.values(days).flatMap((d) => d.items.filter((i) => i.tipo === 'receita' && i.status === 'atrasado'));
  const amanha = diasAmanha[amanhaISO];
  const agendaAmanha = agendaPorDia.get(amanhaISO);

  return (
    <main className="container max-w-full space-y-5 py-3 md:py-6">
      <PageHeader eyebrow="Dinheiro" title="Calendário">
        <Segmented<CalendarioModo> size="sm" className="max-sm:w-full" value={modo} onChange={trocarModo} opts={[['mes', 'Mês'], ['semana', 'Semana'], ['hoje', 'Hoje']]} />
        <div className="flex items-center justify-between gap-1 rounded-full border border-border bg-surface p-1 max-sm:w-full">
          <button type="button" onClick={handlePrev} aria-label="Anterior" className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-surface-2"><ChevronLeft className="h-4 w-4" /></button>
          <span className="whitespace-nowrap px-1 text-[13px] text-foreground">{rotuloPeriodo}</span>
          <button type="button" onClick={handleNext} aria-label="Próximo" className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-surface-2"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </PageHeader>

      {isLoading ? (
        <SkeletonChart />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 overflow-hidden rounded-[28px] border border-border bg-surface">
            {modo === 'mes' && (
              <div className="border-b border-border p-3 md:p-4">
                <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted">
                  {SEM.map((d) => <span key={d}>{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {mesDias.map((d, i) => {
                    if (!d) return <span key={`v${i}`} />;
                    const dia = filteredDays[d];
                    const e = dia?.receitas ?? 0, sa = dia?.despesas ?? 0;
                    const ativo = d === sel, ehHoje = d === hoje, passado = d < hoje;
                    const forte = Math.max(e, sa) / maxMes;
                    const ag = agendaPorDia.get(d);
                    const temAgenda = !!ag && (ag.comp.length > 0 || ag.tar.some((t) => !t.concluida));
                    return (
                      <button key={d} type="button" onClick={() => setSel(d)} aria-label={`Ver o dia ${Number(d.slice(8))}`} aria-pressed={ativo}
                        className={cn('no-touch-min relative flex min-h-[54px] flex-col rounded-xl border p-1.5 text-left transition-colors md:min-h-[76px] md:p-2',
                          ativo ? 'border-foreground bg-foreground text-background' : 'border-transparent hover:bg-surface-2',
                          !ativo && (e || sa) && 'bg-surface-2/60', ehHoje && !ativo && 'border-primary/60')}>
                        <span className={cn('text-[13px] font-semibold tabular-nums md:text-[14px]', !ativo && passado && 'text-foreground-muted')}>{Number(d.slice(8))}</span>
                        <span className="mt-auto hidden min-w-0 flex-col text-[11px] font-semibold leading-snug tabular-nums md:flex">
                          {e > 0 && <span className={cn('truncate', ativo ? 'text-emerald-300' : 'text-success-fg')}>+{formatCurrency(e)}</span>}
                          {sa > 0 && <span className={cn('truncate', ativo ? 'text-rose-300' : 'text-danger-fg')}>−{formatCurrency(sa)}</span>}
                        </span>
                        <span className="mt-auto flex gap-0.5 md:hidden">
                          {e > 0 && <i className="block h-1 rounded-full bg-success-fg" style={{ width: `${8 + forte * 16}px` }} />}
                          {sa > 0 && <i className="block h-1 rounded-full bg-danger-fg" style={{ width: `${8 + forte * 16}px` }} />}
                        </span>
                        {temAgenda && <i className={cn('absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full', ativo ? 'bg-background' : 'bg-primary')} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {modo === 'semana' && (
              <div className="grid grid-cols-7 gap-1.5 border-b border-border p-3 md:gap-2 md:p-4">
                {semanaDias.map((d, i) => {
                  const dia = filteredDays[d];
                  const e = dia?.receitas ?? 0, s = dia?.despesas ?? 0;
                  const maxDia = Math.max(1, ...semanaDias.map((x) => Math.max(filteredDays[x]?.receitas ?? 0, filteredDays[x]?.despesas ?? 0)));
                  const ativo = d === sel, ehHoje = d === hoje;
                  const ag = agendaPorDia.get(d);
                  return (
                    <button key={d} type="button" onClick={() => setSel(d)} aria-pressed={ativo}
                      className={cn('no-touch-min flex flex-col items-center rounded-2xl px-1 pb-2.5 pt-2 transition-colors',
                        ativo ? 'bg-foreground text-background' : 'hover:bg-surface-2', ehHoje && !ativo && 'ring-1 ring-primary/50')}>
                      <span className={cn('text-[11px] uppercase tracking-[0.06em]', ativo ? 'text-background/70' : 'text-foreground-muted')}>{ehHoje ? 'Hoje' : SEM[i]}</span>
                      <span className="font-heading text-[22px] font-semibold leading-tight tabular-nums md:text-[26px]">{Number(d.slice(8))}</span>
                      <span className="mt-1 flex h-8 items-end gap-1">
                        <i className={cn('block w-1.5 rounded-full', ativo ? 'bg-emerald-300' : 'bg-success-fg/70')} style={{ height: `${e ? 12 + (e / maxDia) * 88 : 6}%`, opacity: e ? 1 : 0.25 }} />
                        <i className={cn('block w-1.5 rounded-full', ativo ? 'bg-rose-300' : 'bg-danger-fg/70')} style={{ height: `${s ? 12 + (s / maxDia) * 88 : 6}%`, opacity: s ? 1 : 0.25 }} />
                      </span>
                      <span className="mt-1.5 flex h-1.5 gap-1">
                        {!!ag?.comp.length && <i className={cn('h-1.5 w-1.5 rounded-full', ativo ? 'bg-background' : 'bg-primary')} />}
                        {!!ag?.tar.some((t) => !t.concluida) && <i className={cn('h-1.5 w-1.5 rounded-full', ativo ? 'bg-background/60' : 'bg-violet-500')} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* o dia escolhido */}
            <div className="p-4 md:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-heading text-[22px] font-light tracking-[-0.02em] text-foreground first-letter:uppercase">{diaSel === hoje ? `Hoje, ${longo(diaSel)}` : longo(diaSel)}</h2>
                <p className="text-[13px] tabular-nums text-foreground-muted">
                  <span className="text-success-fg">+{formatCurrency(entraDia)}</span> · <span className="text-danger-fg">−{formatCurrency(saiDia)}</span>
                </p>
              </div>
              <div className="mt-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
                {FILTROS.map((f) => {
                  const ativo = f.value === 'tudo' ? filtros.size === 0 : filtros.has(f.value);
                  return (
                    <button key={f.value} type="button" onClick={() => toggleFiltro(f.value)} aria-pressed={ativo}
                      className={cn('no-touch-min h-8 shrink-0 rounded-full border px-3.5 text-[12.5px]',
                        ativo ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground-muted hover:text-foreground')}>{f.label}</button>
                  );
                })}
              </div>

              {!doDia?.items.length && !agendaDoDia?.comp.length && !agendaDoDia?.tar.length ? (
                <div className="mt-8 rounded-2xl border border-dashed border-border py-10 text-center">
                  <p className="font-heading text-[18px] font-light text-foreground">Dia livre</p>
                  <p className="text-[13px] text-foreground-muted">{filtros.size ? 'Nada com esse filtro neste dia.' : 'Nada entra, nada sai e nenhum compromisso.'}</p>
                </div>
              ) : (
                <div className="mt-5 space-y-6">
                  {!!doDia?.items.length && <LancamentosDoDia day={diaSel} items={doDia.items} />}
                  {(!!agendaDoDia?.comp.length || !!agendaDoDia?.tar.length) && (
                    <div>
                      <p className="mb-1 text-[11.5px] uppercase tracking-[0.08em] text-foreground-muted">Agenda</p>
                      {agendaDoDia!.comp.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                          <span className="w-12 shrink-0 text-[13px] tabular-nums text-primary">{c.inicio && !c.dia_inteiro ? horaDe(c.inicio) : 'dia'}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] text-foreground">{c.titulo}</span>
                            {c.cliente?.nome && <span className="block truncate text-[12px] text-foreground-muted">{c.cliente.nome}</span>}
                          </span>
                          <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
                        </div>
                      ))}
                      {agendaDoDia!.tar.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                          <span className="grid w-12 shrink-0 place-items-start">{t.concluida ? <CheckCircle2 className="h-[18px] w-[18px] text-success-fg" /> : <Circle className="h-[18px] w-[18px] text-foreground-muted" />}</span>
                          <span className="min-w-0 flex-1">
                            <span className={cn('block truncate text-[14.5px]', t.concluida ? 'text-foreground-muted line-through' : 'text-foreground')}>{t.titulo}</span>
                            {t.cliente?.nome && <span className="block truncate text-[12px] text-foreground-muted">{t.cliente.nome}</span>}
                          </span>
                          <span className="shrink-0 text-[11px] text-foreground-subtle">tarefa</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* visão Hoje: prévia de amanhã */}
            {modo === 'hoje' && (
              <div className="border-t border-border bg-surface-2/50 p-4 md:px-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13px] text-foreground-muted"><span className="font-semibold text-foreground">Amanhã</span> · {format(dt(amanhaISO), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
                  <button type="button" onClick={() => { setModo('semana'); setRefDate(dt(amanhaISO)); }} className="text-[12.5px] text-primary hover:underline">ver na semana →</button>
                </div>
                <div className="mt-2 space-y-1.5">
                  {!amanha?.items.length && !agendaAmanha?.tar.length && !agendaAmanha?.comp.length && <p className="text-[13px] text-foreground-muted">Nada previsto.</p>}
                  {amanha?.items.map((x) => (
                    <p key={`${x.tipo}-${x.id}`} className="flex items-center gap-2 text-[13.5px] text-foreground">
                      <span className={cn('h-1.5 w-1.5 rounded-full', x.tipo === 'receita' ? 'bg-success-fg' : 'bg-danger-fg')} />
                      <span className="min-w-0 flex-1 truncate">{x.clienteOuFornecedor || x.descricao}</span>
                      <span className="font-semibold tabular-nums">{x.tipo === 'receita' ? '+' : '−'}{formatCurrency(x.valor)}</span>
                    </p>
                  ))}
                  {agendaAmanha?.comp.map((c) => (
                    <p key={c.id} className="flex items-center gap-2 text-[13.5px] text-foreground-muted"><CalendarClock className="h-3 w-3 text-primary" /><span className="truncate">{c.inicio && !c.dia_inteiro ? `${horaDe(c.inicio)} · ` : ''}{c.titulo}</span></p>
                  ))}
                  {agendaAmanha?.tar.filter((t) => !t.concluida).map((t) => (
                    <p key={t.id} className="flex items-center gap-2 text-[13.5px] text-foreground-muted"><Circle className="h-3 w-3" /><span className="truncate">{t.titulo}</span></p>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Lateral */}
          <aside className="min-w-0 space-y-4">
            {atrasados.length > 0 && (
              <div className="rounded-[22px] border border-danger-fg/25 bg-danger-bg/60 p-4">
                <p className="flex items-center gap-2 text-[13.5px] text-danger-fg"><AlertTriangle className="h-4 w-4" /> {atrasados.length} {atrasados.length === 1 ? 'recebimento atrasado' : 'recebimentos atrasados'}</p>
                <p className="mt-1 font-heading text-[24px] font-light tabular-nums text-foreground">{formatCurrency(atrasados.reduce((s, x) => s + x.valor, 0))}</p>
                <p className="truncate text-[12px] text-foreground-muted">{[...new Set(atrasados.map((a) => a.clienteOuFornecedor || a.descricao))].join(' · ')}</p>
              </div>
            )}
            <AgendaPainel inicio={faixa.start} fim={faixa.end} />
          </aside>
        </div>
      )}
    </main>
  );
}
