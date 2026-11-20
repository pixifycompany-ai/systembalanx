import { NavyCard } from '@/components/reskin/kit';
import { NAVY_TONE } from '@/components/shared/navyTokens';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { SituacaoLanc } from './lancamento';

/** Valores de um lado (entradas ou saídas) no período, por situação. */
export interface PartesMovimento { efetivado: number; aberto: number; atrasado: number }

interface ResumoPeriodoProps {
  entradas: PartesMovimento;
  saidas: PartesMovimento;
  /** Situações escolhidas no filtro (vazio = todas). O número grande acompanha a escolha. */
  selecao: SituacaoLanc[];
  /** "do mês" / "do período". */
  sufixo?: string;
  className?: string;
}

const total = (p: PartesMovimento) => p.efetivado + p.aberto + p.atrasado;

/** Modo de leitura dos cards conforme a situação filtrada. */
function modoDe(selecao: SituacaoLanc[]): 'tudo' | 'realizado' | 'pendente' {
  if (selecao.length === 0) return 'tudo';
  if (selecao.every((s) => s === 'efetivado')) return 'realizado';
  if (!selecao.includes('efetivado')) return 'pendente';
  return 'tudo';
}

/** Soma só das situações escolhidas que ainda não foram efetivadas. */
const pendenteSel = (p: PartesMovimento, sel: SituacaoLanc[]) =>
  (sel.includes('aberto') ? p.aberto : 0) + (sel.includes('atrasado') ? p.atrasado : 0);

function CardLado({ lado, p, selecao }: { lado: 'entrada' | 'saida'; p: PartesMovimento; selecao: SituacaoLanc[] }) {
  const modo = modoDe(selecao);
  const ent = lado === 'entrada';
  const previsto = total(p);
  const cor = ent ? 'text-success-fg' : 'text-danger-fg';
  const barra = ent ? 'bg-success-fg' : 'bg-danger-fg';

  let rotulo: string; let valor: number; let pct: number; let rodape: React.ReactNode; let barraCls = barra;
  if (modo === 'pendente') {
    const soAtraso = selecao.length === 1 && selecao[0] === 'atrasado';
    const soAberto = selecao.length === 1 && selecao[0] === 'aberto';
    rotulo = soAtraso ? (ent ? 'Recebimentos atrasados' : 'Pagamentos atrasados')
      : soAberto ? (ent ? 'A receber no prazo' : 'A pagar no prazo')
      : (ent ? 'A receber' : 'A pagar');
    valor = pendenteSel(p, selecao);
    pct = previsto > 0 ? Math.min(100, (valor / previsto) * 100) : 0;
    barraCls = soAtraso ? 'bg-warning-fg' : barra;
    rodape = !soAtraso && !soAberto && p.atrasado > 0
      ? <>{formatCurrency(p.atrasado)} já atrasado</>
      : <>{Math.round(pct)}% do previsto</>;
  } else if (modo === 'realizado') {
    rotulo = ent ? 'Recebido' : 'Pago';
    valor = p.efetivado;
    pct = previsto > 0 ? Math.min(100, (valor / previsto) * 100) : 0;
    rodape = <>{Math.round(pct)}% do previsto</>;
  } else {
    rotulo = ent ? 'Entradas' : 'Saídas';
    valor = p.efetivado;
    pct = previsto > 0 ? Math.min(100, (valor / previsto) * 100) : 0;
    rodape = <>{Math.round(pct)}% {ent ? 'recebido' : 'pago'}<span className="hidden sm:inline"> · faltam {formatCurrency(p.aberto + p.atrasado)}</span></>;
  }

  return (
    <div className="rounded-[24px] border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 text-[13px] text-foreground-muted">
        {rotulo}
        <span className="hidden text-[12px] tabular-nums lg:inline">previsto {formatCurrency(previsto)}</span>
      </div>
      <p className={cn('mt-1 font-heading text-[20px] font-semibold tabular-nums tracking-[-0.03em] sm:text-[28px]', cor)}>{formatCurrency(valor)}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className={cn('h-full rounded-full', barraCls)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[12px] text-foreground-muted">{rodape}</p>
    </div>
  );
}

/**
 * Números do período (entradas, saídas e saldo navy). O número grande sempre mostra o que
 * a lista está mostrando: sem filtro = realizado × previsto; "Em aberto/Atrasadas" = o que
 * falta; "Efetivadas" = o que já entrou/saiu. Só o nome do card muda.
 */
export function ResumoPeriodo({ entradas, saidas, selecao, sufixo = 'do mês', className }: ResumoPeriodoProps) {
  const modo = modoDe(selecao);
  const atrasoReceber = entradas.atrasado;
  const saldo = modo === 'pendente'
    ? { rotulo: 'Saldo a realizar', valor: pendenteSel(entradas, selecao) - pendenteSel(saidas, selecao) }
    : modo === 'realizado'
      ? { rotulo: `Saldo realizado ${sufixo}`, valor: entradas.efetivado - saidas.efetivado }
      : { rotulo: `Saldo ${sufixo}`, valor: entradas.efetivado - saidas.efetivado };
  const previsto = total(entradas) - total(saidas);
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', className)}>
      <CardLado lado="entrada" p={entradas} selecao={selecao} />
      <CardLado lado="saida" p={saidas} selecao={selecao} />
      <NavyCard className="order-first col-span-2 sm:order-none sm:col-span-1">
        <div className="flex items-center justify-between gap-2 text-[13px] text-white/70">
          {saldo.rotulo}
          <span className="text-[12px] tabular-nums">previsto {formatCurrency(previsto)}</span>
        </div>
        <p className="mt-1 font-heading text-[28px] font-semibold tabular-nums tracking-[-0.03em]">{formatCurrency(saldo.valor)}</p>
        <p className="mt-3.5 flex items-center gap-1.5 text-[12px] text-white/70">
          {modo === 'pendente' ? (
            <>Entra {formatCurrency(pendenteSel(entradas, selecao))} · sai {formatCurrency(pendenteSel(saidas, selecao))}</>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: atrasoReceber > 0 ? NAVY_TONE.danger : NAVY_TONE.success }} />
              {atrasoReceber > 0 ? `${formatCurrency(atrasoReceber)} em atraso para receber` : 'Nada em atraso para receber'}
            </>
          )}
        </p>
      </NavyCard>
    </div>
  );
}
