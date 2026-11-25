// Topo da Início no CELULAR: fundo em degradê nas cores do BALANX (azul → violeta), saudação,
// card escuro do saldo em contas e 3 cards pequenos (recebido, pago, lucro) dentro do mesmo fundo.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import { formatDelta } from '@/components/dashboard/KpiStatCard';
import { NAVY_SURFACE_BG, NAVY_SURFACE_SHADOW, NAVY_TONE } from '@/components/shared/navyTokens';
import { OlhoValores } from '@/components/shared/OlhoValores';
import { NotificationBell } from '@/components/layout/NotificationBell';

interface Mini { rotulo: string; valor: number; delta: number | null; inverter?: boolean; onClick: () => void; extra?: React.ReactNode }

function Pill({ delta, inverter, escuro }: { delta: number | null; inverter?: boolean; escuro?: boolean }) {
  if (delta == null || !Number.isFinite(delta)) return null;
  const bom = inverter ? delta <= 0 : delta >= 0;
  return (
    <span className={cn('inline-flex w-fit items-center self-start rounded-full px-1.5 py-[3px] text-[10.5px] font-semibold leading-none tabular-nums',
      escuro ? 'bg-white/[0.12]' : bom ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg')}
      style={escuro ? { color: bom ? NAVY_TONE.success : NAVY_TONE.danger } : undefined}>
      {formatDelta(delta)}
    </span>
  );
}

export function HeroMobile(p: {
  dataExtenso: string; saudacao: string; nome: string;
  mesRotulo: string; ehAtual: boolean; onMes: (d: -1 | 1) => void; onMesAtual: () => void;
  saldoRotulo: string; saldo: number; saldoDelta: number | null; saldoHint: string; onSaldo: () => void;
  minis: Mini[];
}) {
  return (
    <section
      className="relative isolate -mx-3 overflow-hidden rounded-b-[34px] px-4 pb-4 md:hidden"
      style={{
        // Sobe por trás da barra de status (o main tem padding-top com a safe area).
        marginTop: 'calc(-1 * (env(safe-area-inset-top, 0px) + 0.75rem))',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.1rem)',
        background: [
          'radial-gradient(90% 60% at 100% 0%, hsl(var(--primary) / 0.38), transparent 62%)',
          'radial-gradient(80% 55% at 0% 22%, rgba(167,139,250,0.34), transparent 60%)',
          'radial-gradient(70% 50% at 60% 100%, rgba(56,189,248,0.22), transparent 65%)',
          'linear-gradient(180deg, hsl(var(--primary) / 0.20), hsl(262 80% 70% / 0.16))',
          'hsl(var(--surface))',
        ].join(', '),
        boxShadow: '0 22px 40px -30px rgba(37,52,120,0.45)',
      }}
    >
      {/* Saudação + olho + sino */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] text-foreground-muted first-letter:uppercase">{p.dataExtenso}</p>
          <h1 className="mt-0.5 font-heading text-[30px] font-light leading-[1.05] tracking-[-0.04em] text-foreground">
            {p.saudacao},<br /><span className="font-serif italic tracking-normal">{p.nome}</span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pt-1">
          <OlhoValores className="no-touch-min h-9 w-9 rounded-full border-0 bg-surface/70 text-foreground backdrop-blur [&_svg]:h-[18px] [&_svg]:w-[18px]" />
          <span className="[&_button]:h-9 [&_button]:w-9 [&_button]:rounded-full [&_button]:bg-surface/70 [&_button]:backdrop-blur"><NotificationBell /></span>
        </div>
      </div>

      {/* Mês */}
      <div className="mt-3 flex h-9 w-full items-center justify-between gap-0.5 rounded-full bg-surface/70 p-0.5 backdrop-blur">
        <button type="button" onClick={() => p.onMes(-1)} aria-label="Mês anterior" className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" onClick={p.onMesAtual} disabled={p.ehAtual} className="min-w-0 flex-1 truncate whitespace-nowrap px-1 text-center text-[13px] text-foreground disabled:cursor-default">{p.mesRotulo}</button>
        <button type="button" onClick={() => p.onMes(1)} aria-label="Próximo mês" className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted"><ChevronRight className="h-4 w-4" /></button>
      </div>

      {/* Saldo (card escuro) */}
      <button type="button" onClick={p.onSaldo} className="mt-3 block w-full rounded-[24px] p-4 text-left text-white" style={{ background: NAVY_SURFACE_BG, boxShadow: NAVY_SURFACE_SHADOW }}>
        <span className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] text-white/70">{p.saldoRotulo}</span>
          <Pill delta={p.saldoDelta} escuro />
        </span>
        <span className="mt-3 block text-right font-heading text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{formatCurrency(p.saldo)}</span>
        <span className="mt-2 block text-right text-[11.5px] text-white/60">{p.saldoHint}</span>
      </button>

      {/* 3 cards pequenos */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {p.minis.map((m) => (
          <button key={m.rotulo} type="button" onClick={m.onClick}
            className="flex min-w-0 flex-col gap-1.5 rounded-[18px] border border-white/60 bg-surface/75 p-2.5 text-left shadow-[0_10px_24px_-18px_rgba(11,18,38,0.5)] backdrop-blur dark:border-white/10">
            <span className="truncate text-[11px] text-foreground-muted">{m.rotulo}</span>
            <span className="truncate font-heading text-[14px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground">{formatCurrency(m.valor)}</span>
            <Pill delta={m.delta} inverter={m.inverter} />
            {m.extra}
          </button>
        ))}
      </div>
    </section>
  );
}
