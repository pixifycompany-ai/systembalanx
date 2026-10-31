import { useEffect, useMemo, useState } from 'react';
import {
  differenceInCalendarDays, endOfMonth, endOfYear, format, isAfter, isBefore,
  isSameDay, startOfMonth, startOfYear, subDays, subMonths, subYears,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  from?: Date;
  to?: Date;
  /** Chamado ao clicar em "Aplicar" (ou num atalho, se `applyOnPreset`). */
  onApply: (from: Date, to: Date) => void;
  /** Mostra "Limpar" no rodapé. */
  onClear?: () => void;
  /** Atalho aplica direto, sem precisar do botão. */
  applyOnPreset?: boolean;
  className?: string;
}

type Preset = { label: string; range: () => [Date, Date] };

const hoje = () => new Date();
const PRESETS: Preset[] = [
  { label: 'Hoje', range: () => [hoje(), hoje()] },
  { label: 'Últimos 7 dias', range: () => [subDays(hoje(), 6), hoje()] },
  { label: 'Últimos 30 dias', range: () => [subDays(hoje(), 29), hoje()] },
  { label: 'Este mês', range: () => [startOfMonth(hoje()), endOfMonth(hoje())] },
  { label: 'Mês passado', range: () => { const m = subMonths(hoje(), 1); return [startOfMonth(m), endOfMonth(m)]; } },
  { label: 'Últimos 3 meses', range: () => [startOfMonth(subMonths(hoje(), 2)), endOfMonth(hoje())] },
  { label: 'Este ano', range: () => [startOfYear(hoje()), endOfYear(hoje())] },
  { label: 'Ano passado', range: () => { const a = subYears(hoje(), 1); return [startOfYear(a), endOfYear(a)]; } },
];

const fmt = (d?: Date) => (d ? format(d, "d 'de' MMM yyyy", { locale: ptBR }) : null);

/** Dias entre a e b (inclusive), sem as pontas. */
function entre(a: Date, b: Date) {
  return (day: Date) => isAfter(day, a) && isBefore(day, b) && !isSameDay(day, a) && !isSameDay(day, b);
}

/**
 * Seletor de período em um calendário só: 1º toque = início, 2º = fim
 * (tocar antes do início troca as pontas; com o período completo, o próximo
 * toque recomeça). Prévia do intervalo ao passar o mouse, atalhos e resumo.
 */
