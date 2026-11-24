// Peças dos modais do Fluxo de caixa (formulário de entrada/saída, transferência, exclusão).
// Ficam fora da página para os inputs não remontarem a cada render.
import { format, addDays, endOfMonth } from 'date-fns';
import { Sparkles, Trash2 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { btn } from '@/components/reskin/estilos';
import { digitarMoeda, mostrarMoeda } from '@/lib/moeda';

type Opcao = { value: string; label: string; color?: string };

/** Chips de escolha única (clicar no escolhido desmarca, se `podeLimpar`). */
export function Chips({ opcoes, valor, onChange, podeLimpar = true, disabled }: { opcoes: Opcao[]; valor?: string; onChange: (v: string | undefined) => void; podeLimpar?: boolean; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const on = valor === o.value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(on && podeLimpar ? undefined : o.value)}
            className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors disabled:opacity-50',
              on ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground hover:bg-surface-2')}
          >
            {o.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.color }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

type ContaPick = { id: string; nome: string; cor: string; tipo: string; saldo_atual?: number };

/** Cartões de conta selecionáveis (mostram o saldo; cartão de crédito diz que entra na fatura). */
export function ContasPick({ contas, valor, onChange }: { contas: ContaPick[]; valor?: string; onChange: (id: string | undefined) => void }) {
  if (!contas.length) return <p className="text-[12.5px] text-foreground-muted">Nenhuma conta ativa. Cadastre em Contas.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {contas.map((c) => {
        const on = valor === c.id;
        const cartao = c.tipo === 'cartao_credito';
        return (
          <button key={c.id} type="button" onClick={() => onChange(on ? undefined : c.id)}
            className={cn('min-w-0 rounded-2xl border p-2.5 text-left transition-colors', on ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-surface-2')}>
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium"><span className="h-2 w-2 shrink-0 rounded-full ring-1 ring-white/30" style={{ background: c.cor }} /><span className="truncate">{c.nome}</span></span>
            <span className={cn('block truncate text-[11px] tabular-nums', on ? 'text-background/60' : 'text-foreground-muted')}>
              {cartao ? 'Crédito · entra na fatura' : formatCurrency(Number(c.saldo_atual || 0))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Contador − n + */
export function Stepper({ valor, min, max, onChange, rotulo }: { valor: number; min: number; max: number; onChange: (n: number) => void; rotulo: (n: number) => string }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1">
      <button type="button" onClick={() => onChange(Math.max(min, valor - 1))} className="grid h-8 w-8 place-items-center rounded-full text-foreground hover:bg-surface-2" aria-label="Menos">−</button>
      <span className="min-w-[64px] text-center text-[13px] tabular-nums text-foreground">{rotulo(valor)}</span>
      <button type="button" onClick={() => onChange(Math.min(max, valor + 1))} className="grid h-8 w-8 place-items-center rounded-full text-foreground hover:bg-surface-2" aria-label="Mais">+</button>
    </div>
  );
}

/** Atalhos de data: Hoje, Ontem, Amanhã, +7 dias, Fim do mês. */
export function QuickDatas({ onSelect, className }: { onSelect: (iso: string) => void; className?: string }) {
  const hoje = new Date();
  const ops: [string, Date][] = [['Hoje', hoje], ['Ontem', addDays(hoje, -1)], ['Amanhã', addDays(hoje, 1)], ['+7 dias', addDays(hoje, 7)], ['Fim do mês', endOfMonth(hoje)]];
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {ops.map(([r, d]) => (
        <button key={r} type="button" onClick={() => onSelect(format(d, 'yyyy-MM-dd'))} className="h-7 rounded-full border border-border px-2.5 text-[12px] text-foreground-muted hover:text-foreground">{r}</button>
      ))}
    </div>
  );
}

/** Campo de valor grande (R$). */
export function ValorInput({ valor, onChange, tom, autoFocus }: { valor: number; onChange: (n: number) => void; tom: 'entrada' | 'saida' | 'neutro'; autoFocus?: boolean }) {
  return (
    <div className="flex h-14 items-center rounded-2xl border border-input bg-surface-2 px-4 focus-within:ring-2 focus-within:ring-ring">
      <span className="mr-1.5 text-[18px] text-foreground-muted">R$</span>
      <input
        type="text"
        inputMode="numeric"
        required
        autoFocus={autoFocus}
        value={mostrarMoeda(valor)}
        onChange={(e) => onChange(digitarMoeda(e.target.value))}
        placeholder="0,00"
        className={cn('min-w-0 flex-1 bg-transparent font-heading text-[26px] font-semibold tabular-nums outline-none placeholder:text-foreground-subtle [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          tom === 'entrada' ? 'text-success-fg' : tom === 'saida' ? 'text-danger-fg' : 'text-foreground')}
      />
    </div>
  );
}

/** Coluna de resumo dos modais de lançamento. */
export function ResumoLateral({ tom, valor, subtitulo, linhas, nota }: { tom: 'entrada' | 'saida'; valor: number; subtitulo: string; linhas: [string, React.ReactNode][]; nota: string }) {
  return (
    <aside className="border-t border-border bg-surface p-5 md:border-l md:border-t-0">
      <div className="space-y-4 md:sticky md:top-0">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-foreground-muted">Resumo</p>
        <div>
          <p className={cn('font-heading text-[30px] font-semibold tabular-nums tracking-[-0.03em]', tom === 'entrada' ? 'text-success-fg' : 'text-danger-fg')}>
            {tom === 'entrada' ? '+' : '−'}{formatCurrency(valor)}
          </p>
          <p className="truncate text-[13px] text-foreground-muted">{subtitulo}</p>
        </div>
        <dl className="space-y-2.5 text-[13px]">
          {linhas.map(([r, v]) => (
            <div key={r} className="flex justify-between gap-2"><dt className="shrink-0 text-foreground-muted">{r}</dt><dd className="min-w-0 truncate text-right text-foreground">{v}</dd></div>
          ))}
        </dl>
        <div className="rounded-2xl bg-primary/5 p-3 text-[12px] leading-relaxed text-foreground-muted">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" /> O que acontece</p>
          {nota}
        </div>
      </div>
    </aside>
  );
}

/** Confirmação de exclusão (modal pequeno). */
export function ExcluirSheet({ open, onOpenChange, titulo, descricao, confirmLabel = 'Excluir', onConfirm, isLoading }: { open: boolean; onOpenChange: (o: boolean) => void; titulo: string; descricao: React.ReactNode; confirmLabel?: string; onConfirm: () => void; isLoading?: boolean }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle showClose={false} className="rounded-t-[26px] bg-surface p-0 sm:max-w-[440px]">
        <div className="p-5 pb-safe">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-danger-bg text-danger-fg"><Trash2 className="h-5 w-5" /></span>
          <h2 className="mt-3 font-heading text-[22px] font-light tracking-[-0.02em] text-foreground">{titulo}</h2>
          <div className="mt-1 text-[13.5px] text-foreground-muted">{descricao}</div>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className={cn(btn.outline, 'h-11 flex-1')}>Cancelar</button>
            <button type="button" onClick={onConfirm} disabled={isLoading} className="h-11 flex-1 rounded-full bg-danger text-[13.5px] font-medium text-white hover:opacity-90 disabled:opacity-50">
              {isLoading ? 'Excluindo…' : confirmLabel}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
