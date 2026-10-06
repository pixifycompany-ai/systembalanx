import { useMemo, useState } from 'react';
import { Check, X, CreditCard, Repeat2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import { useToast } from '@/hooks/use-toast';
import { useReceitas } from '@/hooks/useReceitas';
import { useDespesas } from '@/hooks/useDespesas';
import { useContas } from '@/hooks/useContas';
import { salvarItens, FREQ_LABEL, FORMA_LABEL } from '@/lib/lancarItens';
import type { PropostaLancamento } from '@/hooks/useFinancialAdvisor';

interface Props {
  lancamentos: PropostaLancamento[];
  /** Chamado após criar ou descartar — remove o card. */
  onResolved: () => void;
}

/**
 * Card de confirmação dos lançamentos que a IARA do chat propôs.
 * Cria usando exatamente o mesmo caminho do lançamento por voz
 * (cartão → fatura, parcelado, recorrente), via salvarItens.
 */
export function PropostaLancamentos({ lancamentos, onResolved }: Props) {
  const { toast } = useToast();
  const { createReceita } = useReceitas();
  const { createDespesa, createDespesaParcelada } = useDespesas();
  const { contas } = useContas();
  const [salvando, setSalvando] = useState(false);
  const [feito, setFeito] = useState(false);

  const contasAtivas = useMemo(() => (contas || []).filter((c) => c.ativa), [contas]);
  const nomeConta = (id: string | null) => contasAtivas.find((c) => c.id === id)?.nome || 'Conta padrão';
  const ehCartao = (id: string | null) => !!id && contasAtivas.find((c) => c.id === id)?.tipo === 'cartao_credito';

  const confirmar = async () => {
    setSalvando(true);
    const { ok, total: n } = await salvarItens(lancamentos, {
      contas: contasAtivas, createReceita, createDespesa, createDespesaParcelada,
    });
    setSalvando(false);
    setFeito(true);
    toast({ title: 'Lançado!', description: `${ok} de ${n} criado(s) com sucesso.` });
    onResolved();
  };

  if (feito) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/10 px-3 py-2 text-[12px] font-semibold text-[hsl(var(--success))]">
        <Check className="h-3.5 w-3.5" /> Lançamentos criados.
      </div>
    );
  }

  return (
    <div className="mt-2.5 rounded-2xl border border-border/60 bg-surface/70 p-2.5 backdrop-blur-xl">
      <div className="mb-1.5 px-1 text-[10.5px] font-semibold uppercase tracking-wide text-foreground-subtle">
        Prévia · confira antes de lançar
      </div>
      <div className="flex flex-col gap-1.5">
        {lancamentos.map((it, idx) => {
          const card = ehCartao(it.conta_id);
          const isReceita = it.tipo === 'receita';
          return (
            <div key={idx} className="rounded-xl border border-border/50 bg-surface-2/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex-none rounded-[6px] px-1.5 py-0.5 text-[9.5px] font-bold uppercase',
                    isReceita ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' : 'bg-[hsl(var(--danger))]/15 text-[hsl(var(--danger))]',
                  )}
                >
                  {isReceita ? 'Entrada' : 'Saída'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold capitalize text-foreground">{it.descricao}</span>
                <span className={cn('flex-none text-[13.5px] font-bold tabular-nums', isReceita ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]')}>
                  {isReceita ? '+' : '−'}{formatCurrency(it.valor)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {it.categoria_nome && (
                  <span className="rounded-full border border-border/50 bg-surface px-2 py-0.5 text-[10px] font-medium text-foreground-muted">{it.categoria_nome}</span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-surface px-2 py-0.5 text-[10px] font-medium text-foreground-muted">
                  {card && <CreditCard className="h-2.5 w-2.5" />}{nomeConta(it.conta_id)}{card ? ' · fatura' : ''}
                </span>
                {it.fornecedor && (
                  <span className="rounded-full border border-border/50 bg-surface px-2 py-0.5 text-[10px] font-medium text-foreground-muted">🏪 {it.fornecedor}</span>
                )}
                {it.forma_pagamento && !card && (
                  <span className="rounded-full border border-border/50 bg-surface px-2 py-0.5 text-[10px] font-medium text-foreground-muted">{FORMA_LABEL[it.forma_pagamento] || it.forma_pagamento}</span>
                )}
                {it.parcelas && it.parcelas > 1 && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--primary))]">{it.parcelas}x</span>
                )}
                {it.recorrente && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--primary))]">
                    <Repeat2 className="h-2.5 w-2.5" />{it.recorrente.repeticoes}× / {FREQ_LABEL[it.recorrente.frequencia]}
                  </span>
                )}
                {!card && (
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', it.quitado ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' : 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]')}>
                    {it.quitado ? (isReceita ? 'Recebido' : 'Pago') : 'Pendente'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="px-1 pt-2 text-[10px] leading-[1.4] text-foreground-subtle">
        A IARA pode errar valor ou categoria. Para ajustar, é só me dizer (ex.: "na verdade foi 320").
      </p>

      <div className="mt-2 flex gap-2">
        <button
          onClick={onResolved}
          disabled={salvando}
          className="flex-none rounded-xl bg-surface-2 px-3 py-2 text-[12px] font-semibold text-foreground-muted disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          onClick={confirmar}
          disabled={salvando || lancamentos.length === 0}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[linear-gradient(180deg,hsl(var(--primary)/0.92),hsl(var(--primary)))] px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {salvando ? 'Lançando…' : `Confirmar ${lancamentos.length} ${lancamentos.length === 1 ? 'lançamento' : 'lançamentos'}`}
        </button>
      </div>
    </div>
  );
}