export function DateRangePicker({ from, to, onApply, onClear, applyOnPreset, className }: DateRangePickerProps) {
  const [ini, setIni] = useState<Date | undefined>(from);
  const [fim, setFim] = useState<Date | undefined>(to);
  const [hover, setHover] = useState<Date | undefined>();
  const [doisMeses, setDoisMeses] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches,
  );
  // Mês exibido: com 2 meses, o atual fica à direita.
  const [mes, setMes] = useState<Date>(() => from ?? (doisMeses ? subMonths(hoje(), 1) : hoje()));

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const on = (e: MediaQueryListEvent) => setDoisMeses(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => { setIni(from); setFim(to); }, [from, to]);

  // Intervalo efetivo (com prévia enquanto escolhe o fim)
  const [a, b] = useMemo<[Date | undefined, Date | undefined]>(() => {
    if (ini && fim) return [ini, fim];
    if (ini && hover && !isSameDay(ini, hover)) return isBefore(hover, ini) ? [hover, ini] : [ini, hover];
    return [ini, undefined];
  }, [ini, fim, hover]);

  const escolhendoFim = Boolean(ini && !fim);

  const modifiers = useMemo(() => {
    const m: Record<string, Date[] | ((d: Date) => boolean)> = {};
    const pontas = [ini, fim].filter(Boolean) as Date[];
    m['rp-edge'] = pontas;
    if (a && b && !isSameDay(a, b)) {
      m['rp-mid'] = entre(a, b);
      m['rp-band-start'] = [a];
      m['rp-band-end'] = [b];
      if (!fim && hover) m['rp-hover'] = [hover];
    }
    return m;
  }, [ini, fim, a, b, hover]);

  const clicar = (day: Date) => {
    if (!ini || (ini && fim)) { setIni(day); setFim(undefined); return; }
    if (isBefore(day, ini)) { setFim(ini); setIni(day); } else { setFim(day); }
    setHover(undefined);
  };

  const usarAtalho = (p: Preset) => {
    const [d1, d2] = p.range();
    setIni(d1); setFim(d2); setHover(undefined);
    setMes(doisMeses && isSameDay(startOfMonth(d1), startOfMonth(d2)) ? subMonths(d1, 1) : d1);
    if (applyOnPreset) onApply(d1, d2);
  };

  const atalhoAtivo = (p: Preset) => {
    if (!ini || !fim) return false;
    const [d1, d2] = p.range();
    return isSameDay(d1, ini) && isSameDay(d2, fim);
  };

  const dias = ini && fim ? differenceInCalendarDays(fim, ini) + 1 : null;

  return (
    <div className={cn('flex min-w-0 max-w-full flex-col gap-4 sm:flex-row', className)}>
      {/* Atalhos: chips roláveis no mobile, coluna no desktop */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:w-40 sm:shrink-0 sm:flex-col sm:overflow-visible sm:border-r sm:border-border sm:px-0 sm:pb-0 sm:pr-4">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => usarAtalho(p)}
            className={cn(
              'h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-left text-[13px] font-medium transition-colors sm:w-full sm:rounded-xl sm:border-transparent',
              atalhoAtivo(p)
                ? 'border-foreground bg-foreground text-background sm:border-foreground'
                : 'border-border bg-surface text-foreground hover:bg-surface-2 sm:bg-transparent',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="min-w-0">
        {/* Início → Fim: mostra qual ponta o próximo toque define */}
        <div className="mb-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {([['Início', ini, !escolhendoFim], ['Fim', fim, escolhendoFim]] as const).map(([rot, d, ativo], i) => (
            <div
              key={rot}
              className={cn(
                'rounded-2xl border px-3 py-2 transition-colors',
                ativo ? 'border-foreground bg-surface' : 'border-border bg-surface-2',
                i === 1 && 'col-start-3',
              )}
            >
              <p className="text-[11px] font-medium text-foreground-muted">{rot}</p>
              <p className={cn('truncate text-[13px] font-semibold', d ? 'text-foreground' : 'text-foreground-subtle')}>
                {fmt(d) ?? (ativo ? (i === 0 ? 'Toque no dia' : 'Toque no dia final') : '—')}
              </p>
            </div>
          ))}
          <ArrowRight className="col-start-2 row-start-1 h-4 w-4 text-foreground-muted" aria-hidden />
        </div>

        <Calendar
          mode="default"
          month={mes}
          onMonthChange={setMes}
          numberOfMonths={doisMeses ? 2 : 1}
          showOutsideDays={false}
          onDayClick={clicar}
          onDayMouseEnter={(d) => escolhendoFim && setHover(d)}
          onDayMouseLeave={() => setHover(undefined)}
          modifiers={modifiers}
          modifiersClassNames={{
            'rp-edge': 'rp-edge !bg-foreground !text-background',
            'rp-mid': 'rp-mid rounded-none hover:bg-surface-3',
            'rp-band-start': 'rp-band-start',
            'rp-band-end': 'rp-band-end',
            'rp-hover': 'ring-2 ring-inset ring-foreground',
          }}
          className="px-0 pb-0 pointer-events-auto"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-[13px] text-foreground-muted">
            {dias ? <><span className="font-semibold text-foreground">{dias} {dias === 1 ? 'dia' : 'dias'}</span> selecionados</> : 'Escolha o início e o fim'}
          </p>
          <div className="flex gap-2">
            {onClear && (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setIni(undefined); setFim(undefined); onClear(); }}>
                Limpar
              </Button>
            )}
            <Button type="button" size="sm" disabled={!ini || !fim} onClick={() => ini && fim && onApply(ini, fim)}>
              Aplicar período
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
