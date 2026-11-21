// Quadro da conferência da fatura (PDF do banco × BALANX) e lista de lançamentos com "Editar".
// Os números vêm direto da ferramenta — a IARA só comenta, não reescreve.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, CreditCard, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { ConferenciaFatura, LancamentoLista, LinhaConf } from '@/hooks/useFinancialAdvisor';

function Bloco({ titulo, total, tom, linhas, aberto: inicial = false, extra }: {
  titulo: string; total: number; tom: 'danger' | 'warn' | 'info'; linhas: LinhaConf[]; aberto?: boolean; extra?: (l: LinhaConf) => React.ReactNode;
}) {
  const [aberto, setAberto] = useState(inicial);
  if (!linhas.length) return null;
  const cor = tom === 'danger' ? 'text-danger-fg' : tom === 'warn' ? 'text-warning-fg' : 'text-info-fg';
  return (
    <div className="border-t border-border">
      <button type="button" onClick={() => setAberto(!aberto)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <span className="min-w-0 flex-1 text-[13px] font-semibold text-foreground">{titulo} <span className="font-normal text-foreground-muted">· {linhas.length}</span></span>
        <span className={cn('shrink-0 text-[13px] font-semibold tabular-nums', cor)}>{formatCurrency(total)}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-foreground-muted transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <ul className="space-y-1 px-3 pb-3">
          {linhas.map((l, i) => (
            <li key={i} className="flex items-baseline gap-2 text-[12px]">
              <span className="w-[42px] shrink-0 tabular-nums text-foreground-muted">{l.data ? formatDate(l.data).slice(0, 5) : '—'}</span>
              <span className="min-w-0 flex-1 truncate text-foreground">{l.descricao}{l.parcela ? ` (${l.parcela})` : ''}{extra?.(l)}</span>
              <span className="shrink-0 tabular-nums text-foreground">{formatCurrency(l.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function QuadroConferencia({ c }: { c: ConferenciaFatura }) {
  const bate = Math.abs(c.diferenca) < 0.01;
  const sentido = bate ? 'Bate certinho' : c.diferenca < 0 ? `BALANX tem ${formatCurrency(-c.diferenca)} a mais` : `Faltam ${formatCurrency(c.diferenca)} no BALANX`;
  return (
    <div className="mt-2.5 overflow-hidden rounded-[20px] border border-border bg-surface">
      <div className="flex items-center gap-2 px-3 pt-3">
        <CreditCard className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">Conferência · {c.cartao}</span>
        <span className="shrink-0 text-[11.5px] text-foreground-muted">vence {formatDate(c.vencimento)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 px-3 py-3">
        <div className="rounded-[14px] bg-surface-2 px-2.5 py-2">
          <p className="text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted">Banco (arquivo)</p>
          <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-foreground">{formatCurrency(c.total_pdf)}</p>
        </div>
        <div className="rounded-[14px] bg-surface-2 px-2.5 py-2">
          <p className="text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted">BALANX</p>
          <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-foreground">{formatCurrency(c.total_balanx)}</p>
        </div>
        <div className={cn('rounded-[14px] px-2.5 py-2', bate ? 'bg-success-bg' : 'bg-warning-bg')}>
          <p className={cn('text-[10.5px] uppercase tracking-[0.06em]', bate ? 'text-success-fg' : 'text-warning-fg')}>Diferença</p>
          <p className={cn('mt-0.5 text-[12.5px] font-semibold leading-tight', bate ? 'text-success-fg' : 'text-warning-fg')}>{sentido}</p>
        </div>
      </div>
      <p className="px-3 pb-2.5 text-[11.5px] text-foreground-muted">
        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-success-fg" />{c.conferidos} batem · no BALANX é a "Fatura de {c.fatura_balanx}"
        {c.total_pdf_impresso != null && Math.abs(c.total_pdf_impresso - c.total_pdf) > 0.01 ? ` · total impresso ${formatCurrency(c.total_pdf_impresso)}` : ''}
      </p>
      <Bloco titulo="Faltam lançar no BALANX" total={c.soma_faltam} tom="danger" linhas={c.faltam} aberto />
      <Bloco titulo="Valores diferentes" total={c.soma_dif} tom="warn"
        linhas={c.valores_diferentes.map((v) => ({ ...v.no_pdf, descricao: `${v.no_pdf.descricao} · BALANX ${formatCurrency(v.no_balanx.valor)}` }))} />
      <Bloco titulo="No BALANX e não no arquivo" total={c.soma_sobram} tom="info" linhas={c.sobram}
        extra={(l) => (l.possivel_duplicado ? <span className="ml-1 rounded-full bg-warning-bg px-1.5 text-[10.5px] text-warning-fg">duplicado?</span> : l.categoria ? <span className="text-foreground-muted"> · {l.categoria}</span> : null)} />
      {!bate && (
        <p className="border-t border-border px-3 py-2.5 text-[11.5px] leading-snug text-foreground-muted">
          {formatCurrency(c.soma_faltam)} que faltam {c.soma_dif ? `${c.soma_dif > 0 ? '+' : '−'} ${formatCurrency(Math.abs(c.soma_dif))} de diferença ` : ''}− {formatCurrency(c.soma_sobram)} a mais no BALANX = <b className="font-semibold text-foreground">{formatCurrency(c.diferenca)}</b>
          {c.sobram.some((s) => s.parcela) ? '. Parcelas que estão no BALANX e não no arquivo costumam entrar quando a fatura fecha: confira no app do banco.' : ''}
        </p>
      )}
      {c.aviso_fechamento && (
        <p className="flex gap-2 border-t border-border bg-warning-bg/60 px-3 py-2.5 text-[11.5px] leading-snug text-warning-fg">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{c.aviso_fechamento}
        </p>
      )}
    </div>
  );
}

/** Lançamentos que a IARA listou: cada um abre o mesmo formulário do Fluxo de caixa. */
export function ListaLancamentosIara({ itens }: { itens: LancamentoLista[] }) {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(itens.length <= 5);
  return (
    <div className="mt-2.5 overflow-hidden rounded-[18px] border border-border bg-surface">
      <button type="button" onClick={() => setAberto(!aberto)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <Pencil className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
        <span className="min-w-0 flex-1 text-[12.5px] text-foreground-muted">{itens.length} lançamento{itens.length === 1 ? '' : 's'} · toque para abrir e editar</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-foreground-muted transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <ul className="border-t border-border">
          {itens.map((l) => (
            <li key={l.id} className="flex items-center gap-2 border-t border-border px-3 py-2 first:border-t-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-foreground">{l.quem || l.descricao}</span>
                <span className="block truncate text-[11px] text-foreground-muted">{[l.quem ? l.descricao : '', l.data ? formatDate(l.data) : '', l.cartao ? 'no cartão' : ''].filter(Boolean).join(' · ')}</span>
              </span>
              <span className={cn('shrink-0 text-[12.5px] font-semibold tabular-nums', l.tipo === 'receita' ? 'text-success-fg' : 'text-foreground')}>{formatCurrency(l.valor)}</span>
              {l.cartao ? (
                <button type="button" onClick={() => navigate('/contas')} className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11.5px] text-foreground-muted hover:bg-surface-2">Fatura</button>
              ) : (
                <button type="button" onClick={() => navigate(`/fluxo-caixa?abrir=${l.id}`)} className="shrink-0 rounded-full bg-foreground px-2.5 py-1 text-[11.5px] font-semibold text-background hover:opacity-90">Editar</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
